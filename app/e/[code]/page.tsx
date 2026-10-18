import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { GuestEventLive } from "@/components/guest/GuestEventLive";
import { ClockIcon, GuestMessage, MoonIcon } from "@/components/guest/GuestMessage";
import { isValidEventCode, normalizeEventCode } from "@/lib/event-code";
import { GUEST_ID_COOKIE_NAME, parseGuestId } from "@/lib/guest";
import { countGuestRequests, findGuestEvent, listGuestRequests } from "@/lib/requests";

// Rendered per request and allowed to block: the event lookup decides between the page and a real 404
// before anything streams. The guest id cookie is issued by proxy.ts.
export const instant = false;

export default async function GuestEventPage({ params }: PageProps<"/e/[code]">) {
  const code = normalizeEventCode((await params).code);
  const event = isValidEventCode(code) ? await findGuestEvent(code) : null;
  if (!event) notFound();

  if (event.status === "DRAFT") {
    return (
      <GuestMessage icon={ClockIcon} eyebrow={event.name} title="Impreza jeszcze się nie zaczęła" testId="guest-not-started">
        <p>DJ jeszcze nie otworzył listy życzeń. Zajrzyj tu za chwilę, ten sam link zadziała.</p>
      </GuestMessage>
    );
  }
  if (event.status === "CLOSED") {
    return (
      <GuestMessage icon={MoonIcon} eyebrow={event.name} title="Impreza zakończona" testId="guest-closed">
        <p>Dziękujemy za wspólną zabawę i wszystkie muzyczne życzenia!</p>
      </GuestMessage>
    );
  }

  const guestId = parseGuestId((await cookies()).get(GUEST_ID_COOKIE_NAME)?.value);
  const [mine, used] = guestId
    ? await Promise.all([listGuestRequests(event.id, guestId), countGuestRequests(event.id, guestId)])
    : [[], 0];

  return (
    <GuestEventLive
      code={event.code}
      name={event.name}
      requestsOpen={event.requestsOpen}
      maxRequests={event.maxRequestsPerGuest}
      initialUsed={used}
      initialMine={mine}
    />
  );
}
