import type { z } from "zod";

import { SUBSCRIPTION_PATH } from "@/lib/app";
import { firstFieldErrors } from "@/lib/auth-validation";

/** JSON error bodies shared by the API routes: `{ error: CODE, ... }` with a matching HTTP status. */
export function unauthorized(): Response {
  return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

export function notFound(): Response {
  return Response.json({ error: "NOT_FOUND" }, { status: 404 });
}

export function validationError<T>(error: z.ZodError<T>): Response {
  return Response.json({ error: "VALIDATION", fieldErrors: firstFieldErrors(error) }, { status: 400 });
}

/** 403 for a feature or limit outside the DJ's plan: `{ error: CODE, message, upgradeUrl }` (Polish message). */
export function planRequired(message: string, error = "PLAN_REQUIRED"): Response {
  return Response.json({ error, message, upgradeUrl: SUBSCRIPTION_PATH }, { status: 403 });
}

export function invalidJson(): Response {
  return Response.json({ error: "INVALID_JSON" }, { status: 400 });
}

/** Parses the request body as JSON; `undefined` when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** True when the request declares a JSON body (`Content-Type: application/json`, parameters allowed). */
export function isJsonContentType(request: Request): boolean {
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

/**
 * 415 unless the request is `Content-Type: application/json`. Guest endpoints require it: a cross-site HTML form
 * cannot send that type, and a cross-site `fetch` with it needs a CORS preflight that we never allow.
 */
export function requireJsonContentType(request: Request): Response | null {
  return isJsonContentType(request) ? null : Response.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
}

/** Marks a per-user answer as never to be stored by a browser or a proxy (`Cache-Control: private, no-store`). */
export function noStore(response: Response): Response {
  response.headers.set("cache-control", "private, no-store");
  return response;
}
