<template>
    <div class="list-view-container">
        <div class="sidebar glass-panel">
            <div class="sidebar-header">
                <h2 class="sidebar-title">SRS Decks</h2>
                <p class="sidebar-subtitle">Review configured spaced repetition flashcards</p>

                <button class="btn btn-secondary btn-block btn-sm" @click="router.push('/lists')"
                    style="margin-top: 0.75rem;">
                    ➕ Create a Deck (Vocab Lists)
                </button>
            </div>

            <div class="lists-list-wrapper">
                <h3 class="section-title">Available Flashcard Decks</h3>
                <div class="lists-grid">
                    <div v-for="deck in userDecks" :key="deck.id" class="list-card"
                        :class="{ active: activeDeck?.id === deck.id }" @click="selectDeck(deck)">
                        <div class="list-card-header">
                            <h3>{{ deck.name }}</h3>
                            <span class="badge user_created">SRS Active</span>
                        </div>
                        <div class="list-meta">
                            <span class="count">
                                🃏 {{ deck._count?.flashcards || 0 }} cards
                            </span>
                        </div>
                    </div>

                    <div v-if="userDecks.length === 0" class="empty-state-redirect-box">
                        <p>No active flashcard decks found.</p>
                        <button class="btn btn-primary btn-sm btn-block" @click="router.push('/lists')">
                            Go to Vocab Lists to Sync a Deck
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="main-content-area">
            <div v-if="activeDeck" class="active-list-view glass-panel">

                <div class="list-details-header">
                    <div class="title-section">
                        <div class="title-row">
                            <h2 class="page-title">{{ activeDeck.name }}</h2>
                            <span class="badge user_created">FSRS Core</span>
                        </div>
                        <p class="list-description">
                            Tap Start to review memory vectors scheduled for optimization today.
                        </p>
                    </div>

                    <div class="stats-badge-row">
                        <div class="stats-badge">
                            <span class="stats-num">{{ activeSessionCards.length }}</span>
                            <span class="stats-label">Due Today</span>
                        </div>
                    </div>
                </div>

                <div v-if="studyActive" class="study-arena">
                    <div v-if="activeSessionCards.length > 0 && currentCardIndex < activeSessionCards.length"
                        class="player-wrapper">

                        <div class="progress-bar-container">
                            <div class="progress-bar-fill"
                                :style="{ width: `${((currentCardIndex) / activeSessionCards.length) * 100}%` }"></div>
                            <span class="progress-text">Card {{ currentCardIndex + 1 }} of {{ activeSessionCards.length
                                }}</span>
                        </div>

                        <div class="flashcard-container" @click="isFlipped = !isFlipped">
                            <div class="flashcard-card" :class="{ flipped: isFlipped }">

                                <div class="card-face card-front">
                                    <div class="card-side-label">FRONT</div>
                                    <div class="card-content-wrapper">
                                        <h1 v-if="activeSessionCards[currentCardIndex].frontConfig?.character"
                                            class="srs-char">
                                            {{ activeSessionCards[currentCardIndex].vocabulary?.simplified }}
                                        </h1>
                                        <p v-if="activeSessionCards[currentCardIndex].frontConfig?.pinyin"
                                            class="srs-pinyin">
                                            {{ activeSessionCards[currentCardIndex].vocabulary?.pinyin }}
                                        </p>
                                        <p v-if="activeSessionCards[currentCardIndex].frontConfig?.meaning"
                                            class="srs-meaning">
                                            {{ activeSessionCards[currentCardIndex].vocabulary?.meaning }}
                                        </p>
                                        <div v-if="!hasFrontElementsVisible(activeSessionCards[currentCardIndex])"
                                            class="empty-config-warn">
                                            No front elements configured.
                                        </div>
                                    </div>
                                    <div class="tap-hint">Click anywhere on card canvas to Flip</div>
                                </div>

                                <div class="card-face card-back">
                                    <div class="card-side-label">BACK</div>
                                    <div class="card-content-wrapper">
                                        <h1 v-if="activeSessionCards[currentCardIndex].backConfig?.character"
                                            class="srs-char">
                                            {{ activeSessionCards[currentCardIndex].vocabulary?.simplified }}
                                        </h1>
                                        <p v-if="activeSessionCards[currentCardIndex].backConfig?.pinyin"
                                            class="srs-pinyin">
                                            {{ activeSessionCards[currentCardIndex].vocabulary?.pinyin }}
                                        </p>
                                        <p v-if="activeSessionCards[currentCardIndex].backConfig?.meaning"
                                            class="srs-meaning">
                                            {{ activeSessionCards[currentCardIndex].vocabulary?.meaning }}
                                        </p>
                                        <div v-if="!hasBackElementsVisible(activeSessionCards[currentCardIndex])"
                                            class="empty-config-warn">
                                            No back elements configured.
                                        </div>
                                    </div>
                                    <div class="tap-hint">Click card again to display face profile</div>
                                </div>

                            </div>
                        </div>

                        <div class="scoring-actions-bar" v-if="isFlipped">
                            <button class="btn btn-score rating-again" @click.stop="gradeCardReview(1)">
                                <span class="score-num">1</span> Again <small>Reset</small>
                            </button>
                            <button class="btn btn-score rating-hard" @click.stop="gradeCardReview(2)">
                                <span class="score-num">2</span> Hard <small>Slight</small>
                            </button>
                            <button class="btn btn-score rating-good" @click.stop="gradeCardReview(3)">
                                <span class="score-num">3</span> Good <small>Normal</small>
                            </button>
                            <button class="btn btn-score rating-easy" @click.stop="gradeCardReview(4)">
                                <span class="score-num">4</span> Easy <small>Bonus</small>
                            </button>
                        </div>
                        <div class="scoring-actions-bar justify-center" v-else>
                            <button class="btn btn-secondary reveal-btn" @click="isFlipped = true">Reveal Back Cover
                                (Spacebar)</button>
                        </div>

                    </div>

                    <div v-else class="empty-state review-complete-pane glass-panel-inner">
                        <div class="completion-icon">🎉</div>
                        <h2>Review Session Finished!</h2>
                        <p>Your dynamic structural FSRS memory stability curves have been successfully optimized and
                            written to the cloud registry.</p>
                        <button class="btn btn-primary" @click="exitStudyMode">Return to Workspace</button>
                    </div>
                </div>

                <div v-else class="dashboard-prep-arena glass-panel-inner">
                    <div class="prep-graphics">⚡</div>
                    <h3>Spaced Repetition Scheduler Ready</h3>
                    <div v-if="activeSessionCards.length === 0" class="clean-deck-notice">
                        <p>✅ <strong>Inbox Zero!</strong> Excellent work. All matching structural items inside this deck
                            remain fully balanced today.</p>
                        <button class="btn btn-secondary btn-sm" @click="startStudySession(true)">Force Practice
                            Re-run</button>
                    </div>
                    <div v-else class="ready-cta-group">
                        <p>There are currently <strong>{{ activeSessionCards.length }} items</strong> overdue and
                            waiting for immediate structural calibration reviews.</p>
                        <button class="btn btn-primary btn-lg" @click="startStudySession(false)">Initialize Active
                            Review Now</button>
                    </div>
                </div>

            </div>

            <div v-else class="no-selection glass-panel">
                <div class="no-selection-content">
                    <div class="no-selection-icon">🃏</div>
                    <h2>Flashcard Deck Selector</h2>
                    <p>Choose an initialized flashcard deck item from your left panel Framework menu to verify variables
                        or trigger your interactive daily study engine cycles.</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
const { isAuthenticated, getAccessTokenSilently } = useAuth0();

// State Variables
const userDecks = ref([]);
const activeDeck = ref(null);
const activeSessionCards = ref([]);
const currentCardIndex = ref(0);

// Study Session Toggles
const studyActive = ref(false);
const isFlipped = ref(false);

const hasFrontElementsVisible = (card) => {
    return card?.frontConfig?.character || card?.frontConfig?.pinyin || card?.frontConfig?.meaning;
};

const hasBackElementsVisible = (card) => {
    return card?.backConfig?.character || card?.backConfig?.pinyin || card?.backConfig?.meaning;
};

// Keyboard Hotkey Interceptor Review Navigation Callback Core Engine Hook
const handleKeyboardReviewNavigation = (event) => {
    if (!studyActive.value || activeSessionCards.value.length === 0 || currentCardIndex.value >= activeSessionCards.value.length) return;

    if (event.code === 'Space') {
        event.preventDefault();
        isFlipped.value = !isFlipped.value;
    } else if (isFlipped.value && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) {
        const scoreRatingMap = { 'Digit1': 1, 'Digit2': 2, 'Digit3': 3, 'Digit4': 4 };
        gradeCardReview(scoreRatingMap[event.code]);
    }
};

const fetchUserFlashcardDecks = async () => {
    try {
        if (!isAuthenticated.value) return;
        const token = await getAccessTokenSilently();
        const headers = { 'Authorization': `Bearer ${token}` };

        const response = await fetch(`${apiBase}/lexiflow/flashcards/decks`, { headers });
        if (response.ok) {
            userDecks.value = await response.json();

            // Auto-select first available deck initialization boundary if items are present
            if (userDecks.value.length > 0 && !activeDeck.value) {
                selectDeck(userDecks.value[0]);
            }
        }
    } catch (error) {
        console.error('Failed to load flashcard decks registry mapping:', error);
    }
};

const selectDeck = async (deck) => {
    activeDeck.value = deck;
    studyActive.value = false;
    activeSessionCards.value = [];
    currentCardIndex.value = 0;
    isFlipped.value = false;

    await loadReviewSessionQueue();
};

const loadReviewSessionQueue = async () => {
    if (!activeDeck.value) return;

    try {
        const token = await getAccessTokenSilently();
        const response = await fetch(`${apiBase}/lexiflow/flashcards/decks/${activeDeck.value.id}/review`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            activeSessionCards.value = await response.json();
        }
    } catch (error) {
        console.error('Failed resolving backlog review sessions lists:', error);
    }
};

const startStudySession = (forcePracticeAll = false) => {
    if (activeSessionCards.value.length === 0 && !forcePracticeAll) return;
    currentCardIndex.value = 0;
    isFlipped.value = false;
    studyActive.value = true;
};

const gradeCardReview = async (rating) => {
    const currentCard = activeSessionCards.value[currentCardIndex.value];
    if (!currentCard) return;

    try {
        const token = await getAccessTokenSilently();
        isFlipped.value = false;

        await fetch(`${apiBase}/lexiflow/flashcards/cards/${currentCard.id}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ rating })
        });

        currentCardIndex.value++;
    } catch (error) {
        console.error('Failed submitting card calibration metrics parameters score:', error);
    }
};

const exitStudyMode = async () => {
    studyActive.value = false;
    await fetchUserFlashcardDecks();
    await loadReviewSessionQueue();
};

watch(() => isAuthenticated.value, (newVal) => {
    if (newVal) fetchUserFlashcardDecks();
});

onMounted(() => {
    if (isAuthenticated.value) fetchUserFlashcardDecks();
    window.addEventListener('keydown', handleKeyboardReviewNavigation);
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyboardReviewNavigation);
});
</script>

<style scoped>
/* Inherited structural styles plus specific elements for the empty-state link action box */
.list-view-container {
    display: flex;
    height: calc(100vh - 140px);
    gap: 2rem;
    padding: 1rem 0;
    position: relative;
    z-index: 1;
    min-height: 800px;
}

.sidebar {
    width: 340px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    height: 100%;
    padding: 1.5rem;
    overflow: hidden;
}

.sidebar-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0.75rem;
}

.sidebar-title {
    font-size: 1.6rem;
    font-weight: 700;
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.25rem;
}

.sidebar-subtitle {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.btn-block {
    width: 100%;
    margin-top: 0.5rem;
}

.lists-list-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.section-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
}

.lists-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    flex: 1;
    padding-right: 4px;
}

.list-card {
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--transition);
    background: rgba(255, 255, 255, 0.02);
}

.list-card:hover {
    border-color: var(--accent-primary);
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-2px);
}

.list-card.active {
    border-color: var(--accent-primary);
    background: rgba(59, 130, 246, 0.12);
    box-shadow: var(--shadow-glow);
}

.list-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.list-card h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
}

.list-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
}

.badge {
    padding: 0.2rem 0.6rem;
    border-radius: 50px;
    font-weight: 600;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.badge.user_created {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.3);
}

.count {
    color: var(--text-muted);
}

.empty-state-redirect-box {
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    color: var(--text-muted);
    font-size: 0.9rem;
}

/* Main Content Workspace Layout Styles */
.main-content-area {
    flex: 1;
    overflow: hidden;
    height: 100%;
}

.active-list-view {
    height: 100%;
    padding: 2rem;
    display: flex;
    flex-direction: column;
}

.list-details-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 1rem;
}

.title-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.list-description {
    font-size: 0.9rem;
    color: var(--text-secondary);
}

.stats-badge-row {
    display: flex;
    gap: 1rem;
}

.stats-badge {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.5rem 1.25rem;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 90px;
}

.stats-num {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent-primary);
}

.stats-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: var(--text-muted);
}

.dashboard-prep-arena {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3rem;
    gap: 1rem;
}

.prep-graphics {
    font-size: 4rem;
    text-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}

.dashboard-prep-arena h3 {
    font-size: 1.4rem;
    color: var(--text-primary);
}

.dashboard-prep-arena p {
    max-width: 500px;
    color: var(--text-secondary);
    line-height: 1.6;
    font-size: 0.95rem;
}

.ready-cta-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
}

.btn-lg {
    padding: 0.8rem 2.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-glow);
}

.study-arena {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.player-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 0;
}

.progress-bar-container {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    height: 6px;
    border-radius: 10px;
    position: relative;
    margin-bottom: 2rem;
}

.progress-bar-fill {
    background: var(--accent-gradient);
    height: 100%;
    border-radius: 10px;
    transition: width 0.3s ease;
}

.progress-text {
    position: absolute;
    right: 0;
    top: -20px;
    font-size: 0.75rem;
    color: var(--text-muted);
}

.flashcard-container {
    width: 100%;
    max-width: 600px;
    height: 340px;
    perspective: 1000px;
    cursor: pointer;
}

.flashcard-card {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.flashcard-card.flipped {
    transform: rotateY(180deg);
}

.card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 2rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
}

.card-front {
    background: linear-gradient(135deg, rgba(20, 30, 50, 0.8), rgba(10, 15, 30, 0.9));
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.card-back {
    background: linear-gradient(135deg, rgba(15, 25, 45, 0.9), rgba(25, 40, 70, 0.8));
    transform: rotateY(180deg);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border-color: rgba(59, 130, 246, 0.3);
}

.card-side-label {
    position: absolute;
    top: 1rem;
    left: 1.5rem;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
}

.card-content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.srs-char {
    font-size: 4rem;
    font-weight: 700;
    font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    color: #ffffff;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.srs-pinyin {
    font-size: 1.6rem;
    color: var(--accent-secondary);
    font-weight: 500;
}

.srs-meaning {
    font-size: 1.2rem;
    color: var(--text-secondary);
    max-width: 480px;
    line-height: 1.4;
}

.tap-hint {
    position: absolute;
    bottom: 1rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
}

.empty-config-warn {
    color: var(--text-muted);
    font-style: italic;
    font-size: 0.9rem;
}

.scoring-actions-bar {
    display: flex;
    gap: 1rem;
    width: 100%;
    max-width: 600px;
    margin-top: 2rem;
}

.justify-center {
    justify-content: center;
}

.reveal-btn {
    padding: 0.75rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    width: 100%;
}

.btn-score {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.6rem;
    font-size: 0.9rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    gap: 0.15rem;
}

.btn-score small {
    font-size: 0.65rem;
    font-weight: 400;
    opacity: 0.7;
    text-transform: uppercase;
}

.score-num {
    font-size: 0.7rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    margin-bottom: 0.15rem;
}

.rating-again {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.4);
}

.rating-again:hover {
    background: rgba(239, 68, 68, 0.3);
}

.rating-hard {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.4);
}

.rating-hard:hover {
    background: rgba(245, 158, 11, 0.3);
}

.rating-good {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.4);
}

.rating-good:hover {
    background: rgba(59, 130, 246, 0.3);
}

.rating-easy {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.4);
}

.rating-easy:hover {
    background: rgba(16, 185, 129, 0.3);
}

.review-complete-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1.2rem;
}

.completion-icon {
    font-size: 3.5rem;
}

.no-selection {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    padding: 3rem;
    text-align: center;
}

.no-selection-content {
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.no-selection-icon {
    font-size: 4rem;
    filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.3));
}

.no-selection h2 {
    font-size: 1.8rem;
    font-weight: 600;
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

.no-selection p {
    color: var(--text-secondary);
    font-size: 0.95rem;
    line-height: 1.5;
}

@media (max-width: 950px) {
    .list-view-container {
        flex-direction: column;
        height: auto;
    }

    .sidebar {
        width: 100%;
        height: auto;
    }

    .flashcard-container {
        height: 280px;
    }

    .srs-char {
        font-size: 3rem;
    }
}
</style>