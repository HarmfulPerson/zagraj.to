/** Decorative illustrations of the landing page (inline SVG and CSS only, no external images). */

const SAMPLE_REQUESTS = [
  { title: "Ona tańczy dla mnie", artist: "Weekend", likes: 31, liked: true, color: "from-fuchsia-500 to-rose-500" },
  { title: "Szampan", artist: "sanah", likes: 24, liked: true, color: "from-amber-400 to-orange-500" },
  { title: "Dancing Queen", artist: "ABBA", likes: 18, liked: false, color: "from-sky-400 to-violet-500", own: true },
  { title: "Przez twe oczy zielone", artist: "Akcent", likes: 12, liked: false, color: "from-emerald-400 to-teal-500" },
  { title: "Pokolenie", artist: "Kombii", likes: 7, liked: false, color: "from-violet-500 to-indigo-500" },
] as const;

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7.1 4.5c2 0 3.7 1.1 4.9 2.8 1.2-1.7 2.9-2.8 4.9-2.8 3.5 0 5.7 3.4 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
    </svg>
  );
}

/** A phone showing the guest wish list, sorted by likes. */
export function PhoneMock({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Telefon gościa z listą życzeń: utwory posortowane według liczby lajków"
      className={`relative w-[17rem] rounded-[2.75rem] border border-white/15 bg-zinc-900 p-2.5 shadow-2xl shadow-violet-950/60 ${className}`}
    >
      <div className="overflow-hidden rounded-[2.25rem] bg-zinc-950 ring-1 ring-white/5">
        <div className="mx-auto mt-2.5 h-5 w-24 rounded-full bg-zinc-900" />
        <div className="px-4 pt-3 pb-5">
          <p className="text-[0.65rem] font-semibold tracking-widest text-lime-300 uppercase">Lista życzeń</p>
          <p className="mt-0.5 text-base font-bold text-white">Wesele Oli i Kuby</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-zinc-400 ring-1 ring-white/10">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            Szukaj utworu lub wykonawcy
          </div>
          <ul className="mt-3 space-y-2">
            {SAMPLE_REQUESTS.map((track) => (
              <li key={track.title} className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2 ring-1 ring-white/5">
                <span className={`size-9 shrink-0 rounded-lg bg-gradient-to-br ${track.color}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">{track.title}</span>
                  <span className="flex items-center gap-1.5 truncate text-[0.65rem] text-zinc-400">
                    {track.artist}
                    {"own" in track && (
                      <span className="rounded-full bg-violet-500/20 px-1.5 text-[0.6rem] font-semibold text-violet-200">Twoje</span>
                    )}
                  </span>
                </span>
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[0.65rem] font-bold ${
                    track.liked ? "bg-fuchsia-500/20 text-fuchsia-300" : "bg-white/5 text-zinc-300"
                  }`}
                >
                  <Heart filled={track.liked} />
                  {track.likes}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const QR_SIZE = 25;

/** Decorative QR-like pattern: three finder squares and pseudo-random modules (deterministic, not a real code). */
function qrModules(): string {
  const finder = (x: number, y: number) => {
    const inX = x - (x >= QR_SIZE - 7 ? QR_SIZE - 7 : 0);
    const inY = y - (y >= QR_SIZE - 7 ? QR_SIZE - 7 : 0);
    const ring = Math.max(Math.abs(inX - 3), Math.abs(inY - 3));
    return ring !== 2 && ring <= 3;
  };
  const isFinderArea = (x: number, y: number) => (x < 8 && y < 8) || (x >= QR_SIZE - 8 && y < 8) || (x < 8 && y >= QR_SIZE - 8);
  let path = "";
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      const on = isFinderArea(x, y) ? finder(x, y) && (x < 7 || x >= QR_SIZE - 7) && (y < 7 || y >= QR_SIZE - 7) : ((x * 7 + y * 13 + x * y * 3) % 5) < 2;
      if (on) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return path;
}

const QR_PATH = qrModules();

/** A table card with a QR code, like the printed poster. */
export function QrCard({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Karta z kodem QR do zeskanowania telefonem"
      className={`w-44 rotate-[-6deg] rounded-3xl bg-white p-4 text-zinc-950 shadow-2xl shadow-black/50 ${className}`}
    >
      <p className="text-center text-[0.7rem] leading-tight font-bold">Zamów swój utwór!</p>
      <svg viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`} className="mx-auto mt-2 aspect-square w-full" shapeRendering="crispEdges">
        <path d={QR_PATH} fill="currentColor" />
      </svg>
      <p className="mt-2 text-center text-[0.6rem] text-zinc-600">Zeskanuj aparatem, bez aplikacji</p>
    </div>
  );
}
