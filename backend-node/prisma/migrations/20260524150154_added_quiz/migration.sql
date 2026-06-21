/*
  Warnings:

  - The values [FILL_IN_THE_BLANK] on the enum `QuestionType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "QuestionType_new" AS ENUM ('MULTIPLE_CHOICE', 'FILL_BLANK', 'SHORT_ANSWER', 'TRUE_FALSE');
ALTER TABLE "QuizQuestion" ALTER COLUMN "type" TYPE "QuestionType_new" USING ("type"::text::"QuestionType_new");
ALTER TYPE "QuestionType" RENAME TO "QuestionType_old";
ALTER TYPE "QuestionType_new" RENAME TO "QuestionType";
DROP TYPE "public"."QuestionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "QuizAnswer" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "gradingScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "VocabularyListItem" ADD COLUMN     "contextSentence" TEXT,
ADD COLUMN     "contextTranslation" TEXT;
