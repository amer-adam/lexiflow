const axios = require('axios');
const quizzesRepository = require('./quizzes.repository');
const env = require('../../config/env');
const workerRouter = require('../../services/workerRouter');


async function generateNewUserQuiz({ userId, listId, count, allowedTypes }) {
    const listData = await quizzesRepository.getVocabularyListWithItems(listId);
    if (!listData) {
        const err = new Error('Target vocabulary list reference structural record missing');
        err.status = 404;
        throw err;
    }

    // Map database entries into standard format schemas
    const targetItemsPayload = listData.items.map(item => ({
        id: item.vocabulary.id,
        vocabularyListItemId: item.id,
        simplified: item.vocabulary.simplified,
        pinyin: item.vocabulary.pinyin,
        meaning: item.vocabulary.meaning,
        contextSentence: item.contextSentence || "",
        contextTranslation: item.contextTranslation || ""
    }));

    // Map layout parameters accurately to match FastAPI engines
    const mappedTypes = allowedTypes.map(t => t === 'FILL_IN_THE_BLANK' ? 'FILL_BLANK' : t);


    const activeUrl = workerRouter.getActiveWorkerUrl() || env.PYTHON_API;


    // Send request to Python Deep Learning layer
    const response = await axios.post(`${activeUrl}/quiz/generate`, {
        vocab_items: targetItemsPayload,
        count: parseInt(count, 10),
        allowed_types: mappedTypes
    });


    console.log(response.data, "response")

    const rawQuestions = response.data;

    // Re-map internal ID trackers safely before database execution passes
    const preparedQuestions = rawQuestions.map(q => {
        const matchedItem = listData.items.find(i => i.vocabulary.simplified === q.word);
        return {
            vocabularyId: matchedItem ? matchedItem.vocabulary.id : q.vocabListItemId,
            type: q.type,
            questionText: q.question_text,
            correctAnswer: q.correct_answer,
            options: q.options
        };
    });

    const title = `Quiz on list: ${listData.name}`;
    const completeQuizRecord = await quizzesRepository.persistQuizStructure(userId, title, preparedQuestions);

    // Strip true answers from client package objects to prevent cheating.
    // Only MULTIPLE_CHOICE/TRUE_FALSE should carry an `options` array — the
    // frontend renders a button grid whenever options is non-empty, falling
    // back to a free-text input otherwise. `q.distractors` is `[]` (not
    // null) for FILL_BLANK/SHORT_ANSWER, and `[] ? a : b` is always truthy
    // in JS, so the old code appended just the correct answer as a
    // single-button "options" array for every question type — making every
    // non-MCQ question render as a (broken, one-button) multiple choice UI.
    return {
        id: completeQuizRecord.id,
        title: completeQuizRecord.title,
        createdAt: completeQuizRecord.createdAt,
        questions: completeQuizRecord.questions.map(q => {
            let options = [];
            if (q.type === 'MULTIPLE_CHOICE') {
                options = [...(q.distractors ?? []), q.correctAnswer].sort();
            } else if (q.type === 'TRUE_FALSE') {
                options = ['TRUE', 'FALSE'];
            }
            return { id: q.id, type: q.type, questionText: q.questionText, options };
        })
    };
}

async function gradeUserAttempt(quizId, userId, submittedAnswers) {
    const quiz = await quizzesRepository.getQuizWithQuestions(quizId);
    if (!quiz) {
        const err = new Error('Target quiz instance reference profile missing');
        err.status = 404;
        throw err;
    }

    const attemptPlaceholder = await quizzesRepository.createQuizAttemptPlaceholder(quizId, userId);
    const detailedAnswerRecords = [];
    let correctHitsCount = 0;

    for (const question of quiz.questions) {
        const userSubmission = submittedAnswers.find(ans => ans.questionId === question.id);
        const rawAnswerText = userSubmission ? userSubmission.userAnswer.trim() : "";

        let isCorrect = false;

        if (question.type === 'SHORT_ANSWER') {
            try {
                // Query SBERT model cluster directly to parse acceptable variances
                const activeUrl = workerRouter.getActiveWorkerUrl() || env.PYTHON_API;
                const judgeResponse = await axios.post(`${activeUrl}/quiz/evaluate`, {
                    correct_reference: question.correctAnswer,
                    user_response: rawAnswerText
                });
                isCorrect = judgeResponse.data.is_correct;
            } catch (e) {
                // String backup handling to maintain system stability under load
                isCorrect = (rawAnswerText.toLowerCase() === question.correctAnswer.toLowerCase());
            }
        } else {
            // Standard exact evaluation paths for discrete structural modules
            isCorrect = (rawAnswerText.toLowerCase() === question.correctAnswer.toLowerCase());
        }

        if (isCorrect) correctHitsCount++;
        detailedAnswerRecords.push({
            questionId: question.id,
            questionText: question.questionText,
            correctAnswer: question.correctAnswer,
            userAnswer: rawAnswerText,
            isCorrect: isCorrect
        });
    }

    const finalPercentageScore = (correctHitsCount / quiz.questions.length) * 100.0;
    await quizzesRepository.completeQuizAttempt(attemptPlaceholder.id, finalPercentageScore, detailedAnswerRecords);

    return {
        attemptId: attemptPlaceholder.id,
        quizId: quiz.id,
        score: finalPercentageScore,
        totalQuestions: quiz.questions.length,
        correctCount: correctHitsCount,
        breakdown: detailedAnswerRecords
    };
}

module.exports = {
    generateNewUserQuiz,
    gradeUserAttempt
};