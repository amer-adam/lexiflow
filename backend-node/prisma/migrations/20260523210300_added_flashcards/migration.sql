/*
  Warnings:

  - You are about to drop the column `easeFactor` on the `Flashcard` table. All the data in the column will be lost.
  - You are about to drop the column `interval` on the `Flashcard` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[listId]` on the table `FlashcardDeck` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `listId` to the `FlashcardDeck` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastDifficulty` to the `FlashcardReview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastStability` to the `FlashcardReview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledDays` to the `FlashcardReview` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Flashcard" DROP COLUMN "easeFactor",
DROP COLUMN "interval",
ADD COLUMN     "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "elapsedDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stability" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "state" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FlashcardDeck" ADD COLUMN     "listId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FlashcardReview" ADD COLUMN     "lastDifficulty" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "lastStability" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "scheduledDays" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Flashcard_nextReviewDate_idx" ON "Flashcard"("nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardDeck_listId_key" ON "FlashcardDeck"("listId");

-- AddForeignKey
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_listId_fkey" FOREIGN KEY ("listId") REFERENCES "VocabularyList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
