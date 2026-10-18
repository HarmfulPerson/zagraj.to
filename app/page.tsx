import { APP_NAME, APP_TAGLINE } from "@/lib/app";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">{APP_NAME}</h1>
      <p className="max-w-md text-lg opacity-80">{APP_TAGLINE}</p>
    </main>
  );
}
