<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

const router = useRouter()
const { user, isAuthenticated } = useAuth0()

const isLoading = ref(true)
const videos = ref([])

const searchQuery = ref('')
const searchActive = ref(false)
const searchMode = ref('split') // 'split', 'titles', 'subtitles'
const subtitleResults = ref([])

const filterMode = ref('All')
const sortBy = ref('Date Added (Newest)')

const fetchLibrary = async () => {
  try {
    const userId = isAuthenticated.value && user.value ? user.value.sub : '';
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
    const response = await fetch(`${baseUrl}/lexiflow/library?user_id=${userId}`);
    if (!response.ok) throw new Error('Network response was not ok');
    videos.value = await response.json();
  } catch (error) {
    console.error('Error fetching library:', error);
  } finally {
    isLoading.value = false;
  }
}

// Watch user auth to refetch library when it resolves
watch(() => isAuthenticated.value, (newVal) => {
  if (newVal) fetchLibrary();
});

onMounted(() => {
  // If useAuth0 takes a moment, we wait, or we just fetch immediately.
  // The watcher will handle it if it changes.
  fetchLibrary();
})

const filteredVideoList = computed(() => {
  let list = videos.value;
  
  if (filterMode.value === 'My Videos') {
    list = list.filter(v => v.requested_by_user);
  } else if (filterMode.value === 'Private') {
    list = list.filter(v => v.is_private && v.requested_by_user);
  }

  if (searchActive.value && searchQuery.value.trim() && searchMode.value !== 'subtitles') {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(v => v.title && v.title.toLowerCase().includes(q))
  }

  return [...list].sort((a, b) => {
    const getTime = d => (d && d !== 'Unknown') ? new Date(d).getTime() : 0;

    if (sortBy.value === 'Date Added (Newest)') {
      return getTime(b.dateAdded) - getTime(a.dateAdded);
    } else if (sortBy.value === 'Date Added (Oldest)') {
      return getTime(a.dateAdded) - getTime(b.dateAdded);
    } else if (sortBy.value === 'Name (A-Z)') {
      return (a.title || '').localeCompare(b.title || '');
    }
    return 0;
  });
});

const displayedVideos = computed(() => {
  if (!searchActive.value || !searchQuery.value.trim() || searchMode.value === 'subtitles') {
    return searchMode.value === 'subtitles' ? [] : filteredVideoList.value;
  }
  if (searchMode.value === 'split') {
    return filteredVideoList.value.slice(0, 4);
  }
  return filteredVideoList.value;
})

const displayedSubtitles = computed(() => {
  if (!searchActive.value || !searchQuery.value.trim() || searchMode.value === 'titles') return [];
  if (searchMode.value === 'split') {
    return subtitleResults.value.slice(0, 4);
  }
  return subtitleResults.value;
})

const executeSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchActive.value = false;
    subtitleResults.value = [];
    return;
  }
  
  searchActive.value = true;
  
  if (searchMode.value !== 'titles') {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
      const res = await fetch(`${baseUrl}/lexiflow/search?word=${encodeURIComponent(searchQuery.value)}`);
      if (res.ok) {
        const data = await res.json();
        // Only show results for videos the user is allowed to see (present in videos.value)
        const validJobIds = new Set(videos.value.map(v => v.id));
        subtitleResults.value = data.results.filter(r => validJobIds.has(r.job_id));
      }
    } catch(e) {
      console.error("Search API error", e)
    }
  }
}

watch(searchQuery, (newVal) => {
  if (!newVal.trim()) {
    searchActive.value = false;
    searchMode.value = 'split';
    subtitleResults.value = [];
  }
})

const openVideo = (videoId, time = null) => {
  const params = { name: 'watch', params: { videoId } };
  if (time !== null) {
    params.query = { t: time };
  }
  router.push(params)
}

const formatTime = (seconds) => {
  if (isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const highlightText = (text, queryStr) => {
  if (!text || !queryStr) return text;
  const safeQuery = queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeQuery})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}

</script>

<template>
  <div class="library-page">
    <div class="library-header">
      <h1 class="page-title">My Content Library</h1>
      <div class="search-col">
        <div class="search-bar">
          <input type="text" class="input-base" v-model="searchQuery" @keyup.enter="executeSearch" placeholder="Search title or word in subtitle... (Enter)" />
          <button class="btn btn-primary" @click="executeSearch">Search</button>
        </div>
      </div>
    </div>

    <!-- Controls Row -->
    <div class="controls-row" v-if="!searchActive || searchMode === 'split' || searchMode === 'titles'">
      <div class="filters">
        <button class="filter-btn" :class="{ active: filterMode === 'All' }" @click="filterMode = 'All'">All Content</button>
        <button class="filter-btn" :class="{ active: filterMode === 'My Videos' }" @click="filterMode = 'My Videos'">My Uploads</button>
        <button class="filter-btn" :class="{ active: filterMode === 'Private' }" @click="filterMode = 'Private'">Private</button>
      </div>
      <div class="sort-box">
        <select v-model="sortBy" class="input-base">
          <option>Date Added (Newest)</option>
          <option>Date Added (Oldest)</option>
          <option>Name (A-Z)</option>
        </select>
      </div>
    </div>

    <!-- Active Search Filter Banner -->
    <div v-if="searchActive && searchMode !== 'split'" class="search-banner">
      Showing <strong>{{ searchMode }}</strong> matches for "<span class="text-accent">{{ searchQuery }}</span>"
      <button class="btn btn-secondary btn-sm" @click="searchMode = 'split'; executeSearch()">Back to Split View</button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-grid">
      <div class="skeleton-card" v-for="n in 6" :key="n"></div>
    </div>

    <!-- Library Content -->
    <div v-else class="library-content">
      
      <!-- Video Titles Section -->
      <div v-if="searchMode === 'split' || searchMode === 'titles'" class="section-container">
        <div class="section-header" v-if="searchActive">
          <h2>Video Matches ({{ filteredVideoList.length }})</h2>
          <button v-if="searchMode === 'split' && filteredVideoList.length > 4" class="btn btn-outline btn-sm" @click="searchMode = 'titles'">See All Video Matches</button>
        </div>

        <div v-if="displayedVideos.length === 0 && !searchActive" class="empty-state">
          No videos found for this filter.
        </div>

        <div class="video-grid">
          <div class="video-card glass-panel" v-for="video in displayedVideos" :key="video.id" @click="openVideo(video.id)">
            <div class="thumbnail-wrapper">
              <img v-if="video.thumbnail" :src="video.thumbnail" :alt="video.title" />
              <div v-else class="dummy-thumbnail">🎬 Local File</div>
              
              <div class="badges-top">
                <span class="badge-private" v-if="video.is_private">Private</span>
              </div>
              <div class="duration-badge">{{ video.duration }}</div>
              
              <div class="play-overlay">
                <span class="play-icon">▶</span>
              </div>
            </div>
            <div class="card-info">
              <h3>{{ video.title }}</h3>
              <p class="description">{{ video.description }}</p>
              <div class="card-meta">
                <span>Added {{ video.dateAdded }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Subtitles Matches Section -->
      <div v-if="(searchActive && searchMode === 'split') || searchMode === 'subtitles'" class="section-container">
        <div class="section-header">
          <h2>Subtitle Matches ({{ subtitleResults.length }})</h2>
          <button v-if="searchMode === 'split' && subtitleResults.length > 4" class="btn btn-outline btn-sm" @click="searchMode = 'subtitles'">See All Subtitle Matches</button>
        </div>

        <div v-if="subtitleResults.length === 0" class="empty-state">
          No subtitle matches found for "{{ searchQuery }}".
        </div>

        <div class="subtitle-grid">
          <div v-for="(res, idx) in displayedSubtitles" :key="idx" class="subtitle-card glass-panel" @click="openVideo(res.job_id, res.segment.start)">
            <div class="sub-header">
              <span class="sub-title"><strong>{{ res.title }}</strong></span>
              <span class="timestamp">⏱ {{ formatTime(res.segment.start) }}</span>
            </div>
            <div class="sub-body">
              <p v-html="highlightText(res.segment.text, searchQuery)"></p>
              <p class="trans-text" v-html="highlightText(res.segment.translated_text, searchQuery)"></p>
            </div>
            <div class="play-overlay-sub">
              <span>▶ Jump to Time</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.library-page {
  padding: 1rem 0;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.search-col {
  display: flex;
  flex-direction: column;
}

.search-bar {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  max-width: 450px;
}

.search-bar input {
  flex: 1;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  background: rgba(0,0,0,0.2);
  padding: 1rem;
  border-radius: var(--radius-lg);
  flex-wrap: wrap;
  gap: 1rem;
}

.filters {
  display: flex;
  gap: 0.5rem;
}

.filter-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-secondary);
  padding: 0.5rem 1.25rem;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.filter-btn.active, .filter-btn:hover {
  background: var(--bg-surface-light);
  color: var(--text-primary);
  border-color: var(--accent-primary);
}

.search-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(59, 130, 246, 0.1);
  border-left: 4px solid var(--accent-primary);
  padding: 1rem;
  border-radius: var(--radius-md);
  margin-bottom: 2rem;
}

.section-container {
  margin-bottom: 3rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--accent-primary);
  color: var(--accent-primary);
}

.btn-outline:hover {
  background: var(--accent-primary);
  color: white;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 3rem;
  background: rgba(0,0,0,0.1);
  border-radius: var(--radius-md);
  border: 1px dashed rgba(255,255,255,0.1);
}

/* Grids */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.subtitle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

/* Video Card */
.video-card {
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.video-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-glow);
  border-color: rgba(59, 130, 246, 0.5);
}

.thumbnail-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  overflow: hidden;
}

.thumbnail-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.video-card:hover .thumbnail-wrapper img {
  transform: scale(1.05);
}

.dummy-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface-light);
  color: var(--text-secondary);
  font-size: 1.5rem;
  font-weight: bold;
}

.badges-top {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 2;
}

.badge-private {
  background: rgba(239, 68, 68, 0.9);
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
}

.duration-badge {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  z-index: 2;
}

.play-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 3;
}

.video-card:hover .play-overlay {
  opacity: 1;
}

.play-icon {
  width: 60px; height: 60px;
  background: var(--accent-gradient);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white;
  font-size: 1.5rem;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  transform: scale(0.8);
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.video-card:hover .play-icon {
  transform: scale(1);
}

.card-info {
  padding: 1.25rem;
}

.card-info h3 {
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-info .description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 1rem;
  min-height: 2.6em;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-muted);
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 1rem;
}

/* Subtitle Card */
.subtitle-card {
  padding: 1rem;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.subtitle-card:hover {
  border-color: var(--accent-primary);
  transform: translateY(-3px);
}

.sub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 0.5rem;
}

.sub-title {
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80%;
}

.timestamp {
  background: rgba(59, 130, 246, 0.2);
  color: var(--accent-primary);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-sm);
  font-weight: bold;
  font-size: 0.8em;
}

.sub-body p {
  font-size: 1rem;
  margin-bottom: 0.4rem;
}

.trans-text {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.9em !important;
}

.play-overlay-sub {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  font-weight: bold;
  color: white;
}

.subtitle-card:hover .play-overlay-sub {
  opacity: 1;
}

/* Highlighting */
:deep(.highlight) {
  background-color: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  padding: 0 4px;
  border-radius: 4px;
  font-weight: bold;
}

/* Skeleton Loading */
.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.skeleton-card {
  height: 300px;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.3; }
  100% { opacity: 0.6; }
}
</style>
