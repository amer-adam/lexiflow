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
                        </div>
                    </div>

                    <div class="stats-badge-row">
                        <div class="stats-badge">
                            <span class="stats-num">{{ dueTodayCount }}</span>
                            <span class="stats-label">Due Today</span>
                        </div>
                        <div class="stats-badge" v-if="studyActive">
                            <span class="stats-num text-session">{{ activeSessionCards.length - currentCardIndex
                                }}</span>
                            <span class="stats-label">Left In Session</span>
                        </div>

                        <button class="stats-badge settings-badge-btn" @click="openSettingsModal"
                            title="Deck Configuration Options">
                            <span class="stats-num emoji">⚙️</span>
                            <span class="stats-label">Settings</span>
                        </button>
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
                        <h2>Review Session Finished!</h2>
                        <p>You have successfully reviewed all scheduled items for this session.</p>
                        <button class="btn btn-primary" @click="exitStudyMode">Return to Workspace</button>
                    </div>
                </div>

                <template v-else>
                    <div class="dashboard-prep-arena glass-panel-inner">


                        <div v-if="dueTodayCount === 0" class="clean-deck-notice">
                            <p>✅ <strong>Inbox Zero!</strong> Excellent work. All matching structural items inside this
                                deck remain balanced today.</p>
                            <button class="btn btn-secondary btn-sm" @click="promptSessionSetup(true)">Force Practice
                                Re-run</button>
                        </div>

                        <div v-else class="ready-cta-group">
                            <p>There are currently <strong>{{ dueTodayCount }} items</strong> overdue and waiting for
                                your excellence.</p>

                            <div v-if="showSessionSelector" class="session-selector-card glass-panel-inner">
                                <h4>How many cards for this session?</h4>
                                <div class="session-btn-options">
                                    <button class="btn btn-secondary btn-sm" @click="startStudySession(5)">5</button>
                                    <button class="btn btn-secondary btn-sm" @click="startStudySession(10)">10</button>
                                    <button class="btn btn-secondary btn-sm" @click="startStudySession(20)">20</button>
                                    <button class="btn btn-primary btn-sm" @click="startStudySession(dueTodayCount)">All
                                        ({{ dueTodayCount }})</button>
                                </div>
                                <button class="btn btn-link btn-xs" style="margin-top: 0.5rem;"
                                    @click="showSessionSelector = false">Cancel</button>
                            </div>

                            <button v-else class="btn btn-primary btn-lg" @click="promptSessionSetup(false)">Start
                                Active Review Now</button>
                        </div>
                    </div>

                    <div class="deck-inventory-section">
                        <h3 class="section-title-inventory">Card Deck Progress Registry (All Cards)</h3>
                        <div class="table-scroll-container">
                            <table class="inventory-table">
                                <thead>
                                    <tr>
                                        <th>Vocabulary Item</th>
                                        <th>Pinyin</th>
                                        <th>FSRS State</th>
                                        <th>Stability (Days)</th>
                                        <th>Interval</th>
                                        <th>Scheduled Due Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="card in allDeckCards" :key="card.id"
                                        :class="{ 'row-due': isCardOverdue(card.nextReviewDate) }">
                                        <td class="font-bold text-white">{{ card.vocabulary?.simplified }}</td>
                                        <td class="text-secondary">{{ card.vocabulary?.pinyin }}</td>
                                        <td>
                                            <span class="state-chip" :class="'state-' + card.state">
                                                {{ getStateLabel(card.state) }}
                                            </span>
                                        </td>
                                        <td>{{ card.stability?.toFixed(2) || '0.00' }}d</td>
                                        <td>{{ card.scheduledDays }}d</td>
                                        <td class="text-sm">{{ formatReviewDate(card.nextReviewDate) }}</td>
                                        <td>
                                            <span v-if="isCardOverdue(card.nextReviewDate)"
                                                class="badge-status badge-due">Due</span>
                                            <span v-else class="badge-status badge-waiting">Waiting</span>
                                        </td>
                                    </tr>
                                    <tr v-if="allDeckCards.length === 0">
                                        <td colspan="7" class="text-center text-muted">No cards present inside this deck
                                            profile.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template>

            </div>
        </div>

        <div v-if="showSettingsModal" class="modal-backdrop" @click.self="showSettingsModal = false">
            <div class="modal-content glass-panel">
                <div class="modal-header">
                    <h3>Deck Configuration Options</h3>
                    <button class="close-btn" @click="showSettingsModal = false">✕</button>
                </div>

                <p class="modal-desc">Configure active view fields layout parameters or manage database status records.
                </p>

                <div class="modal-section">
                    <span class="config-label">Front Content View Mapping</span>
                    <div class="checkbox-group">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="settingsConfig.front.character" /> Simplified Characters
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="settingsConfig.front.pinyin" /> Hanyu Pinyin Phonetics
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="settingsConfig.front.meaning" /> English Meaning Definition
                        </label>
                    </div>
                </div>

                <div class="modal-section">
                    <span class="config-label">Back Cover View Mapping</span>
                    <div class="checkbox-group">
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="settingsConfig.back.character" /> Simplified Characters
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="settingsConfig.back.pinyin" /> Hanyu Pinyin Phonetics
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" v-model="settingsConfig.back.meaning" /> English Meaning Definition
                        </label>
                    </div>
                </div>

                <div class="modal-actions-wrapper">
                    <button class="btn btn-primary btn-sm" @click="saveDeckLayoutSettings">Save Changes</button>
                </div>

                <hr class="modal-separator" />

                <div class="modal-section danger-zone">
                    <span class="config-label text-danger">Destructive Operations Matrix</span>
                    <div class="danger-buttons-row">
                        <button class="btn btn-score rating-hard btn-block" @click="resetDeckProgress">
                            🔄 Reset Progress
                        </button>
                        <button class="btn btn-score rating-again btn-block" @click="deleteDeckProfile">
                            🗑️ Delete Deck
                        </button>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
const { isAuthenticated, getAccessTokenSilently } = useAuth0();

// State Variables
const userDecks = ref([]);
const activeDeck = ref(null);
const allDeckCards = ref([]);
const activeSessionCards = ref([]);
const currentCardIndex = ref(0);

// Study Session UI States
const studyActive = ref(false);
const isFlipped = ref(false);
const showSessionSelector = ref(false);
const isForcedPractice = ref(false);

// Settings Layout State Control Management
const showSettingsModal = ref(false);
const settingsConfig = ref({
    front: { character: true, pinyin: false, meaning: false },
    back: { character: false, pinyin: true, meaning: true }
});

// Computed Count of items genuinely due today
const dueTodayCount = computed(() => {
    const now = new Date();
    return allDeckCards.value.filter(card => new Date(card.nextReviewDate) <= now).length;
});

const hasFrontElementsVisible = (card) => {
    return card?.frontConfig?.character || card?.frontConfig?.pinyin || card?.frontConfig?.meaning;
};

const hasBackElementsVisible = (card) => {
    return card?.backConfig?.character || card?.backConfig?.pinyin || card?.backConfig?.meaning;
};

const getStateLabel = (stateNum) => {
    const states = { 0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning' };
    return states[stateNum] !== undefined ? states[stateNum] : 'New';
};

const formatReviewDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const isCardOverdue = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) <= new Date();
};

// Keyboard Hotkey Navigation Interceptor Hook
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
    showSessionSelector.value = false;
    allDeckCards.value = [];
    activeSessionCards.value = [];
    currentCardIndex.value = 0;
    isFlipped.value = false;

    await loadFullDeckInventory();
};

const loadFullDeckInventory = async () => {
    if (!activeDeck.value) return;
    try {
        const token = await getAccessTokenSilently();
        const response = await fetch(`${apiBase}/lexiflow/flashcards/decks/${activeDeck.value.id}/review`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            allDeckCards.value = await response.json();
        }
    } catch (error) {
        console.error('Failed resolving deck inventory list:', error);
    }
};

const promptSessionSetup = (forcePracticeAll = false) => {
    isForcedPractice.value = forcePracticeAll;
    if (forcePracticeAll) {
        startStudySession(allDeckCards.value.length || 5);
    } else {
        showSessionSelector.value = true;
    }
};

const startStudySession = (limitCount) => {
    showSessionSelector.value = false;
    currentCardIndex.value = 0;
    isFlipped.value = false;

    let referencePool = [...allDeckCards.value];
    if (!isForcedPractice.value) {
        const now = new Date();
        referencePool = referencePool.filter(card => new Date(card.nextReviewDate) <= now);
    }

    activeSessionCards.value = referencePool.slice(0, limitCount);

    if (activeSessionCards.value.length > 0 || isForcedPractice.value) {
        studyActive.value = true;
    }
};

const gradeCardReview = async (rating) => {
    const currentCard = activeSessionCards.value[currentCardIndex.value];
    if (!currentCard) return;

    try {
        const token = await getAccessTokenSilently();
        isFlipped.value = false;

        const response = await fetch(`${apiBase}/lexiflow/flashcards/cards/${currentCard.id}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ rating })
        });

        if (response.ok) {
            const updatedCardData = await response.json();

            const inventoryIndex = allDeckCards.value.findIndex(c => c.id === currentCard.id);
            if (inventoryIndex !== -1) {
                if (updatedCardData && updatedCardData.nextReviewDate) {
                    allDeckCards.value[inventoryIndex] = {
                        ...allDeckCards.value[inventoryIndex],
                        state: updatedCardData.state,
                        stability: updatedCardData.stability,
                        difficulty: updatedCardData.difficulty,
                        scheduledDays: updatedCardData.scheduledDays,
                        nextReviewDate: updatedCardData.nextReviewDate
                    };
                } else {
                    allDeckCards.value[inventoryIndex].nextReviewDate = new Date(Date.now() + 86400000 * 2).toISOString();
                }
            }
        }

        currentCardIndex.value++;
    } catch (error) {
        console.error('Failed submitting card calibration metrics parameters score:', error);
        currentCardIndex.value++;
    }
};

const exitStudyMode = async () => {
    studyActive.value = false;
    isForcedPractice.value = false;
    await fetchUserFlashcardDecks();
    await loadFullDeckInventory();
};

/* Settings Overlay Operational Logic Methods */
const openSettingsModal = () => {
    if (!activeDeck.value) return;

    if (allDeckCards.value.length > 0) {
        const baselineSample = allDeckCards.value[0];
        settingsConfig.value.front = {
            character: baselineSample.frontConfig?.character ?? true,
            pinyin: baselineSample.frontConfig?.pinyin ?? false,
            meaning: baselineSample.frontConfig?.meaning ?? false
        };
        settingsConfig.value.back = {
            character: baselineSample.backConfig?.character ?? false,
            pinyin: baselineSample.backConfig?.pinyin ?? true,
            meaning: baselineSample.backConfig?.meaning ?? true
        };
    }
    showSettingsModal.value = true;
};

const saveDeckLayoutSettings = async () => {
    try {
        const token = await getAccessTokenSilently();
        const response = await fetch(`${apiBase}/lexiflow/flashcards/decks/${activeDeck.value.id}/layout`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                frontConfig: settingsConfig.value.front,
                backConfig: settingsConfig.value.back
            })
        });

        if (response.ok) {
            showSettingsModal.value = false;
            await loadFullDeckInventory();
        } else {
            alert('Failed to update your deck card layout configurations template.');
        }
    } catch (error) {
        console.error('Error saving flashcard layout modifications:', error);
    }
};

const resetDeckProgress = async () => {
    if (!confirm('Are you absolutely sure you want to reset all scheduling progress parameters for this entire deck profile back to ground zero state?')) return;

    try {
        const token = await getAccessTokenSilently();
        const response = await fetch(`${apiBase}/lexiflow/flashcards/decks/${activeDeck.value.id}/reset`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showSettingsModal.value = false;
            studyActive.value = false;
            await loadFullDeckInventory();
            alert('Deck scheduling state history initialized successfully!');
        }
    } catch (error) {
        console.error('Failed to reset spaced repetition progress state:', error);
    }
};

const deleteDeckProfile = async () => {
    if (!confirm('Warning! Proceeding drops this spaced repetition deck framework layout entirely. Raw original list vocab records will remain unaffected. Proceed?')) return;

    try {
        const token = await getAccessTokenSilently();
        const response = await fetch(`${apiBase}/lexiflow/flashcards/decks/${activeDeck.value.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showSettingsModal.value = false;
            activeDeck.value = null;
            allDeckCards.value = [];
            studyActive.value = false;
            await fetchUserFlashcardDecks();
        }
    } catch (error) {
        console.error('Failed to eliminate deck resource:', error);
    }
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
/* Main Framework Flex Container */
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

/* Main Workspace View Panel */
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
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 1rem;
    margin-bottom: 0.5rem;
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
    align-items: center;
}

/* Main Stats & Button Box Container Framework */
.stats-badge {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.5rem 1.25rem;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 95px;
    height: 68px;
    /* Strict height lock to ensure true sizing equivalence across elements */
    box-sizing: border-box;
}

.stats-num {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent-primary);
    line-height: 1.2;
    text-align: center;
}

/* Specialized Settings Button Configuration */
.settings-badge-btn {
    cursor: pointer;
    transition: var(--transition);
}

.settings-badge-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent-secondary);
    box-shadow: var(--shadow-glow);
}

.settings-badge-btn:hover .emoji {
    color: #ffffff;
}

.emoji {
    color: rgba(255, 255, 255, 0.6);
    transition: color 0.2s ease;
}

.text-session {
    color: #a855f7 !important;
}

.stats-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-top: 2px;
    letter-spacing: 0.02em;
    text-align: center;
}

/* Session Selection Dialog Prompt */
.session-selector-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(168, 85, 247, 0.3);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    box-shadow: 0 4px 20px rgba(168, 85, 247, 0.15);
}

.session-selector-card h4 {
    margin: 0;
    font-size: 1.05rem;
    color: #e2e8f0;
}

.session-btn-options {
    display: flex;
    gap: 0.75rem;
}

.btn-xs {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    background: transparent;
    color: var(--text-muted);
    border: none;
    cursor: pointer;
}

.btn-xs:hover {
    color: #ffffff;
}

.dashboard-prep-arena {
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 1rem;
    flex-shrink: 0;
}

.prep-graphics {
    font-size: 3.5rem;
    text-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}

.dashboard-prep-arena h3 {
    font-size: 1.3rem;
    color: var(--text-primary);
}

.dashboard-prep-arena p {
    max-width: 500px;
    color: var(--text-secondary);
    line-height: 1.6;
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
}

.ready-cta-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
}

.btn-lg {
    padding: 0.8rem 2.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-glow);
}

/* Active Study Arena Layout */
.study-arena {
    display: flex;
    flex-direction: column;
    width: 100%;
    align-items: center;
}

.player-wrapper {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    align-items: center;
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
    height: 320px;
    perspective: 1000px;
    cursor: pointer;
}

.flashcard-card {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
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
    gap: 0.75rem;
}

.srs-char {
    font-size: 3.8rem;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.srs-pinyin {
    font-size: 1.5rem;
    color: var(--accent-secondary);
    font-weight: 500;
}

.srs-meaning {
    font-size: 1.15rem;
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

.scoring-actions-bar {
    display: flex;
    gap: 1rem;
    width: 100%;
    margin-top: 1.5rem;
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
    width: 100%;
    max-width: 600px;
}

/* Progress & Due Dates Registry Table */
.deck-inventory-section {
    margin-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 1.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.section-title-inventory {
    font-size: 1.1rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 1rem;
    flex-shrink: 0;
}

.table-scroll-container {
    width: 100%;
    overflow-y: auto;
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.15);
    flex: 1;
}

.table-scroll-container::-webkit-scrollbar {
    width: 6px;
}

.table-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}

.inventory-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    text-align: left;
    font-size: 0.88rem;
}

.inventory-table th {
    position: sticky;
    top: 0;
    background: #131d31;
    z-index: 10;
    padding: 1rem;
    color: var(--text-secondary);
    font-weight: 600;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    white-space: nowrap;
}

.inventory-table td {
    padding: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    color: var(--text-secondary);
    vertical-align: middle;
}

.inventory-table tr:hover {
    background: rgba(255, 255, 255, 0.03);
}

.row-due {
    background: rgba(239, 68, 68, 0.02);
}

.row-due:hover {
    background: rgba(239, 68, 68, 0.04) !important;
}

.font-bold {
    font-weight: 600;
}

.text-white {
    color: #ffffff !important;
}

.text-center {
    text-align: center;
}

/* Modals Overlay Configurations Styles */
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    z-index: 999;
    display: flex;
    justify-content: center;
    align-items: center;
}

.modal-content {
    width: 440px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-lg);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: #ffffff;
}

.close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.1rem;
    cursor: pointer;
}

.close-btn:hover {
    color: #ffffff;
}

.modal-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: -0.5rem;
    line-height: 1.4;
}

.modal-section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}

.config-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 0.05em;
}

.checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.02);
    padding: 0.75rem;
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.88rem;
    color: var(--text-secondary);
    cursor: pointer;
}

.checkbox-label input {
    cursor: pointer;
}

.modal-actions-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.25rem;
}

.modal-separator {
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin: 0.25rem 0;
}

.danger-zone {
    background: rgba(239, 68, 68, 0.03);
    padding: 1rem;
    border-radius: var(--radius-md);
    border: 1px dashed rgba(239, 68, 68, 0.2);
}

.text-danger {
    color: #ef4444 !important;
}

.danger-buttons-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.25rem;
}

.danger-buttons-row .btn {
    margin-top: 0;
    flex-direction: row;
    justify-content: center;
    padding: 0.5rem;
    font-size: 0.82rem;
}

/* Table Inner Chip Assets */
.state-chip {
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
}

.state-0 {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.2);
}

.state-1 {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.2);
}

.state-2 {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.2);
}

.state-3 {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.2);
}

.badge-status {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
}

.badge-due {
    background: #ef4444;
    color: #ffffff;
}

.badge-waiting {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-muted);
}

/* No Selection State View */
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
}
</style>