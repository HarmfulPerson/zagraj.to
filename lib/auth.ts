import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { prisma } from "@/lib/db";
import { buildSessionOptions, type SessionData } from "@/lib/session-config";

export const LOGIN_PATH = "/logowanie";
export const PANEL_PATH = "/panel";

export type CurrentDj = { id: string; email: string; displayName: string; plan: "FREE" | "PRO" };

/** The encrypted session for the current request (server components, actions, route handlers). */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), buildSessionOptions());
}

export async function startDjSession(djId: string): Promise<void> {
  const session = await getSession();
  session.djId = djId;
  await session.save();
}

export async function endDjSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

/** The logged-in DJ, or null. Deduplicated within one request. */
export const getCurrentDj = cache(async (): Promise<CurrentDj | null> => {
  // Session validation compares the seal expiry with the current time, so it must
  // only run at request time (Cache Components would otherwise flag Date.now()).
  await connection();
  const { djId } = await getSession();
  if (!djId) return null;
  return prisma.user.findUnique({
    where: { id: djId },
    select: { id: true, email: true, displayName: true, plan: true },
  });
});

/** The logged-in DJ; redirects to the login page when there is none. Use in every /panel page and DJ action. */
export async function requireDj(): Promise<CurrentDj> {
  const dj = await getCurrentDj();
  if (!dj) redirect(LOGIN_PATH);
  return dj;
}
