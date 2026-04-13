<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoading = ref(true)
const videos = ref([])

// Backend API Call
onMounted(async () => {
  try {
    const response = await fetch('https://api.amerai.top/lexiflow/library');
    if (!response.ok) throw new Error('Network response was not ok');
    videos.value = await response.json();
  } catch (error) {
    console.error('Error fetching library:', error);
  } finally {
    isLoading.value = false;
  }
})

const openVideo = (videoId) => {
  router.push({ name: 'watch', params: { videoId } })
}
</script>

<template>
  <div class="library-page">
    <div class="library-header">
      <h1 class="page-title">My Content Library</h1>
      <div class="search-bar">
        <input type="text" class="input-base" placeholder="Search saved translations..." />
      </div>
    </div>

    <div v-if="isLoading" class="loading-grid">
      <div class="skeleton-card" v-for="n in 6" :key="n"></div>
    </div>

    <div v-else class="video-grid">
      <div class="video-card glass-panel" v-for="video in videos" :key="video.id" @click="openVideo(video.id)">
        <div class="thumbnail-wrapper">
          <img v-if="video.thumbnail" :src="video.thumbnail" :alt="video.title" />
          <div v-else class="dummy-thumbnail">🎬 Local File</div>
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
            <span class="status-ready">Ready to Watch</span>
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
  margin-bottom: 2rem;
}

.search-bar {
  width: 300px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
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

/* Card Styling */
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

.status-ready {
  color: var(--success);
  font-weight: 600;
}
</style>
