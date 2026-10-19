import { z } from "zod";

import { compareQueue } from "@/lib/queue-order";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/request-status";

/**
 * Export of an event's wish list (`GET /api/events/:id/export`). Pure and client-safe: the formatting is unit-tested
 * here, and the panel builds the download URL with the same helpers.
 */

export const EXPORT_FORMATS = ["csv", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Default filter: everything except rejected tracks (they were never going to be played). */
export const DEFAULT_EXPORT_STATUSES: readonly RequestStatus[] = ["PENDING", "ACCEPTED", "PLAYED"];

/** Statuses as the DJ sees them on the board, used in the CSV and the panel filter. */
export const REQUEST_STATUS_LABELS: Readonly<Record<RequestStatus, string>> = {
  PENDING: "Nowe",
  ACCEPTED: "Zaakceptowane",
  PLAYED: "Zagrane",
  REJECTED: "Odrzucone",
};

/** Filter order in the panel (board order, rejected last). */
export const EXPORT_STATUS_ORDER: readonly RequestStatus[] = ["PENDING", "ACCEPTED", "PLAYED", "REJECTED"];

const STATUS_ERROR = "Nieznany status.";

/**
 * Query of the export: `format=csv|txt` and `status`, repeated (`status=PENDING&status=PLAYED`) or comma-separated.
 * Without `status` the default filter applies; duplicates are ignored.
 */
export const exportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS, { error: "Wybierz format csv albo txt." }),
  status: z
    .array(z.string())
    .transform((values) => values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean))
    .pipe(z.array(z.enum(REQUEST_STATUSES, { error: STATUS_ERROR })))
    .transform((values) =>
      values.length === 0 ? [...DEFAULT_EXPORT_STATUSES] : REQUEST_STATUSES.filter((status) => values.includes(status)),
    ),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;

export function parseExportQuery(params: URLSearchParams) {
  return exportQuerySchema.safeParse({ format: params.get("format") ?? undefined, status: params.getAll("status") });
}

/** Panel link to the export with the chosen statuses. */
export function exportUrl(eventId: string, format: ExportFormat, statuses: readonly RequestStatus[]): string {
  const params = new URLSearchParams({ format });
  for (const status of EXPORT_STATUS_ORDER) if (statuses.includes(status)) params.append("status", status);
  return `/api/events/${encodeURIComponent(eventId)}/export?${params.toString()}`;
}

/** One exported request (a board row: vote count from the same query). */
export type ExportRow = {
  id: string;
  title: string;
  artist: string;
  status: RequestStatus;
  voteCount: number;
  createdAt: Date;
  playedAt: Date | null;
};

/** Rows with the chosen statuses, in queue order: most votes first, then the oldest request first. */
export function selectExportRows<T extends ExportRow>(rows: readonly T[], statuses: readonly RequestStatus[]): T[] {
  return rows.filter((row) => statuses.includes(row.status)).sort(compareQueue);
}

// Dates in the CSV: Polish local time (Europe/Warsaw, where the parties are), as "2026-10-24 21:05". This form is
// readable, sorts as text and Excel / LibreOffice / Google Sheets recognise it as a date-time.
const dateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(date: Date): Record<string, string> {
  return Object.fromEntries(dateParts.formatToParts(date).map((part) => [part.type, part.value]));
}

/** "2026-10-24 21:05" in Europe/Warsaw. */
export function formatExportDateTime(date: Date): string {
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** "2026-10-24": the calendar day in Europe/Warsaw. */
export function formatExportDay(date: Date): string {
  const p = partsOf(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export const CSV_HEADER = ["tytuł", "artysta", "status", "głosy", "dodano", "zagrano"] as const;
const BOM = "﻿";
const CRLF = "\r\n";

/**
 * One CSV text cell. Values a spreadsheet would run as a formula (starting with = + - @, tab or CR) get a leading
 * apostrophe ("CSV injection": a guest types the title). Cells with a comma, quote or line break are quoted, quotes
 * doubled (RFC 4180).
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The CSV file: UTF-8 BOM (so Excel reads Polish letters), Polish header, CRLF line endings. */
export function formatCsv(rows: readonly ExportRow[]): string {
  const lines = [
    CSV_HEADER.join(","),
    ...rows.map((row) =>
      [
        csvCell(row.title),
        csvCell(row.artist),
        csvCell(REQUEST_STATUS_LABELS[row.status]),
        String(row.voteCount),
        formatExportDateTime(row.createdAt),
        row.playedAt ? formatExportDateTime(row.playedAt) : "",
      ].join(","),
    ),
  ];
  return BOM + lines.join(CRLF) + CRLF;
}

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

/** Plain list to paste anywhere: "Artysta – Tytuł" per line (en dash), in the order of the rows. */
export function formatTxt(rows: readonly ExportRow[]): string {
  return rows.map((row) => `${oneLine(row.artist)} – ${oneLine(row.title)}\n`).join("");
}

/** ASCII slug of an event name: Polish letters without diacritics, anything else as dashes. */
export function slugify(name: string): string {
  const slug = name
    .replaceAll("ł", "l")
    .replaceAll("Ł", "L")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "wydarzenie";
}

/** File names of the export: an ASCII one for every client and the original (Polish) one for RFC 5987 clients. */
export function exportFileNames(eventName: string, day: string, format: ExportFormat): { ascii: string; unicode: string } {
  // Nothing that could break out of the header or a path: control characters, quotes, slashes and the like.
  const readable = oneLine(eventName.replace(/[\p{Cc}"\\/:*?<>|]/gu, " ")).slice(0, 80) || "wydarzenie";
  return { ascii: `${slugify(eventName)}-${day}.${format}`, unicode: `${readable} ${day}.${format}` };
}

/** `Content-Disposition: attachment` with an ASCII `filename` and a UTF-8 `filename*` (RFC 6266 / RFC 5987). */
export function contentDisposition(eventName: string, day: string, format: ExportFormat): string {
  const { ascii, unicode } = exportFileNames(eventName, day, format);
  const encoded = encodeURIComponent(unicode).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export const EXPORT_CONTENT_TYPES: Readonly<Record<ExportFormat, string>> = {
  csv: "text/csv; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};
