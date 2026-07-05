const prisma = require('../../config/prisma');

async function findDecksByUserId(userId) {
    return await prisma.flashcardDeck.findMany({
        where: { userId },
        include: {
            _count: { select: { flashcards: true } },
            vocabularyList: true,
            // Needed so the deck-list view can compute due/new/in-review counts
            // and render the full deck table without a second round-trip.
            flashcards: { include: { vocabulary: true } }
        }
    });
}

async function findDeckByListId(listId) {
    return await prisma.flashcardDeck.findUnique({
        where: { listId }
    });
}

async function createDeck({ userId, listId, name }) {
    return await prisma.flashcardDeck.create({
        data: { name, userId, listId }
    });
}

async function bulkSyncCards(deckId, listItems, frontConfig, backConfig) {
    // frontConfig/backConfig are required Json columns — default them so a deck
    // can be generated without the client having to specify a card layout.
    const front = frontConfig ?? { character: true };
    const back = backConfig ?? { pinyin: true, meaning: true };
    for (const item of listItems) {
        await prisma.flashcard.upsert({
            where: {
                deckId_vocabularyId: { deckId, vocabularyId: item.vocabularyId }
            },
            update: { frontConfig: front, backConfig: back },
            create: {
                deckId,
                vocabularyId: item.vocabularyId,
                frontConfig: front,
                backConfig: back,
                nextReviewDate: new Date()
            }
        });
    }
}

async function getOverdueCards(deckId) {
    return await prisma.flashcard.findMany({
        where: { deckId, nextReviewDate: { lte: new Date() } },
        include: { vocabulary: true },
        orderBy: { nextReviewDate: 'asc' },
        take: 1000
    });
}

async function getCardById(cardId) {
    return await prisma.flashcard.findUnique({
        where: { id: cardId }
    });
}

async function updateCardProgress(cardId, rating, currentCard, fsrs) {
    return await prisma.$transaction([
        prisma.flashcard.update({
            where: { id: cardId },
            data: {
                stability: fsrs.stability,
                difficulty: fsrs.difficulty,
                state: fsrs.state,
                scheduledDays: fsrs.scheduledDays,
                elapsedDays: 0,
                nextReviewDate: fsrs.nextReviewDate
            }
        }),
        prisma.flashcardReview.create({
            data: {
                flashcardId: cardId,
                qualityScore: rating,
                lastStability: currentCard.stability,
                lastDifficulty: currentCard.difficulty,
                scheduledDays: fsrs.scheduledDays
            }
        })
    ]);
}

// NEW: Updates display parameters mapping on all items within a specific deck
async function updateLayoutConfigs(deckId, frontConfig, backConfig) {
    return await prisma.flashcard.updateMany({
        where: { deckId },
        data: { frontConfig, backConfig }
    });
}

// NEW: Transactions pipeline to revert learning metrics data state to original baseline values
async function resetProgressMetrics(deckId) {
    return await prisma.$transaction([
        // Wipe historical telemetry cards review entries
        prisma.flashcardReview.deleteMany({
            where: { flashcard: { deckId } }
        }),
        // Reset card state configurations back to new (0 values)
        prisma.flashcard.updateMany({
            where: { deckId },
            data: {
                stability: 0,
                difficulty: 0,
                state: 0,
                scheduledDays: 0,
                elapsedDays: 0,
                nextReviewDate: new Date()
            }
        })
    ]);
}

// NEW: Deletes deck cascading records entirely
async function removeDeckProfile(deckId) {
    return await prisma.$transaction([
        // Clear children metrics first to protect database relational reference limits
        prisma.flashcardReview.deleteMany({ where: { flashcard: { deckId } } }),
        prisma.flashcard.deleteMany({ where: { deckId } }),
        prisma.flashcardDeck.delete({ where: { id: deckId } })
    ]);
}

module.exports = {
    findDecksByUserId,
    findDeckByListId,
    createDeck,
    bulkSyncCards,
    getOverdueCards,
    getCardById,
    updateCardProgress,
    updateLayoutConfigs,
    resetProgressMetrics,
    removeDeckProfile
};