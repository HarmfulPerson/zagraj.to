import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/app";
import { HERO_TITLE } from "@/lib/site";

// Shared image for links to the landing and the pricing page (Messenger, WhatsApp, Facebook…). Generated at build time.
export const alt = `${APP_NAME}: ${HERO_TITLE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NOTE_PATH =
  "M9 17.5a2.5 2.5 0 1 1-2-2.45V5.6a1 1 0 0 1 .76-.97l9-2.25A1 1 0 0 1 18 3.35v11.15a2.5 2.5 0 1 1-2-2.45V6.03l-7 1.75z";
const HEART_PATH =
  "M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.5 3.4 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4Z";

const ROWS = [
  { title: "Przez twe oczy zielone", votes: 24 },
  { title: "Dancing Queen", votes: 17 },
  { title: "Szampan", votes: 11 },
];

export default async function OpengraphImage() {
  // Geist ships with Next.js (no network at build time) and covers Polish letters (ą, ę, ł, ż…).
  const geist = await readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 72,
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 85% 15%, rgba(139,92,246,0.45), transparent 45%), radial-gradient(circle at 10% 100%, rgba(217,70,239,0.25), transparent 40%)",
          color: "#fafafa",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: "linear-gradient(135deg, #8b5cf6, #d946ef)",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="#ffffff">
                <path d={NOTE_PATH} />
              </svg>
            </div>
            <div style={{ fontSize: 44, letterSpacing: -1 }}>{APP_NAME}</div>
          </div>
          <div style={{ display: "flex", fontSize: 64, lineHeight: 1.08, letterSpacing: -2, maxWidth: 620 }}>{HERO_TITLE}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: "#d4d4d8" }}>
            <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, backgroundColor: "#bef264", color: "#09090b" }}>
              Życzenia muzyczne z kodu QR
            </div>
            <div style={{ display: "flex" }}>Bez aplikacji dla gości</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignSelf: "center",
            width: 380,
            padding: 28,
            gap: 18,
            borderRadius: 40,
            backgroundColor: "#18181b",
            border: "2px solid #3f3f46",
          }}
        >
          <div style={{ display: "flex", fontSize: 22, color: "#a1a1aa", letterSpacing: 2 }}>LISTA ŻYCZEŃ</div>
          {ROWS.map((row, index) => (
            <div key={row.title} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  display: "flex",
                  backgroundImage: ["linear-gradient(135deg, #f59e0b, #ec4899)", "linear-gradient(135deg, #38bdf8, #8b5cf6)", "linear-gradient(135deg, #a3e635, #14b8a6)"][index],
                }}
              />
              <div style={{ display: "flex", flex: 1, fontSize: 24 }}>{row.title}</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "6px 12px",
                  borderRadius: 14,
                  backgroundColor: index === 0 ? "rgba(236,72,153,0.2)" : "#27272a",
                  color: index === 0 ? "#f9a8d4" : "#e4e4e7",
                  fontSize: 20,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={index === 0 ? "#f472b6" : "#a1a1aa"}>
                  <path d={HEART_PATH} />
                </svg>
                {row.votes}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Geist", data: geist, style: "normal", weight: 400 }] },
  );
}
