const flashcardsService = require('./flashcards.service');
const { submitReviewSchema } = require('./flashcards.validator');

async function getUserDecks(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const data = await flashcardsService.getUserDecks(userId);
        res.json(data);
    } catch (error) { next(error); }
}

async function syncListToDeck(req, res, next) {
    try {
        const userId = req.userId;
        const { listId, name, frontConfig, backConfig } = req.body;

        if (!listId) {
            return res.status(400).json({ error: "Missing required field: listId" });
        }

        const result = await flashcardsService.syncListToDeck({
            userId,
            listId,
            name,
            frontConfig,
            backConfig
        });
        return res.status(200).json(result);
    } catch (error) { next(error); }
}

async function getReviewSession(req, res, next) {
    try {
        const { deckId } = req.params;
        const items = await flashcardsService.getReviewSession(deckId);
        res.json(items);
    } catch (error) { next(error); }
}

async function submitCardReview(req, res, next) {
    try {
        const { cardId } = req.params;
        const { rating } = submitReviewSchema.parse(req.body);
        const updated = await flashcardsService.submitCardReview(cardId, rating);
        res.json(updated);
    } catch (error) { next(error); }
}

// NEW: Layout configuration payload processor
async function updateDeckLayout(req, res, next) {
    try {
        const { deckId } = req.params;
        const { frontConfig, backConfig } = req.body;
        const result = await flashcardsService.updateDeckLayout(deckId, frontConfig, backConfig);
        res.json(result);
    } catch (error) { next(error); }
}

// NEW: Progress state initializer hook controller
async function resetDeckProgress(req, res, next) {
    try {
        const { deckId } = req.params;
        const result = await flashcardsService.resetDeckProgress(deckId);
        res.json(result);
    } catch (error) { next(error); }
}

// NEW: Deck execution removal endpoint mapping
async function deleteDeckProfile(req, res, next) {
    try {
        const { deckId } = req.params;
        const result = await flashcardsService.deleteDeckProfile(deckId);
        res.json(result);
    } catch (error) { next(error); }
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