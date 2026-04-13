<script setup>
import { ref, computed, onMounted } from 'vue'
import VideoBox from '@/components/VideoBox.vue'
import CharacterDisplay from '@/components/CharacterDisplay.vue'
import DictionarySearch from '@/components/DictionarySearch.vue'

const props = defineProps({
  videoId: {
    type: String,
    default: '9FNRb71akL4',
  },
})

const currentTime = ref(0.0)
const subtitlesJson = ref({ segments: [] })
const videoUrl = ref(null)

const handleTimeUpdate = (time) => {
  currentTime.value = time
}

onMounted(async () => {
  try {
    const res = await fetch(`https://api.amerai.top/lexiflow/jobs/${props.videoId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.result) {
        subtitlesJson.value = data.result;
        videoUrl.value = data.url;
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
</script>

<template>
  <div class="watch-page">
    <div class="watch-layout">
      <!-- Player column -->
      <div class="main-column">
        <div class="video-container glass-panel">
          <VideoBox v-if="videoUrl" :videoUrl="videoUrl" @time-update="handleTimeUpdate" />
        </div>
        
        <div class="subtitles-container" v-show="subtitlesJson.segments && subtitlesJson.segments.length > 0">
          <CharacterDisplay :characters="currentText" :translated_text="currentTranslation" />
        </div>
      </div>
      
      <!-- Interactive Sidebar -->
      <div class="sidebar-column">
        <DictionarySearch />
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
}
</style>