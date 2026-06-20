const prisma = require('../../config/prisma');

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Counts that drive the dashboard's daily-activity summary: new words seen
 * (added to a non-official list), flashcard reviews, and completed quizzes —
 * for today and all time. Official HSK reference lists are excluded since
 * they aren't something the user "did" today.
 */
async function getSummary(userId) {
  const since = startOfTodayUTC();

  const [
    wordsSeenToday, wordsSeenAllTime,
    wordsReviewedToday, wordsReviewedAllTime,
    quizzesTakenToday, quizzesTakenAllTime,
  ] = await Promise.all([
    prisma.vocabularyListItem.count({
      where: { list: { userId, type: { not: 'OFFICIAL' } }, addedAt: { gte: since } },
    }),
    prisma.vocabularyListItem.count({
      where: { list: { userId, type: { not: 'OFFICIAL' } } },
    }),
    prisma.flashcardReview.count({
      where: { flashcard: { deck: { userId } }, reviewedAt: { gte: since } },
    }),
    prisma.flashcardReview.count({
      where: { flashcard: { deck: { userId } } },
    }),
    prisma.quizAttempt.count({
      where: { userId, completedAt: { not: null, gte: since } },
    }),
    prisma.quizAttempt.count({
      where: { userId, completedAt: { not: null } },
    }),
  ]);

  return {
    today: { wordsSeen: wordsSeenToday, wordsReviewed: wordsReviewedToday, quizzesTaken: quizzesTakenToday },
    allTime: { wordsSeen: wordsSeenAllTime, wordsReviewed: wordsReviewedAllTime, quizzesTaken: quizzesTakenAllTime },
  };
}

module.exports = { getSummary };
