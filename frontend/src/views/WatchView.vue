<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import VideoBox from '@/components/VideoBox.vue'
import CharacterDisplay from '@/components/CharacterDisplay.vue'
import DictionarySearch from '@/components/DictionarySearch.vue'
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({
  videoId: {
    type: String,
    default: '9FNRb71akL4',
  },
})

const currentTime = ref(0.0)
const subtitlesJson = ref({ segments: [] })
const videoUrl = ref(null)
const seekTime = ref(0)
const activeVideoId = ref(props.videoId)
const videoKey = ref(0) // force re-mount of VideoBox when video type changes
const router = useRouter()
const route = useRoute()

const dictSearchRef = ref(null)

const handleTimeUpdate = (time) => {
  currentTime.value = time
}

const loadVideo = async (jobId, jumpTime = null) => {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
    const res = await fetch(`${baseUrl}/lexiflow/jobs/${jobId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.result) {
        const oldUrl = videoUrl.value;
        const newUrl = data.url;

        subtitlesJson.value = data.result;
        activeVideoId.value = jobId;

        // Detect if the video type changed (youtube <-> local) — need full re-mount
        const isOldYt = oldUrl && !!oldUrl.match(/(?:youtube\.com|youtu\.be)/);
        const isNewYt = newUrl && !!newUrl.match(/(?:youtube\.com|youtu\.be)/);

        if (oldUrl && isOldYt !== isNewYt) {
          // Type changed: force VideoBox to re-mount via key
          videoUrl.value = null;
          await new Promise(r => setTimeout(r, 50));
          videoUrl.value = newUrl;
          videoKey.value++;
        } else {
          videoUrl.value = newUrl;
        }

        // Apply seek after a small delay to let the player initialize/load
        if (jumpTime !== null && jumpTime !== undefined) {
          setTimeout(() => {
            seekTime.value = jumpTime;
          }, 800);
        }

        // Update the URL bar without triggering a navigation/reload
        const newQuery = jumpTime !== null ? { t: jumpTime } : {};
        router.replace({ name: 'watch', params: { videoId: jobId }, query: newQuery });

        return;
      }
    }
  } catch (err) {
    console.error("Failed to fetch job from backend", err);
  }

  // Fallback to local storage
  const storedSubtitles = localStorage.getItem(`subtitleJSON`)
  if (storedSubtitles) {
    try {
      subtitlesJson.value = JSON.parse(storedSubtitles)
    } catch(e) {
      console.error(e)
    }
  }
}

const onDictionaryJump = ({ time, videoId }) => {
  if (videoId && videoId !== activeVideoId.value) {
    // Swap video in-place — no navigation, no reload
    loadVideo(videoId, time);
  } else {
    seekTime.value = time;
  }
}

onMounted(() => {
  const initialTime = route.query.t ? parseFloat(route.query.t) : null;
  loadVideo(props.videoId, initialTime);
})

const currentSegment = computed(() => {
  if (!subtitlesJson.value?.segments || subtitlesJson.value.segments.length === 0) return null
  return subtitlesJson.value.segments.find(segment =>
    currentTime.value >= segment.start && currentTime.value < segment.end
  )
})

const currentText = computed(() => {
  return currentSegment.value?.characters || {}
})

const currentTranslation = computed(() => {
  return currentSegment.value?.translated_text || ''
})

const handleSearchWord = (word) => {
  if (dictSearchRef.value) {
    dictSearchRef.value.setQueryAndSearch(word)
  }
}
</script>

<template>
  <div class="watch-page">
    <div class="watch-layout">
      <!-- Player column -->
      <div class="main-column">
        <div class="video-container glass-panel">
          <VideoBox v-if="videoUrl" :key="videoKey" :videoUrl="videoUrl" :startTime="seekTime" @time-update="handleTimeUpdate" />
        </div>
        
        <div class="subtitles-container" v-show="subtitlesJson.segments && subtitlesJson.segments.length > 0">
          <CharacterDisplay :characters="currentText" :translated_text="currentTranslation" @search-word="handleSearchWord" />
        </div>
      </div>
      
      <!-- Interactive Sidebar -->
      <div class="sidebar-column">
        <DictionarySearch ref="dictSearchRef" :videoId="activeVideoId" @jump-to-time="onDictionaryJump" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.watch-page {
  padding: 1rem 0;
  width: 100%;
}

.watch-layout {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 2rem;
  align-items: start;
}

@media (max-width: 1100px) {
  .watch-layout {
    grid-template-columns: 1fr;
  }
}

.main-column {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.video-container {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  padding: 0;
}

.subtitles-container {
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>