const { z } = require('zod');

const createQuizSchema = z.object({
    vocabularyListId: z.string().min(1, 'Vocabulary list identifier is required'),
    count: z.number().int().min(1).default(10),
    allowedTypes: z.array(
        z.enum([
            'MULTIPLE_CHOICE',
            'FILL_BLANK',          // Accept short enum variant
            'FILL_IN_THE_BLANK',   // Keep for backwards compatibility if needed
            'SHORT_ANSWER',
            'TRUE_FALSE'           // Add your new question variant type
        ])
    ).min(1, 'At least one quiz question mode type is required')
});

const submitAttemptSchema = z.object({
    answers: z.array(z.object({
        questionId: z.string().uuid('Valid parent question target ID required'),
        userAnswer: z.string().min(1, 'Answer text entry cannot be empty')
    })).min(1, 'Provide at least one answer record entry')
});

module.exports = {
    createQuizSchema,
    submitAttemptSchema
};