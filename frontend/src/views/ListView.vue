<template>
  <div>
    <div class="list-view-container">
      <div class="sidebar glass-panel">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Vocab Lists</h2>
          <p class="sidebar-subtitle">Manage your HSK and custom word lists</p>
        </div>

        <div class="create-list-box glass-panel-inner">
          <h3 class="form-title">Create New List</h3>
          <div class="create-list-form">
            <input v-model="newListName" type="text" placeholder="List name..." class="input-base"
              @keyup.enter="createList" />
            <button class="btn btn-primary btn-block" @click="createList" :disabled="!newListName.trim()">
              Create List
            </button>
          </div>
        </div>

        <div class="lists-list-wrapper">
          <h3 class="section-title">Your Lists</h3>
          <div class="lists-grid">
            <div v-for="list in sortedLists" :key="list.id" class="list-card"
              :class="{ active: activeList?.id === list.id }" @click="selectList(list)">
              <div class="list-card-header">
                <h3>{{ list.name }}</h3>
                <span class="badge" :class="list.type.toLowerCase()">{{ list.type }}</span>
              </div>
              <div class="list-meta">
                <span class="count">
                  📚 {{ list._count?.items || 0 }} words
                </span>
              </div>
            </div>
            <div v-if="lists.length === 0" class="empty-state">
              No lists found. Create one above!
            </div>
          </div>
        </div>
      </div>

      <div class="main-content-area">
        <div v-if="activeList" class="active-list-view glass-panel">
          <div class="list-details-header">
            <div class="title-section">
              <div class="title-row">
                <h2 class="page-title">{{ activeList.name }}</h2>
                <span class="badge" :class="activeList.type.toLowerCase()">{{ activeList.type }}</span>
              </div>
              <p class="list-description">
                {{ activeList.sourceMetadata?.description || 'Custom vocabulary list' }}
              </p>
            </div>

            <div class="header-actions-group" style="display: flex; gap: 1rem; align-items: center;">
              <div class="stats-badge">
                <span class="stats-num">{{ words.length }}</span>
                <span class="stats-label">Total Words</span>
              </div>

              <button class='stats-badge dynamic-action-badge' @click="handleFlashcardClick">
                <template v-if="hasExistingDeck">
                  <span class="stats-num emoji">🔍</span>
                  <span class="stats-label">Go To Deck</span>
                </template>
                <template v-else>
                  <span class="stats-num emoji">💠</span>
                  <span class="stats-label">Create Deck</span>
                </template>
              </button>
            </div>
          </div>

          <div class="controls-container">
            <div class="search-box">
              <input v-model="wordSearchQuery" type="text"
                placeholder="Search words, pinyin, or meaning in this list..." class="input-base search-input" />
            </div>

            <div v-if="activeList.type !== 'OFFICIAL'" class="add-word-form glass-panel-inner">
              <h3 class="form-title">Quick Add Word</h3>
              <div class="form-inputs">
                <input v-model="newWord.simplified" placeholder="Simplified (e.g. 你好)" class="input-base input-sm" />
                <input v-model="newWord.pinyin" placeholder="Pinyin (e.g. nǐ hǎo)" class="input-base input-sm" />
                <input v-model="newWord.meaning" placeholder="Meaning" class="input-base input-sm" />
                <button class="btn btn-primary btn-sm" @click="addWord" :disabled="!newWord.simplified.trim()">
                  Add
                </button>
              </div>
            </div>

            <div v-else class="add-word-disabled-notice glass-panel-inner">
              <p>🔒 <strong>Official List Locked:</strong> You cannot manually append dictionary terms to structured
                system or HSK lists.</p>
            </div>
          </div>

          <div class="table-container">
            <table v-if="filteredWords.length > 0" class="vocab-table">
              <thead>
                <tr>
                  <th class="col-char">Character</th>
                  <th class="col-pinyin">Pinyin</th>
                  <th class="col-meaning">Meaning</th>
                  <th class="col-count text-center">Seen Count</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredWords" :key="item.id" class="table-row">
                  <td class="character-cell">
                    <span class="character-text">{{ item.vocabulary?.simplified || item.simplified }}</span>
                  </td>
                  <td class="pinyin-cell">
                    <span>{{ item.vocabulary?.pinyin || item.pinyin || '' }}</span>
                  </td>
                  <td class="meaning-cell">
                    <div class="meaning-text" :title="item.vocabulary?.meaning || item.meaning">
                      {{ item.vocabulary?.meaning || item.meaning || '' }}
                    </div>
                  </td>
                  <td class="count-cell text-center">
                    <span class="count-badge">{{ item.seenCount }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-state">
              <p v-if="words.length === 0">This list is empty. Add some words to get started!</p>
              <p v-else>No words match your search filter.</p>
            </div>
          </div>
        </div>

        <div v-else class="no-selection glass-panel">
          <div class="no-selection-content">
            <div class="no-selection-icon">📚</div>
            <h2>No List Selected</h2>
            <p>Choose a vocabulary list from the sidebar or create a new one to view and manage your characters.</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showFlashcardModal" class="modal-backdrop">
      <div class="modal-content glass-panel">
        <h3 class="form-title">Deck Card Configuration</h3>
        <p class="modal-desc">Configure layout attributes for <strong>{{ activeList?.name }}</strong></p>

        <div class="modal-section">
          <span class="config-label">Front Elements Display:</span>
          <div class="checkbox-group">
            <label><input type="checkbox" v-model="deckFrontConfig.character" /> Character</label>
            <label><input type="checkbox" v-model="deckFrontConfig.pinyin" /> Pinyin</label>
            <label><input type="checkbox" v-model="deckFrontConfig.meaning" /> Meaning</label>
          </div>
        </div>

        <div class="modal-section">
          <span class="config-label">Back Elements Display:</span>
          <div class="checkbox-group">
            <label><input type="checkbox" v-model="deckBackConfig.character" /> Character</label>
            <label><input type="checkbox" v-model="deckBackConfig.pinyin" /> Pinyin</label>
            <label><input type="checkbox" v-model="deckBackConfig.meaning" /> Meaning</label>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" @click="showFlashcardModal = false"
            :disabled="isSyncingDeck">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="handleSyncAndNavigate" :disabled="isSyncingDeck">
            {{ isSyncingDeck ? 'Syncing...' : 'Confirm & Go Revise' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// Modal UI State tracking variables
const showFlashcardModal = ref(false);
const isSyncingDeck = ref(false);

// Configuration options mapping to match your flashcard engine requirements
const deckFrontConfig = ref({ character: true, pinyin: false, meaning: false });
const deckBackConfig = ref({ character: false, pinyin: true, meaning: true });

// Tracks existing user decks to verify flashcard status
const flashcardDecks = ref([]);

// API Configuration
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
const { isAuthenticated, getAccessTokenSilently } = useAuth0();

// State
const lists = ref([]);
const activeList = ref(null);
const words = ref([]);
const wordSearchQuery = ref('');

// Form State
const newListName = ref('');
const newWord = ref({
  simplified: '',
  pinyin: '',
  meaning: ''
});

// Computed boolean property detecting flashcard deck presence matching the activeList
const hasExistingDeck = computed(() => {
  if (!activeList.value) return false;
  return flashcardDecks.value.some(deck => deck.listId === activeList.value.id);
});

// Interceptor controlling logic actions based on flashcard presence
const handleFlashcardClick = () => {
  if (hasExistingDeck.value) {
    router.push('/flashcards');
  } else {
    showFlashcardModal.value = true;
  }
};

// Fetch user decks registry to cross-verify sync status mapping indexes
const fetchUserDecksRegistry = async () => {
  try {
    if (!isAuthenticated.value) return;
    const token = await getAccessTokenSilently();
    const response = await fetch(`${apiBase}/lexiflow/flashcards/decks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      flashcardDecks.value = await response.json();
    }
  } catch (error) {
    console.error('Failed to update referencing flashcards mapping alignment records:', error);
  }
};

// Sync action handler that routes users to the flashcards page upon success
const handleSyncAndNavigate = async () => {
  if (!activeList.value) return;
  isSyncingDeck.value = true;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (isAuthenticated.value) {
      const token = await getAccessTokenSilently();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${apiBase}/lexiflow/flashcards/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        listId: activeList.value.id,
        name: `${activeList.value.name} Dynamic Deck`,
        frontConfig: deckFrontConfig.value,
        backConfig: deckBackConfig.value
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    showFlashcardModal.value = false;
    await fetchUserDecksRegistry(); // Re-fetch registry updates to log verification indexes changes
    router.push('/flashcards');
  } catch (error) {
    console.error('Failed to quick-initialize flashcard deck:', error);
  } finally {
    isSyncingDeck.value = false;
  }
};

// Computed property to enforce sidebar ordering rule
const sortedLists = computed(() => {
  return [...lists.value].sort((a, b) => {
    const getOrderWeight = (type) => {
      if (type === 'SEEN') return 1;
      if (type === 'OFFICIAL') return 3;
      return 2;
    };
    return getOrderWeight(a.type) - getOrderWeight(b.type);
  });
});

// Computed list filtered by user search query
const filteredWords = computed(() => {
  if (!wordSearchQuery.value.trim()) return words.value;
  const q = wordSearchQuery.value.toLowerCase().trim();
  return words.value.filter(item => {
    const vocab = item.vocabulary || item;
    const simplified = vocab.simplified || '';
    const pinyin = vocab.pinyin || '';
    const meaning = vocab.meaning || '';
    return simplified.includes(q) ||
      pinyin.toLowerCase().includes(q) ||
      meaning.toLowerCase().includes(q);
  });
});

// Fetch all lists
const fetchLists = async () => {
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
    lists.value = await response.json();

    if (sortedLists.value.length > 0 && !activeList.value) {
      selectList(sortedLists.value[0]);
    }
  } catch (error) {
    console.error('Failed to fetch lists:', error);
  }
};

// Create a new list
const createList = async () => {
  if (!newListName.value.trim()) return;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (isAuthenticated.value) {
      const token = await getAccessTokenSilently();
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${apiBase}/lexiflow/lists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: newListName.value.trim(),
        type: 'USER_CREATED'
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    newListName.value = '';
    await fetchLists();
  } catch (error) {
    console.error('Failed to create list:', error);
  }
};

// Select a list and fetch its words
const selectList = async (list) => {
  activeList.value = list;
  words.value = [];
  wordSearchQuery.value = '';

  try {
    const headers = {};
    if (isAuthenticated.value) {
      const token = await getAccessTokenSilently();
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${apiBase}/lexiflow/lists/${list.id}/words`, { headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    words.value = await response.json();
  } catch (error) {
    console.error('Failed to fetch words:', error);
  }
};

// Add a word to the active list
const addWord = async () => {
  if (!activeList.value || activeList.value.type === 'OFFICIAL' || !newWord.value.simplified.trim()) return;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (isAuthenticated.value) {
      const token = await getAccessTokenSilently();
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${apiBase}/lexiflow/lists/${activeList.value.id}/words`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        simplified: newWord.value.simplified.trim(),
        pinyin: newWord.value.pinyin.trim(),
        meaning: newWord.value.meaning.trim()
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    newWord.value = { simplified: '', pinyin: '', meaning: '' };

    await selectList(activeList.value);
    await fetchLists();
  } catch (error) {
    console.error('Failed to add word:', error);
  }
};

// Watch for authentication state changes
watch(() => isAuthenticated.value, (newVal) => {
  if (newVal) {
    fetchLists();
    fetchUserDecksRegistry();
  }
});

onMounted(() => {
  if (isAuthenticated.value) {
    fetchLists();
    fetchUserDecksRegistry();
  }
});
</script>

<style scoped>
.list-view-container {
  display: flex;
  height: calc(100vh - 140px);
  gap: 2rem;
  padding: 1rem 0;
  position: relative;
  z-index: 1;
  min-height: 800px;
}

/* Sidebar Styling */
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

.glass-panel-inner {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  padding: 1rem;
}

.form-title {
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.create-list-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-block {
  width: 100%;
}

.select-wrapper {
  position: relative;
  width: 100%;
}

.select-custom {
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg fill='rgba(255,255,255,0.6)' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1.25rem;
  padding-right: 2.5rem;
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
  padding-left: 0.25rem;
}

.lists-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  flex: 1;
  padding-right: 4px;
}

.lists-grid::-webkit-scrollbar {
  width: 4px;
}

.lists-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
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
  line-height: 1.3;
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

.badge.seen {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.3);
}

.badge.saved {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}

.badge.official {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
  border-color: rgba(168, 85, 247, 0.3);
}

.count {
  color: var(--text-muted);
}

/* Main Content Area Styling */
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
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 1.5rem;
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
  flex-wrap: wrap;
}

.list-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

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



/* Specific Style Overrides when Flashcard action is styled as badge component */
.dynamic-action-badge {
  cursor: pointer;
  /* background: rgba(255, 255, 255, 0.02); */
  /* border: 1px solid rgba(255, 255, 255, 0.08); */
  transition: var(--transition);
}

.dynamic-action-badge:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--accent-secondary);
  box-shadow: var(--shadow-glow);
}

.emoji {
  color: rgba(255, 255, 255, 0.6);
  transition: color 0.2s ease;
}

.stats-num {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent-primary);
  line-height: 1.2;
  text-align: center;
}

.stats-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-top: 2px;
  letter-spacing: 0.02em;
  text-align: center;
}

/* Controls (Search & Quick Add) */
.controls-container {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
  flex-direction: column;
}

.search-box {
  flex: 1;
  min-width: 250px;
  width: 100%;
}

.search-input {
  background-image: url("data:image/svg+xml;utf8,<svg fill='rgba(255,255,255,0.4)' height='20' viewBox='0 0 24 24' width='20' xmlns='http://www.w3.org/2000/svg'><path d='M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
  background-repeat: no-repeat;
  background-position: left 0.75rem center;
  background-size: 1.1rem;
  padding-left: 2.25rem;
}

.add-word-form {
  flex: 1;
  min-width: 400px;
  width: 100%;
}

.add-word-form .form-title {
  margin-bottom: 0.5rem;
}

.form-inputs {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.input-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
}

/* Words Table Styling */
.table-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.15);
}

.table-container::-webkit-scrollbar {
  width: 6px;
}

.table-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.vocab-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
}

.vocab-table th {
  position: sticky;
  top: 0;
  background: #131d31;
  z-index: 10;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 1rem;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

.table-row {
  transition: background-color 0.2s ease;
}

.table-row:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.vocab-table td {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  vertical-align: middle;
}

.character-cell {
  width: 120px;
}

.character-text {
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.pinyin-cell {
  font-size: 1rem;
  color: var(--accent-secondary);
  font-weight: 500;
  width: 160px;
}

.meaning-cell {
  font-size: 0.95rem;
  color: var(--text-primary);
}

.meaning-text {
  max-width: 450px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count-cell {
  width: 100px;
}

.text-center {
  text-align: center;
}

.count-badge {
  background-color: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  padding: 0.25rem 0.75rem;
  border-radius: 50px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

/* Empty States & Falls */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  width: 100%;
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
  margin-bottom: 0.5rem;
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

/* Columns widths defaults */
.col-char {
  width: 120px;
}

.col-pinyin {
  width: 160px;
}

.col-count {
  width: 100px;
}

/* Pop-up Overlay Configuration styles */
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
  width: 400px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.modal-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: -0.5rem;
}

.modal-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.config-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
}

.checkbox-group {
  display: flex;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.6rem;
  border-radius: var(--radius-sm);
}

.checkbox-group label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Responsive adjustments */
@media (max-width: 950px) {
  .list-view-container {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }

  .sidebar {
    width: 100%;
    height: auto;
  }

  .main-content {
    height: 600px;
  }
}
</style>