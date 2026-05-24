const prisma = require('../../config/prisma');

async function getVocabularyListWithItems(listId) {
    return await prisma.vocabularyList.findUnique({
        where: { id: listId },
        include: {
            items: {
                include: {
                    vocabulary: true
                }
            }
        }
    });
}

async function persistQuizStructure(userId, title, questions) {
    return await prisma.quiz.create({
        data: {
            userId,
            title,
            questions: {
                create: questions.map(q => {
                    // Safeguard database enums against missing formatting keys
                    let mappedType = q.type;
                    if (mappedType === 'FILL_IN_THE_BLANK') mappedType = 'FILL_BLANK';

                    return {
                        vocabularyId: q.vocabularyId,
                        type: mappedType,
                        questionText: q.questionText,
                        correctAnswer: q.correctAnswer,
                        distractors: q.options ? q.options.filter(o => o !== q.correctAnswer) : []
                    };
                })
            }
        },
        include: {
            questions: true
        }
    });
}

async function getQuizWithQuestions(quizId) {
    return await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
            questions: {
                include: {
                    vocabulary: true
                }
            }
        }
    });
}

async function createQuizAttemptPlaceholder(quizId, userId) {
    return await prisma.quizAttempt.create({
        data: {
            quizId,
            userId,
            startedAt: new Date()
        }
    });
}

async function completeQuizAttempt(attemptId, finalScore, answerRecords) {
    return await prisma.$transaction([
        // Batch persist answers tracking metrics
        prisma.quizAnswer.createMany({
            data: answerRecords.map(rec => ({
                attemptId,
                questionId: rec.questionId,
                userAnswer: rec.userAnswer,
                isCorrect: rec.isCorrect
            }))
        }),
        // Update master telemetry benchmark records
        prisma.quizAttempt.update({
            where: { id: attemptId },
            data: {
                score: finalScore,
                completedAt: new Date()
            }
        })
    ]);
}

module.exports = {
    getVocabularyListWithItems,
    persistQuizStructure,
    getQuizWithQuestions,
    createQuizAttemptPlaceholder,
    completeQuizAttempt
};