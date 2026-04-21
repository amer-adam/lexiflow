<script setup>
import { ref, computed } from 'vue'
import { useAuth0 } from '@auth0/auth0-vue'

const props = defineProps({
  videoId: {
    type: String,
    default: ''
  }
})

const { user, isAuthenticated } = useAuth0()

const query = ref('')
const isLoading = ref(false)
const result = ref(null)
const sentenceResults = ref([])

const occurrenceFilter = ref('all') // 'all' or 'current'

const emit = defineEmits(['jump-to-time'])

const formatTime = (seconds) => {
  if (isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Highlight text using the searched query only.
 * We always highlight the raw query the user typed.
 * If a pinyin string was returned from the dictionary, highlight that too.
 */
const highlightText = (text, queryStr, extraTerms) => {
  if (!text || !queryStr) return text || '';

  const terms = [queryStr.trim()];
  if (extraTerms && Array.isArray(extraTerms)) {
    extraTerms.forEach(t => {
      if (t && t.trim().length > 0) terms.push(t.trim());
    });
  }

  // Deduplicate and sort longest first
  const unique = [...new Set(terms)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (unique.length === 0) return text;

  const patterns = unique.map(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // If the keyword is entirely basic Latin characters (like raw pinyin or search text),
    // enforce letter boundaries so "ni" doesn't match inside "learning" or "ning".
    if (/^[A-Za-z\s]+$/.test(kw)) {
      return `(?<![A-Za-z])${escaped}(?![A-Za-z])`;
    }
    return escaped;
  });

  const pattern = patterns.join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  return text.replace(regex, '<span class="hl">$1</span>');
}

// Extra terms to highlight (pinyin from dictionary)
const extraHighlightTerms = ref([])

const searchDictionary = async () => {
  if (!query.value.trim()) return

  isLoading.value = true
  result.value = null
  sentenceResults.value = []
  extraHighlightTerms.value = []

  const userId = isAuthenticated.value && user.value ? user.value.sub : '';

  try {
    const [dictRes, searchRes] = await Promise.all([
      fetch(`https://api.amerai.top/lexiflow/dictionary?word=${encodeURIComponent(query.value)}`),
      fetch(`https://api.amerai.top/lexiflow/search?word=${encodeURIComponent(query.value)}&user_id=${userId}`)
    ]);

    if (dictRes.ok) {
      const dictData = await dictRes.json();
      const extras = [];

      // Add raw pinyin as extra highlight term
      if (dictData.pinyin) {
        extras.push(dictData.pinyin.trim());
        // Also add without tone numbers
        const noTones = dictData.pinyin.replace(/[0-9]/g, '').trim();
        if (noTones) extras.push(noTones);
      }

      if (dictData.definitions && dictData.definitions.length > 0) {
        result.value = {
          word: dictData.word,
          pinyin: dictData.pinyin || '',
          definition: dictData.definitions.join('; ')
        }
      }

      extraHighlightTerms.value = extras;
    }

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.results) {
        sentenceResults.value = searchData.results;
      }
    }
  } catch (error) {
    console.error("Search failed:", error);
  } finally {
    isLoading.value = false
  }
}

const filteredSentenceResults = computed(() => {
  if (occurrenceFilter.value === 'current') {
    return sentenceResults.value.filter(res => res.job_id === props.videoId);
  }
  return sentenceResults.value;
})

const setQueryAndSearch = (newQuery) => {
  query.value = newQuery;
  searchDictionary();
}

defineExpose({ setQueryAndSearch })
</script>

<template>
  <div class="dictionary-search glass-panel">
    <h3>Dictionary Lookup</h3>
    <div class="search-box">
      <input 
        v-model="query" 
        @keyup.enter="searchDictionary" 
        placeholder="Search for a character / pinyin..." 
        class="input-base" 
      />
      <button @click="searchDictionary" class="btn btn-primary" :disabled="isLoading">
        <span v-if="isLoading">...</span>
        <span v-else>Search</span>
      </button>
    </div>

    <div v-if="result" class="search-result">
      <div class="result-header">
        <span class="word">{{ result.word }}</span>
        <span class="result-pinyin">{{ result.pinyin }}</span>
      </div>
      <p class="definition">{{ result.definition }}</p>
    </div>

    <div v-if="sentenceResults.length > 0" class="sentence-results">
      <h4>Occurrences <span class="occ-count">({{ filteredSentenceResults.length }})</span></h4>
      
      <div class="occurrence-tabs">
        <button 
          class="occ-tab" 
          :class="{ active: occurrenceFilter === 'all' }" 
          @click="occurrenceFilter = 'all'"
        >All Videos</button>
        <button 
          class="occ-tab" 
          :class="{ active: occurrenceFilter === 'current' }" 
          @click="occurrenceFilter = 'current'"
        >This Video</button>
      </div>

      <ul class="scrollable-list">
        <li 
          v-for="(res, idx) in filteredSentenceResults" 
          :key="idx" 
          class="sentence-item" 
          @click="emit('jump-to-time', { time: res.segment.start, videoId: res.job_id })"
        >
          <div class="sentence-meta">
            <span class="meta-title">{{ res.title }}</span>
            <span class="timestamp" v-if="res.segment.start !== undefined">{{ formatTime(res.segment.start) }}</span>
          </div>
          <p class="seg-text" v-html="highlightText(res.segment.text, query, extraHighlightTerms)"></p>
          <p class="seg-trans" v-html="highlightText(res.segment.translated_text, query, extraHighlightTerms)"></p>
          <p class="seg-pinyin" v-if="res.segment.pinyin" v-html="highlightText(res.segment.pinyin, query, extraHighlightTerms)"></p>
        </li>
        <li v-if="filteredSentenceResults.length === 0" class="empty-filter">
          No matches found{{ occurrenceFilter === 'current' ? ' in this video' : '' }}.
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.dictionary-search {
  padding: 1.25rem;
  margin-top: 2rem;
  width: 100%;
  display: flex;
  flex-direction: column;
}

h3 {
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

/* ── Search Input ── */
.search-box {
  display: flex;
  gap: 0.5rem;
}

.search-box .input-base {
  flex: 1;
  min-width: 0;
}

/* ── Dictionary Result ── */
.search-result {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.result-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.word {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--accent-primary);
  line-height: 1.2;
}

.result-pinyin {
  font-size: 1.1rem;
  color: var(--text-secondary);
  font-style: italic;
}

.definition {
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* ── Occurrences Section ── */
.sentence-results {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sentence-results h4 {
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 600;
}

.occ-count {
  color: var(--text-muted);
  font-weight: 400;
}

/* ── Tab Toggle (below title) ── */
.occurrence-tabs {
  display: flex;
  background: rgba(0,0,0,0.25);
  border-radius: 6px;
  padding: 3px;
  gap: 2px;
  margin-bottom: 0.75rem;
}

.occ-tab {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 0.3rem 0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  transition: all 0.25s ease;
  letter-spacing: 0.02em;
  text-align: center;
}

.occ-tab:hover {
  color: var(--text-secondary);
}

.occ-tab.active {
  background: rgba(255,255,255,0.1);
  color: var(--text-primary);
}

/* ── Scrollable List ── */
.scrollable-list {
  max-height: 420px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 0;
}

.scrollable-list::-webkit-scrollbar {
  width: 4px;
}
.scrollable-list::-webkit-scrollbar-track {
  background: transparent;
}
.scrollable-list::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
}

/* ── Sentence Card ── */
.sentence-item {
  margin-bottom: 0.6rem;
  background: rgba(0,0,0,0.2);
  padding: 0.65rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  border: 1px solid transparent;
}

.sentence-item:hover {
  background: rgba(0,0,0,0.35);
  border-color: rgba(59, 130, 246, 0.35);
}

.sentence-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.meta-title {
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.timestamp {
  flex-shrink: 0;
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent-primary);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.seg-text {
  font-size: 0.95rem;
  line-height: 1.4;
  margin: 0 0 0.2rem 0;
  color: var(--text-primary);
}

.seg-trans {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.85rem;
  line-height: 1.35;
  margin: 0 0 0.15rem 0;
}

.seg-pinyin {
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.3;
  margin: 0;
}

.empty-filter {
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  padding: 1.5rem 0.5rem;
  font-size: 0.85rem;
}

/* ── Highlight ── */
:deep(.hl) {
  background-color: rgba(255, 215, 0, 0.25);
  color: #ffd700;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 700;
}
</style>
