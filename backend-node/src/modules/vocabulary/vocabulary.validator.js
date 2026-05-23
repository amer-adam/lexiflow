const { z } = require('zod');

const createListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['USER_CREATED', 'SAVED', 'SEEN', 'OFFICIAL']),
  sourceMetadata: z.any().optional(),
});

const addVocabularySchema = z.object({
  simplified: z.string().min(1, 'Simplified character is required'),
  pinyin: z.string().min(1, 'Pinyin is required'),
  meaning: z.string().min(1, 'Meaning is required'),
  traditional: z.string().optional(),
  hskLevel: z.number().int().optional(),
  sourceVideoId: z.string().optional(),
});

module.exports = {
  createListSchema,
  addVocabularySchema,
};
