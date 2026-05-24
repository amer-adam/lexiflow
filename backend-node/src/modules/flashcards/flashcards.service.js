const flashcardsRepository = require('./flashcards.repository');
const vocabularyRepository = require('../vocabulary/vocabulary.repository');

const FSRS_W = [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14,
    0.94, 2.18, 0.05, 0.34, 1.26, 0.26, 2.05
];

function calculateFsrs(card, rating) {
    let { stability, difficulty, state } = card;
    const s0 = FSRS_W[0];
    const s1 = FSRS_W[1];
    const s2 = FSRS_W[2];
    const s3 = FSRS_W[3];
    if (card.state === 0 || stability === 0) {
        difficulty = Math.max(1, Math.min(10, FSRS_W[4] - FSRS_W[5] * (rating - 3)));
        stability = rating === 1 ? s0 : s1 + s2 * (rating - 2) + s3 * Math.pow(rating - 1, 0.5);
        state = rating === 1 ? 3 : 2;
    } else {
        const lastStability = stability;
        const retrievability = Math.pow(1 + 0.1 * (card.elapsedDays / lastStability), -1);
        difficulty = Math.max(1, Math.min(10, difficulty - FSRS_W[6] * (rating - 3)));
        if (rating === 1) {
            stability = FSRS_W[7] * Math.pow(difficulty, -FSRS_W[8]) * Math.pow(lastStability + 1, FSRS_W[9]) * Math.exp(FSRS_W[10] * (1 - retrievability));
            state = 3;
        } else {
            const hardMultiplier = rating === 2 ? FSRS_W[11] : 1.0;
            const easyMultiplier = rating === 4 ? FSRS_W[12] : 1.0;
            stability = lastStability * (1 + Math.exp(FSRS_W[13]) * (11 - difficulty) * Math.pow(lastStability, -FSRS_W[14]) * Math.exp(FSRS_W[15] * retrievability) * hardMultiplier * easyMultiplier);
            state = 2;
        }
    }
    const scheduledDays = Math.max(1, Math.min(365, Math.round(stability)));
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + scheduledDays);

    return { stability, difficulty, scheduledDays, state, nextReviewDate };
}

async function getUserDecks(userId) {
    return await flashcardsRepository.findDecksByUserId(userId);
}

async function syncListToDeck({ userId, listId, name, frontConfig, backConfig }) {
    let deck = await flashcardsRepository.findDeckByListId(listId);
    if (!deck) {
        deck = await flashcardsRepository.createDeck({
            userId,
            listId,
            name: name || "Vocabulary Deck"
        });
    }
    const listItems = await vocabularyRepository.getListItems(listId);
    await flashcardsRepository.bulkSyncCards(deck.id, listItems, frontConfig, backConfig);
    return deck;
}

async function getReviewSession(deckId) {
    return await flashcardsRepository.getOverdueCards(deckId);
}

async function submitCardReview(cardId, rating) {
    const card = await flashcardsRepository.getCardById(cardId);
    if (!card) {
        const error = new Error('Card signature reference not found');
        error.status = 404;
        throw error;
    }
    const fsrsResults = calculateFsrs(card, rating);
    return await flashcardsRepository.updateCardProgress(cardId, rating, card, fsrsResults);
}

// NEW: Service to modify presentation layout configs
async function updateDeckLayout(deckId, frontConfig, backConfig) {
    return await flashcardsRepository.updateLayoutConfigs(deckId, frontConfig, backConfig);
}

// NEW: Service to wipe memory configurations and review history logs
async function resetDeckProgress(deckId) {
    return await flashcardsRepository.resetProgressMetrics(deckId);
}

// NEW: Service to drop a deck structure entirely
async function deleteDeckProfile(deckId) {
    return await flashcardsRepository.removeDeckProfile(deckId);
}

module.exports = {
    getUserDecks,
    syncListToDeck,
    getReviewSession,
    submitCardReview,
    updateDeckLayout,
    resetDeckProgress,
    deleteDeckProfile
};