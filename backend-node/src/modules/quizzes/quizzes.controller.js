const quizzesService = require('./quizzes.service');
const { createQuizSchema, submitAttemptSchema } = require('./quizzes.validator');

async function createQuizSession(req, res, next) {
    try {
        const validatedBody = createQuizSchema.parse(req.body);
        const userId = req.userId; // Provided via standard authMiddleware injection pipelines

        const quizPackage = await quizzesService.generateNewUserQuiz({
            userId,
            listId: validatedBody.vocabularyListId,
            count: validatedBody.count,
            allowedTypes: validatedBody.allowedTypes
        });

        return res.status(201).json(quizPackage);
    } catch (error) {
        next(error);
    }
}

async function submitQuizSessionAttempt(req, res, next) {
    try {
        const { quizId } = req.params;
        const validatedBody = submitAttemptSchema.parse(req.body);
        const userId = req.userId;

        const gradingReport = await quizzesService.gradeUserAttempt(
            quizId,
            userId,
            validatedBody.answers
        );

        return res.status(200).json(gradingReport);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createQuizSession,
    submitQuizSessionAttempt
};