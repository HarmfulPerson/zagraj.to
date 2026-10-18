"use server";

import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { eventPanelPath } from "@/lib/app";
import { requireDj } from "@/lib/auth";
import { firstFieldErrors, type FieldErrors } from "@/lib/auth-validation";
import { EVENT_STATUS_LABELS } from "@/lib/event-status";
import { createEventSchema, eventIdSchema, eventStatusActionSchema, updateEventSchema } from "@/lib/event-validation";
import { changeEventStatus, createEvent, updateEvent } from "@/lib/events";

type EventFormFields = { name: string; startsAt: string; maxRequestsPerGuest: string };

export type EventFormState = {
  fieldErrors?: FieldErrors<EventFormFields>;
  values?: Partial<EventFormFields>;
  /** Set after a successful edit; changes on every save so the form can show a fresh confirmation. */
  savedAt?: number;
};

export type StatusFormState = { error?: string };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createEventAction(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const dj = await requireDj();
  const values = {
    name: text(formData, "name"),
    startsAt: text(formData, "startsAt"),
    maxRequestsPerGuest: text(formData, "maxRequestsPerGuest"),
  };

  const parsed = createEventSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error), values };

  const event = await createEvent(dj.id, parsed.data);
  redirect(eventPanelPath(event.id));
}

export async function updateEventAction(eventId: string, _prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const dj = await requireDj();
  const id = eventIdSchema.safeParse(eventId);
  if (!id.success) notFound();

  const values = { name: text(formData, "name"), maxRequestsPerGuest: text(formData, "maxRequestsPerGuest") };
  const parsed = updateEventSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error), values };

  const event = await updateEvent(dj.id, id.data, parsed.data);
  if (!event) notFound();
  refresh();
  return { savedAt: Date.now() };
}

export async function changeEventStatusAction(eventId: string, _prev: StatusFormState, formData: FormData): Promise<StatusFormState> {
  const dj = await requireDj();
  const id = eventIdSchema.safeParse(eventId);
  if (!id.success) notFound();

  const parsed = eventStatusActionSchema.safeParse({ action: text(formData, "action") });
  if (!parsed.success) return { error: "Nieznana akcja." };

  const result = await changeEventStatus(dj.id, id.data, parsed.data.action);
  if (!result.ok && result.reason === "NOT_FOUND") notFound();
  refresh();
  if (!result.ok) {
    return { error: `Nie można zmienić statusu. Aktualny status wydarzenia: „${EVENT_STATUS_LABELS[result.status]}”.` };
  }
  return {};
}
