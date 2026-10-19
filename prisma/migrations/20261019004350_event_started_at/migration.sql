-- AlterTable
ALTER TABLE "Event" ADD COLUMN "posterText" TEXT;
ALTER TABLE "Event" ADD COLUMN "startedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Event_djId_startedAt_idx" ON "Event"("djId", "startedAt");
