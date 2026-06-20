const { z } = require('zod');

const configElementSchema = z.object({
    character: z.boolean().default(false),
    pinyin: z.boolean().default(false),
    meaning: z.boolean().default(false),
    audio: z.boolean().default(false),
});

const syncDeckSchema = z.object({
    listId: z.string().uuid('Valid source Vocabulary List ID required'),
    name: z.string().min(1, 'Deck title is required'),
    frontConfig: configElementSchema,
    backConfig: configElementSchema
});

const submitReviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
});

module.exports = {
    syncDeckSchema,
    submitReviewSchema
};