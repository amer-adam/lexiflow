const prisma = require('../../config/prisma');

/**
 * Permanently delete a user and everything they own. Most domain tables
 * (VocabularyList, FlashcardDeck, Quiz, QuizAttempt, ...) cascade from the
 * User row via onDelete: Cascade. UserWatchProgress has no FK relation
 * declared, so it's cleared explicitly first to avoid orphaned rows.
 */
async function deleteAccount(userId) {
  await prisma.userWatchProgress.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

module.exports = { deleteAccount };
