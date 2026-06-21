-- CreateTable
CREATE TABLE "UserWatchProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "currentTime" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "lastSegmentIndexSeen" INTEGER NOT NULL DEFAULT -1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserWatchProgress_userId_idx" ON "UserWatchProgress"("userId");

-- CreateIndex
CREATE INDEX "UserWatchProgress_updatedAt_idx" ON "UserWatchProgress"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserWatchProgress_userId_videoId_key" ON "UserWatchProgress"("userId", "videoId");
