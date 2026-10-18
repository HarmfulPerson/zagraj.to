import bcrypt from "bcryptjs";
import { config } from "dotenv";

import { createPrismaClient } from "../lib/db-client";

// Same env resolution as prisma.config.ts, so `npx tsx prisma/seed.ts` also works.
config({ path: [".env.local", ".env"], quiet: true });

const SEED_DJ_EMAIL = "dj@example.com";
const SEED_DJ_PASSWORD = "haslo1234";
const SEED_EVENT_CODE = "WESELE";

const prisma = createPrismaClient();

const tracks = [
  { trackId: "3135556", title: "Harder, Better, Faster, Stronger", artist: "Daft Punk", durationSec: 224, guest: "guest-a", voters: ["guest-a", "guest-b", "guest-c", "guest-d"] },
  { trackId: "916424", title: "Without Me", artist: "Eminem", durationSec: 290, guest: "guest-b", voters: ["guest-b", "guest-c"] },
  { trackId: "1109731", title: "Lose Yourself", artist: "Eminem", durationSec: 326, guest: "guest-c", voters: ["guest-c", "guest-a", "guest-d"], status: "ACCEPTED" as const },
  { trackId: "65724647", title: "Bring Me To Life", artist: "Evanescence", durationSec: 235, guest: "guest-d", voters: ["guest-d"], status: "PLAYED" as const },
  { trackId: "3129775", title: "Dancing Queen", artist: "ABBA", durationSec: 231, guest: "guest-a", voters: ["guest-a"], status: "REJECTED" as const },
];

async function main() {
  const passwordHash = await bcrypt.hash(SEED_DJ_PASSWORD, 10);

  const dj = await prisma.user.upsert({
    where: { email: SEED_DJ_EMAIL },
    update: { passwordHash },
    create: { email: SEED_DJ_EMAIL, passwordHash, displayName: "DJ Demo" },
  });

  // Idempotent: recreate the demo event (requests and votes cascade).
  await prisma.event.deleteMany({ where: { code: SEED_EVENT_CODE } });

  const event = await prisma.event.create({
    data: {
      djId: dj.id,
      name: "Wesele Ani i Tomka",
      code: SEED_EVENT_CODE,
      status: "LIVE",
      requestsOpen: true,
      startsAt: new Date(),
    },
  });

  for (const t of tracks) {
    await prisma.request.create({
      data: {
        eventId: event.id,
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        durationSec: t.durationSec,
        status: t.status ?? "PENDING",
        playedAt: t.status === "PLAYED" ? new Date() : null,
        createdByGuestId: t.guest,
        votes: { create: t.voters.map((guestId) => ({ guestId })) },
      },
    });
  }

  console.log(`Seed OK: ${SEED_DJ_EMAIL} / ${SEED_DJ_PASSWORD}, event ${event.code} (LIVE), ${tracks.length} requests.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
