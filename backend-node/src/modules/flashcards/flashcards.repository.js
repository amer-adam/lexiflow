const prisma = require('../../config/prisma');

async function findDecksByUserId(userId) {
    return await prisma.flashcardDeck.findMany({
        where: { userId },
        include: {
            _count: { select: { flashcards: true } },
            vocabularyList: true
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
        data: {
            name,
            userId, // Connects to user table record
            listId  // Direct scalar write, or use: list: { connect: { id: listId } }
        }
    });
}

async function bulkSyncCards(deckId, listItems, frontConfig, backConfig) {
    for (const item of listItems) {
        await prisma.flashcard.upsert({
            where: {
                deckId_vocabularyId: {
                    deckId,
                    vocabularyId: item.vocabularyId
                }
            },
            update: {
                frontConfig,
                backConfig
            },
            create: {
                deckId,
                vocabularyId: item.vocabularyId,
                frontConfig,
                backConfig,
                nextReviewDate: new Date()
            }
        });
    }
}

async function getOverdueCards(deckId) {
    return await prisma.flashcard.findMany({
        where: {
            deckId,
            // nextReviewDate: { lte: new Date() }
        },
        include: {
            vocabulary: true
        },
        take: 1000 // Batch size optimization limit
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
                elapsedDays: 0, // Reset counter back down to zero base line
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

module.exports = {
    findDecksByUserId,
    findDeckByListId,
    createDeck,
    bulkSyncCards,
    getOverdueCards,
    getCardById,
    updateCardProgress
};