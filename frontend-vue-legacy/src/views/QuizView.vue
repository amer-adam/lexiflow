<script setup>
import { ref, onMounted, computed, markRaw } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';

// Import split modular sub-components
import MultipleChoiceVariant from '../components/quiz/MultipleChoiceVariant.vue';
import FillBlankVariant from '../components/quiz/FillBlankVariant.vue';
import ShortAnswerVariant from '../components/quiz/ShortAnswerVariant.vue';
import TrueFalseVariant from '../components/quiz/TrueFalseVariant.vue';

// Configuration & UI States
const vocabLists = ref([]);
const selectedListId = ref('');
const questionCount = ref(10);
const selectedTypes = ref(['MULTIPLE_CHOICE', 'FILL_BLANK', 'TRUE_FALSE', 'SHORT_ANSWER']);

const isLoading = ref(false);
const isSubmitting = ref(false);
const activeQuizQuestions = ref([]);
const isQuizActive = ref(false);
const currentQuestionIndex = ref(0);
const quizCompleted = ref(false);

// State binding for active answer collection
const currentQuizId = ref('');
const userAnswers = ref([]);
const currentAnswer = ref('');
const scoreRecords = ref([]);
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
const { isAuthenticated, getAccessTokenSilently } = useAuth0();

onMounted(async () => {
    try {
        const headers = {};
        if (isAuthenticated.value) {
            const token = await getAccessTokenSilently();
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            return;
        }
        const response = await fetch(`${apiBase}/lexiflow/lists`, { headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        vocabLists.value = await response.json();
        if (vocabLists.value.length > 0) {
            selectedListId.value = vocabLists.value[0].id;
        }
    } catch (err) {
        console.error('Failed to parse system vocab lists:', err);
    }
});

const currentQuestion = computed(() => {
    if (!activeQuizQuestions.value || !activeQuizQuestions.value.length) return null;
    return activeQuizQuestions.value[currentQuestionIndex.value];
});

// Defensive fallback lookup helper to prevent "undefined" layout text strings
const computedQuestionText = computed(() => {
    if (!currentQuestion.value) return '';
    return currentQuestion.value.question_text || currentQuestion.value.questionText || '';
});

const variantComponentMap = {
    'MULTIPLE_CHOICE': markRaw(MultipleChoiceVariant),
    'FILL_BLANK': markRaw(FillBlankVariant),
    'SHORT_ANSWER': markRaw(ShortAnswerVariant),
    'TRUE_FALSE': markRaw(TrueFalseVariant)
};

async function handleGenerateQuiz() {
    if (!selectedListId.value || !selectedTypes.value.length) {
        alert('Please pick a list and at least one question format type.');
        return;
    }

    isLoading.value = true;
    quizCompleted.value = false;
    isQuizActive.value = false;

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (isAuthenticated.value) {
            const token = await getAccessTokenSilently();
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            return;
        }
        const res = await fetch(`${apiBase}/lexiflow/quizzes/generate`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                vocabularyListId: selectedListId.value,
                count: questionCount.value,
                allowedTypes: selectedTypes.value
            })
        });

        if (!res.ok) throw new Error('Quiz endpoint error context');
        const data = await res.json();

        currentQuizId.value = data.id || '';
        activeQuizQuestions.value = data.questions || [];
        if (activeQuizQuestions.value.length > 0) {
            currentQuestionIndex.value = 0;
            scoreRecords.value = [];
            userAnswers.value = [];
            currentAnswer.value = '';
            isQuizActive.value = true;
        } else {
            alert('No questions could be compiled from the selected candidate list.');
        }
    } catch (err) {
        console.error('Quiz Generation Failure:', err);
        alert('Error running AI distractor matrix engine.');
    } finally {
        isLoading.value = false;
    }
}

async function submitAnswer() {
    if (!currentQuestion.value || isSubmitting.value) return;

    const ans = String(currentAnswer.value || '');
    if (ans.trim() === '' && (currentQuestion.value.type === 'MULTIPLE_CHOICE' || currentQuestion.value.type === 'TRUE_FALSE')) {
        alert('Please select an option before checking.');
        return;
    }

    userAnswers.value.push({
        questionId: currentQuestion.value.id,
        userAnswer: ans
    });

    if (currentQuestionIndex.value + 1 < activeQuizQuestions.value.length) {
        currentQuestionIndex.value++;
        currentAnswer.value = '';
    } else {
        isSubmitting.value = true;
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (isAuthenticated.value) {
                const token = await getAccessTokenSilently();
                headers['Authorization'] = `Bearer ${token}`;
            } else {
                return;
            }
            const res = await fetch(`${apiBase}/lexiflow/quizzes/${currentQuizId.value}/submit`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    answers: userAnswers.value
                })
            });

            if (!res.ok) throw new Error('Quiz endpoint error context');
            const data = await res.json();

            scoreRecords.value = data.breakdown || [];
            isQuizActive.value = false;
            quizCompleted.value = true;
        } catch (err) {
            console.error('Quiz Submission/Grading Failure:', err);
            alert('Failed to submit and grade the quiz. Please try again.');
        } finally {
            isSubmitting.value = false;
        }
    }
}

const accurateCount = computed(() => scoreRecords.value.filter(r => r.isCorrect).length);
</script>

<template>
    <div class="quiz-view-container">
        <div class="sidebar glass-panel">
            <div class="sidebar-header">
                <h2 class="sidebar-title">Quiz Factory</h2>
                <p class="sidebar-subtitle">Configure specialized review tests</p>
            </div>

            <div class="settings-form">
                <div class="form-group">
                    <label class="form-label">Target Lexicon Vocabulary List</label>
                    <select v-model="selectedListId" class="form-input" :disabled="isQuizActive">
                        <option v-for="list in vocabLists" :key="list.id" :value="list.id">
                            {{ list.name }} ({{ list._count?.items || list.items?.length || 0 }} words)
                        </option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Question Count Threshold: {{ questionCount }}</label>
                    <input type="range" min="5" max="30" step="5" v-model.number="questionCount" class="range-slider"
                        :disabled="isQuizActive" />
                </div>

                <div class="form-group">
                    <label class="form-label">Active Structural Variants</label>
                    <div class="checkbox-group">
                        <label class="checkbox-label">
                            <input type="checkbox" value="MULTIPLE_CHOICE" v-model="selectedTypes"
                                :disabled="isQuizActive" />
                            <span>Multiple Choice (MCQ Variant Matrix)</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" value="FILL_BLANK" v-model="selectedTypes"
                                :disabled="isQuizActive" />
                            <span>Fill in the Blank (Cloze / Pinyin Recall)</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" value="SHORT_ANSWER" v-model="selectedTypes"
                                :disabled="isQuizActive" />
                            <span>Short Answer (Translation Parsing)</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" value="TRUE_FALSE" v-model="selectedTypes"
                                :disabled="isQuizActive" />
                            <span>True / False (Smart Distractors Engine)</span>
                        </label>
                    </div>
                </div>

                <button @click="handleGenerateQuiz" class="btn btn-primary btn-block" :disabled="isLoading">
                    <span v-if="isLoading">Compiling Variants...</span>
                    <span v-else>⚡ Generate Smart Quiz</span>
                </button>

                <button v-if="isQuizActive" @click="isQuizActive = false; quizCompleted = false;"
                    class="btn btn-secondary btn-block fallback-abort">
                    Abort Session
                </button>
            </div>
        </div>

        <div class="main-workspace">
            <div v-if="!isQuizActive && !quizCompleted" class="arena-card glass-panel center-align-fallback">
                <div class="welcome-icon">🎯</div>
                <h2>Ready to Validate Recall?</h2>
                <p>Pick a source list from the configuration sidebar, customize your parameters, and initialize your
                    quiz session.</p>
            </div>

            <div v-if="isQuizActive && currentQuestion" class="arena-card glass-panel">
                <div class="arena-header">
                    <span class="badge badge-info">{{ currentQuestion.type }}</span>
                    <span class="progress-indicator">Question {{ currentQuestionIndex + 1 }} of {{
                        activeQuizQuestions.length }}</span>
                </div>

                <div class="progress-bar-container">
                    <div class="progress-bar-fill"
                        :style="{ width: ((currentQuestionIndex) / activeQuizQuestions.length) * 100 + '%' }"></div>
                </div>

                <div class="question-body">
                    <p class="question-text-rendering">{{ computedQuestionText }}</p>
                </div>

                <component :is="variantComponentMap[currentQuestion.type]" v-model="currentAnswer"
                    :question="currentQuestion" @submit="submitAnswer" />

                <div class="arena-footer">
                    <button @click="submitAnswer" class="btn btn-success btn-wide align-right-action">
                        {{ currentQuestionIndex + 1 === activeQuizQuestions.length ? 'Finish Quiz' : 'Next Question ➜'
                        }}
                    </button>
                </div>
            </div>

            <div v-if="quizCompleted" class="arena-card glass-panel">
                <div class="results-summary text-center">
                    <div class="trophy-icon">🏆</div>
                    <h2>Session Completed!</h2>
                    <div class="score-callout">
                        <span class="score-num">{{ accurateCount }}</span> / {{ scoreRecords.length }} Correct
                    </div>
                    <p class="score-percentage-text">Accuracy rating: {{ Math.round((accurateCount /
                        scoreRecords.length) * 100) }}%</p>
                </div>

                <h3 class="breakdown-title">Itemized History Logs</h3>
                <div class="history-scroll-list">
                    <div v-for="(record, rIdx) in scoreRecords" :key="rIdx"
                        :class="['history-item', record.isCorrect ? 'border-success' : 'border-danger']">
                        <div class="history-item-header">
                            <span :class="['result-pill', record.isCorrect ? 'bg-success' : 'bg-danger']">
                                {{ record.isCorrect ? '✓ Correct' : '✗ Incorrect' }}
                            </span>
                        </div>
                        <p class="history-question-context"><strong>Prompt:</strong> {{ record.questionText }}</p>
                        <div class="comparison-row">
                            <p><strong>Your Input:</strong> <span
                                    :class="record.isCorrect ? 'text-success' : 'text-danger'">{{ record.userAnswer ||
                                        '[No Entry]' }}</span></p>
                            <p v-if="!record.isCorrect"><strong>Correct Answer:</strong> <span
                                    class="text-success-bold">{{ record.correctAnswer }}</span></p>
                        </div>
                    </div>
                </div>

                <button @click="quizCompleted = false" class="btn btn-primary btn-wide margin-top-auto">
                    Restart Configuration
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.quiz-view-container {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 2rem;
    width: 100%;
    min-height: calc(100vh - 120px);
    align-items: start;
}

@media (max-width: 992px) {
    .quiz-view-container {
        grid-template-columns: 1fr;
    }
}

.sidebar {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.sidebar-header {
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    padding-bottom: 1rem;
}

.sidebar-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-bright, #ffffff);
}

.sidebar-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted, #aaaaaa);
    margin-top: 0.25rem;
}

.settings-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal, #dddddd);
}

.form-input {
    width: 100%;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: white;
    font-size: 0.95rem;
}

.range-slider {
    width: 100%;
    accent-color: var(--primary-color, #4f46e5);
    cursor: pointer;
}

.checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    background: rgba(0, 0, 0, 0.15);
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-normal, #cccccc);
    cursor: pointer;
}

.fallback-abort {
    margin-top: 0.5rem;
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
}

.fallback-abort:hover {
    background: rgba(239, 68, 68, 0.4);
}

.main-workspace {
    width: 100%;
}

.arena-card {
    padding: 2.5rem;
    min-height: 480px;
    display: flex;
    flex-direction: column;
}

.center-align-fallback {
    align-items: center;
    justify-content: center;
    text-align: center;
}

.welcome-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
}

.arena-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.progress-indicator {
    font-size: 0.9rem;
    color: var(--text-muted, #a3a3a3);
}

.progress-bar-container {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    margin-bottom: 2.5rem;
    overflow: hidden;
}

.progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #4f46e5, #06b6d4);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.question-body {
    margin-bottom: 2rem;
    flex-grow: 1;
}

.question-text-rendering {
    font-size: 1.4rem;
    line-height: 1.6;
    color: var(--text-bright, #ffffff);
    white-space: pre-wrap;
}

.arena-footer {
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 1.5rem;
}

.results-summary {
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 2rem;
}

.trophy-icon {
    font-size: 3.5rem;
    margin-bottom: 0.5rem;
}

.score-callout {
    font-size: 2.2rem;
    font-weight: 800;
    margin: 0.5rem 0;
    color: var(--text-bright, #ffffff);
}

.score-num {
    color: #10b981;
}

.score-percentage-text {
    color: var(--text-muted, #a3a3a3);
    font-size: 1rem;
}

.breakdown-title {
    font-size: 1.2rem;
    margin-bottom: 1rem;
}

.history-scroll-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 0.5rem;
    margin-bottom: 2rem;
}

.history-item {
    background: rgba(0, 0, 0, 0.2);
    border-left: 4px solid transparent;
    padding: 1.25rem;
    border-radius: 0 6px 6px 0;
}

.border-success {
    border-left-color: #10b981;
}

.border-danger {
    border-left-color: #ef4444;
}

.history-item-header {
    margin-bottom: 0.5rem;
}

.result-pill {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-weight: 700;
}

.bg-success {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
}

.bg-danger {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
}

.history-question-context {
    font-size: 0.95rem;
    color: #e5e5e5;
    margin-bottom: 0.75rem;
    line-height: 1.4;
}

.comparison-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    font-size: 0.88rem;
}

.text-success {
    color: #34d399;
}

.text-danger {
    color: #f87171;
}

.text-success-bold {
    color: #10b981;
    font-weight: 600;
}

.margin-top-auto {
    margin-top: auto;
}
</style>