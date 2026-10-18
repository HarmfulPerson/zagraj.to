/** Font size (in cqw of the A4 sheet) for the event name, so even a 100-character name fits in 3 lines. */
export function posterTitleSize(name: string): string {
  const length = name.trim().length;
  if (length <= 24) return "7.5cqw";
  if (length <= 48) return "6cqw";
  if (length <= 72) return "5cqw";
  return "4cqw";
}
