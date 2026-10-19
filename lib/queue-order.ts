/** Ordering shared by the guest queue and the DJ board. Pure, so client components can import it. */

/** The fields `compareQueue` orders by. */
export type QueueSortable = { id: string; createdAt: Date; voteCount: number };

/** Queue order: most votes first; ties by the older request first (it waited longer); then by id for stability. */
export function compareQueue(a: QueueSortable, b: QueueSortable): number {
  return (
    b.voteCount - a.voteCount ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
