<script setup>
import { ref } from 'vue'

const query = ref('')
const isLoading = ref(false)
const result = ref(null)
const sentenceResults = ref([])

const searchDictionary = async () => {
  if (!query.value.trim()) return

  isLoading.value = true
  result.value = null
  sentenceResults.value = []

  try {
    const [dictRes, searchRes] = await Promise.all([
      fetch(`https://api.amerai.top/lexiflow/dictionary?word=${encodeURIComponent(query.value)}`),
      fetch(`https://api.amerai.top/lexiflow/search?word=${encodeURIComponent(query.value)}`)
    ]);

    if (dictRes.ok) {
      const dictData = await dictRes.json();
      if (dictData.definitions && dictData.definitions.length > 0) {
        result.value = {
          word: dictData.word,
          pinyin: '',
          definition: dictData.definitions.join('; ')
        }
      }
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
        <span class="pinyin">{{ result.pinyin }}</span>
      </div>
      <p class="definition">{{ result.definition }}</p>
    </div>

    <div v-if="sentenceResults.length > 0" class="sentence-results">
      <h4>Occurrences in Subtitles</h4>
      <ul>
        <li v-for="(res, idx) in sentenceResults" :key="idx" class="sentence-item">
          <strong>{{ res.title }}</strong>:
          <p>{{ res.segment.text }}</p>
          <p class="sentence-trans">{{ res.segment.translated_text }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.dictionary-search {
  padding: 1.5rem;
  margin-top: 2rem;
  width: 100%;
}

h3 {
  margin-bottom: 1rem;
  font-size: 1.25rem;
}

.search-box {
  display: flex;
  gap: 1rem;
}

.search-box .input-base {
  flex: 1;
}

.search-result {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.result-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.word {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent-primary);
}

.pinyin {
  font-size: 1.2rem;
  color: var(--text-secondary);
  font-style: italic;
}

.definition {
  color: var(--text-primary);
  font-size: 1rem;
  line-height: 1.5;
}

.sentence-results {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.sentence-results h4 {
  margin-bottom: 1rem;
  color: var(--accent-primary);
}

.sentence-item {
  margin-bottom: 1rem;
  background: rgba(0,0,0,0.2);
  padding: 0.5rem;
  border-radius: var(--radius-sm);
}

.sentence-trans {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.9em;
}
</style>
