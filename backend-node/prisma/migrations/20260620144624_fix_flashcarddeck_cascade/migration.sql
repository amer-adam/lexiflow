-- DropForeignKey
ALTER TABLE "FlashcardDeck" DROP CONSTRAINT "FlashcardDeck_listId_fkey";

-- AddForeignKey
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_listId_fkey" FOREIGN KEY ("listId") REFERENCES "VocabularyList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
