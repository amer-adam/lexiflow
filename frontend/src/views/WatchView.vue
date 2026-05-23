<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import VideoBox from '@/components/VideoBox.vue'
import CharacterDisplay from '@/components/CharacterDisplay.vue'
import DictionarySearch from '@/components/DictionarySearch.vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

const props = defineProps({
  videoId: {
    type: String,
    default: '9FNRb71akL4',
  },
})

const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()

const currentTime = ref(0.0)
const duration = ref(0.0)
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

const handleDurationUpdate = (val) => {
  duration.value = val
}

const loadVideo = async (jobId, jumpTime = null) => {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
    let headers = {};
    let finalJumpTime = jumpTime;

    // Fetch the token if the user is logged in
    if (isAuthenticated.value) {
      try {
        const token = await getAccessTokenSilently();
        headers['Authorization'] = `Bearer ${token}`;

        // Check stored progress if no explicit jumpTime is provided
        if (finalJumpTime === null) {
          const progRes = await fetch(`${baseUrl}/lexiflow/videos/${jobId}/progress`, { headers });
          if (progRes.ok) {
            const progData = await progRes.json();
            if (progData && progData.currentTime > 0) {
              finalJumpTime = progData.currentTime;
              console.log(`Resuming video ${jobId} from saved time: ${finalJumpTime}`);
            }
          }
        }
      } catch (progErr) {
        console.error("Failed to fetch stored watch progress:", progErr);
      }
    }

    // FIX: Pass the authenticated headers to the job request here
    const res = await fetch(`${baseUrl}/lexiflow/jobs/${jobId}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.result) {
        const oldUrl = videoUrl.value;
        const newUrl = data.url;

        subtitlesJson.value = data.result;
        activeVideoId.value = jobId;
        duration.value = data.duration || data.result?.duration || 0;

        // Detect if the video type changed (youtube <-> local) — need full re-mount
        const isOldYt = oldUrl && !!oldUrl.match(/(?:youtube\.com|youtu\.be)/);
        const isNewYt = newUrl && !!newUrl.match(/(?:youtube\.com|youtu\.be)/);

        if (oldUrl && isOldYt !== isNewYt) {
          videoUrl.value = null;
          await new Promise(r => setTimeout(r, 50));
          videoUrl.value = newUrl;
          videoKey.value++;
        } else {
          videoUrl.value = newUrl;
        }

        if (finalJumpTime !== null && finalJumpTime !== undefined) {
          setTimeout(() => {
            seekTime.value = finalJumpTime;
          }, 800);
        }

        const newQuery = finalJumpTime !== null ? { t: finalJumpTime } : {};
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

const saveWatchProgress = async (asyncMode = true) => {
  if (!isAuthenticated.value || !user.value || !activeVideoId.value) return;
  
  const bodyData = {
    currentTime: currentTime.value,
    duration: duration.value
  };
  
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
  const url = `${baseUrl}/lexiflow/videos/${activeVideoId.value}/progress`;

  console.log(`Saving progress for video ${activeVideoId.value} at time ${currentTime.value}s`);

  try {
    const token = await getAccessTokenSilently();
    if (asyncMode) {
      // Regular async save
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });
      if (!res.ok) {
        console.warn('Failed to save watch progress:', res.statusText);
      }
    } else {
      // Use keepalive for page unload events
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyData),
        keepalive: true
      }).catch(err => console.error('Fetch keepalive failed:', err));
    }
  } catch (err) {
    console.error('Error saving progress:', err);
  }
};

const handleBeforeUnload = () => {
  saveWatchProgress(false);
};

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  const initialTime = route.query.t ? parseFloat(route.query.t) : null;
  loadVideo(props.videoId, initialTime);
});

// Intercept Vue Router navigation to save progress before moving to next route
const removeRouterGuard = router.beforeEach(async (to, from, next) => {
  if (from.name === 'watch') {
    await saveWatchProgress(true);
  }
  next();
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  removeRouterGuard();
  saveWatchProgress(true);
});

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
          <VideoBox v-if="videoUrl" :key="videoKey" :videoUrl="videoUrl" :startTime="seekTime" @time-update="handleTimeUpdate" @duration-update="handleDurationUpdate" />
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