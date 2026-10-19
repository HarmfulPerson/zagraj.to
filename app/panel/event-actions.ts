"use server";

import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { eventPanelPath, SUBSCRIPTION_PATH } from "@/lib/app";
import { requireDj } from "@/lib/auth";
import { firstFieldErrors, type FieldErrors } from "@/lib/auth-validation";
import { EVENT_STATUS_LABELS } from "@/lib/event-status";
import { createEventSchema, eventIdSchema, eventStatusActionSchema, updateEventSchema } from "@/lib/event-validation";
import { changeEventStatus, createEvent, updateEvent } from "@/lib/events";
import { PLAN_MESSAGES } from "@/lib/plans";

type EventFormFields = { name: string; startsAt: string; maxRequestsPerGuest: string; posterText: string };

export type EventFormState = {
  fieldErrors?: FieldErrors<EventFormFields>;
  values?: Partial<EventFormFields>;
  /** Set after a successful edit; changes on every save so the form can show a fresh confirmation. */
  savedAt?: number;
};

/** `upgradeHref` is set when a plan limit blocked the action (the UI links to the subscription page). */
export type StatusFormState = { error?: string; upgradeHref?: string };

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

  // The poster text field is only submitted when the plan allows it (a locked field is disabled), otherwise unchanged.
  const posterText = formData.has("posterText") ? text(formData, "posterText") : undefined;
  const values = { name: text(formData, "name"), maxRequestsPerGuest: text(formData, "maxRequestsPerGuest"), posterText };
  const parsed = updateEventSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: firstFieldErrors(parsed.error), values };

  const result = await updateEvent(dj.id, id.data, parsed.data);
  if (!result.ok && result.reason === "NOT_FOUND") notFound();
  if (!result.ok) return { fieldErrors: { posterText: `${PLAN_MESSAGES.posterTextLocked}.` }, values };
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
  if (!result.ok && result.reason === "PLAN_LIMIT") {
    return { error: PLAN_MESSAGES.startLimit(result.limit), upgradeHref: SUBSCRIPTION_PATH };
  }
  if (!result.ok) {
    return { error: `Nie można zmienić statusu. Aktualny status wydarzenia: „${EVENT_STATUS_LABELS[result.status]}”.` };
  }
  return {};
}
