-- CreateTable
CREATE TABLE "SegmentCorrection" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "characters" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SegmentCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SegmentCorrection_videoId_idx" ON "SegmentCorrection"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentCorrection_videoId_segmentIndex_key" ON "SegmentCorrection"("videoId", "segmentIndex");
