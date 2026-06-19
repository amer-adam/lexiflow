<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import VideoBox from '@/components/VideoBox.vue'
import CharacterDisplay from '@/components/CharacterDisplay.vue'
import DictionarySearch from '@/components/DictionarySearch.vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

// ─── Props & Auth ───────────────────────────────────────────────────────────
const props = defineProps({
  videoId: { type: String, default: '9FNRb71akL4' },
})
const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()

// ─── Core state ─────────────────────────────────────────────────────────────
const currentTime   = ref(0.0)
const duration      = ref(0.0)
const subtitlesJson = ref({ segments: [] })
const videoUrl      = ref(null)
const seekTime      = ref(0)
const activeVideoId = ref(props.videoId)
const videoKey      = ref(0)
const router        = useRouter()
const route         = useRoute()
const dictSearchRef = ref(null)
const videoBoxRef   = ref(null)
const videoTitle = ref('')
const videoDescription = ref('')
const isCreatingList = ref(false)

// ─── Subtitle settings ───────────────────────────────────────────────────────
const showPinyin      = ref(true)
const showCharacters  = ref(true)
const showTranslation = ref(true)
const settingsOpen    = ref(false)
const subBgOpacity    = ref(50) // percentage, default to 50%

// ─── Playback controls ───────────────────────────────────────────────────────
const loopSegment   = ref(false)
const pauseAtEnd    = ref(false)
const hasHandledEnd = ref(false)  // prevent re-fire within same segment

// ─── Theater mode ────────────────────────────────────────────────────────────
const theaterMode     = ref(false)
const theaterSubY     = ref(80)          // % from top of video container
const isDragging      = ref(false)
const dragStartY      = ref(0)
const dragStartSubY   = ref(0)
const theaterHoverUI  = ref(false)       // whether settings/controls UI is hovered
let hideUITimer       = null

// ─── Segment navigation ──────────────────────────────────────────────────────
const segments = computed(() => subtitlesJson.value?.segments || [])

const currentSegmentIndex = computed(() => {
  if (!segments.value.length) return -1
  return segments.value.findIndex(s =>
    currentTime.value >= s.start && currentTime.value < s.end
  )
})

const currentSegment = computed(() => {
  const i = currentSegmentIndex.value
  return i >= 0 ? segments.value[i] : null
})

const currentText = computed(() => currentSegment.value?.characters || {})
const currentTranslation = computed(() => currentSegment.value?.translated_text || '')

// ─── Time update handler ─────────────────────────────────────────────────────
const handleTimeUpdate = (time) => {
  currentTime.value = time
  if (!currentSegment.value) return

  const seg = currentSegment.value

  // Pause-at-end: pause when we cross segment end
  if (pauseAtEnd.value && !hasHandledEnd.value && time >= seg.end - 0.08) {
    hasHandledEnd.value = true
    videoBoxRef.value?.pause()
  }

  // Loop: seek back to start when we cross segment end
  if (loopSegment.value && !pauseAtEnd.value && time >= seg.end - 0.08) {
    videoBoxRef.value?.seekTo(seg.start)
  }
}

watch(currentSegmentIndex, () => {
  hasHandledEnd.value = false
})

const handleDurationUpdate = (val) => {
  duration.value = val
}

// ─── Navigation arrows ───────────────────────────────────────────────────────
const goPrevSegment = () => {
  const i = currentSegmentIndex.value
  const target = i > 0 ? i - 1 : 0
  seekTime.value = segments.value[target].start + 0.05
}

const goNextSegment = () => {
  const i = currentSegmentIndex.value
  const next = i < segments.value.length - 1 ? i + 1 : i
  seekTime.value = segments.value[next].start + 0.05
}

const replaySegment = () => {
  if (currentSegment.value) {
    seekTime.value = currentSegment.value.start + 0.05
    hasHandledEnd.value = false
  }
}

// ─── Load video ──────────────────────────────────────────────────────────────
const loadVideo = async (jobId, jumpTime = null) => {
  videoTitle.value = 'Loading video info...'
  videoDescription.value = ''
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556'
    let headers = {}
    let finalJumpTime = jumpTime

    if (isAuthenticated.value) {
      try {
        const token = await getAccessTokenSilently()
        headers['Authorization'] = `Bearer ${token}`
        if (finalJumpTime === null) {
          const progRes = await fetch(`${baseUrl}/lexiflow/videos/${jobId}/progress`, { headers })
          if (progRes.ok) {
            const progData = await progRes.json()
            if (progData && progData.currentTime > 0) {
              finalJumpTime = progData.currentTime
            }
          }
        }
      } catch (progErr) {
        console.error('Failed to fetch stored watch progress:', progErr)
      }
    }

    const res = await fetch(`${baseUrl}/lexiflow/jobs/${jobId}`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.result) {
        const oldUrl  = videoUrl.value
        const newUrl  = data.url
        subtitlesJson.value  = data.result
        activeVideoId.value  = jobId
        duration.value       = data.duration || data.result?.duration || 0
        videoTitle.value     = data.title || data.result?.title || 'Unknown Title'
        videoDescription.value = data.description || data.result?.description || ''

        const isOldYt = oldUrl && !!oldUrl.match(/(?:youtube\.com|youtu\.be)/)
        const isNewYt = newUrl && !!newUrl.match(/(?:youtube\.com|youtu\.be)/)

        if (oldUrl && isOldYt !== isNewYt) {
          videoUrl.value = null
          await new Promise(r => setTimeout(r, 50))
          videoUrl.value = newUrl
          videoKey.value++
        } else {
          videoUrl.value = newUrl
        }

        if (finalJumpTime !== null && finalJumpTime !== undefined) {
          setTimeout(() => { seekTime.value = finalJumpTime }, 800)
        }

        const newQuery = finalJumpTime !== null ? { t: finalJumpTime } : {}
        router.replace({ name: 'watch', params: { videoId: jobId }, query: newQuery })
        return
      }
    }
  } catch (err) {
    console.error('Failed to fetch job from backend', err)
  }

  // Fallback
  const storedSubtitles = localStorage.getItem('subtitleJSON')
  if (storedSubtitles) {
    try { subtitlesJson.value = JSON.parse(storedSubtitles) } catch (e) { console.error(e) }
  }
}

const onDictionaryJump = ({ time, videoId }) => {
  if (videoId && videoId !== activeVideoId.value) {
    loadVideo(videoId, time)
  } else {
    seekTime.value = time
  }
}

// ─── Progress saving ─────────────────────────────────────────────────────────
const saveWatchProgress = async (asyncMode = true) => {
  if (!isAuthenticated.value || !user.value || !activeVideoId.value) return
  const bodyData = { currentTime: currentTime.value, duration: duration.value }
  const baseUrl  = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556'
  const url      = `${baseUrl}/lexiflow/videos/${activeVideoId.value}/progress`

  try {
    const token = await getAccessTokenSilently()
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(bodyData),
    }
    if (!asyncMode) opts.keepalive = true
    const res = await fetch(url, opts)
    if (!res.ok) console.warn('Failed to save watch progress:', res.statusText)
  } catch (err) {
    console.error('Error saving progress:', err)
  }
}

const handleBeforeUnload = () => saveWatchProgress(false)

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  const initialTime = route.query.t ? parseFloat(route.query.t) : null
  loadVideo(props.videoId, initialTime)
})

const removeRouterGuard = router.beforeEach(async (to, from, next) => {
  if (from.name === 'watch') await saveWatchProgress(true)
  next()
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  removeRouterGuard()
  saveWatchProgress(true)
  if (hideUITimer) clearTimeout(hideUITimer)
})

// ─── Create Vocab List ───────────────────────────────────────────────────────
const createVocabListFromVideo = async () => {
  if (isCreatingList.value) return
  isCreatingList.value = true
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (isAuthenticated.value) {
      const token = await getAccessTokenSilently()
      headers['Authorization'] = `Bearer ${token}`
    } else {
      alert('Please log in to create a vocabulary list.')
      return
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556'
    const response = await fetch(`${baseUrl}/lexiflow/lists/from-video`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ videoId: activeVideoId.value })
    })

    if (!response.ok) {
      throw new Error(`Failed to create list: ${response.statusText}`)
    }

    const result = await response.json()
    if (result.success && result.listId) {
      router.push({ name: 'VocabularyLists', query: { listId: result.listId } })
    }
  } catch (err) {
    console.error('Error creating vocabulary list:', err)
    alert(`Error creating list: ${err.message}`)
  } finally {
    isCreatingList.value = false
  }
}

// ─── Search word ─────────────────────────────────────────────────────────────
const handleSearchWord = (word) => {
  if (theaterMode.value) {
    // Exit theater mode first, then show word in sidebar
    theaterMode.value = false
  }
  if (dictSearchRef.value) {
    dictSearchRef.value.setQueryAndSearch(word)
  }
}

// ─── Theater mode ─────────────────────────────────────────────────────────────
const enterTheater = () => {
  theaterMode.value = true
  theaterSubY.value = 80
}

const exitTheater = () => {
  theaterMode.value = false
}

// Subtitle drag (vertical position inside theater video)
const onDragStart = (e) => {
  isDragging.value = true
  dragStartY.value    = e.clientY || (e.touches && e.touches[0].clientY) || 0
  dragStartSubY.value = theaterSubY.value
  e.preventDefault()
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup',   onDragEnd)
  document.addEventListener('touchmove', onDragMove, { passive: false })
  document.addEventListener('touchend',  onDragEnd)
}

const onDragMove = (e) => {
  if (!isDragging.value) return
  const clientY   = e.clientY || (e.touches && e.touches[0].clientY) || 0
  const delta     = clientY - dragStartY.value
  const container = document.querySelector('.video-container')
  if (!container) return
  const containerH   = container.offsetHeight
  const deltaPercent = (delta / containerH) * 100
  theaterSubY.value  = Math.max(5, Math.min(95, dragStartSubY.value + deltaPercent))
}

const onDragEnd = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup',   onDragEnd)
  document.removeEventListener('touchmove', onDragMove)
  document.removeEventListener('touchend',  onDragEnd)
}

// Auto-hide settings in theater mode
const showTheaterUI = ref(true)

const startHideTimer = () => {
  if (hideUITimer) clearTimeout(hideUITimer)
  hideUITimer = setTimeout(() => {
    if (!theaterHoverUI.value) {
      showTheaterUI.value = false
    }
  }, 2500)
}

const onTheaterMouseMove = () => {
  showTheaterUI.value = true
  startHideTimer()
}

watch(theaterMode, (val) => {
  if (val) {
    showTheaterUI.value = true
    startHideTimer()
  } else {
    if (hideUITimer) clearTimeout(hideUITimer)
    showTheaterUI.value = true
  }
})
</script>

<template>
  <div class="watch-page" :class="{ 'theater-mode-active': theaterMode }" @mousemove="theaterMode && onTheaterMouseMove($event)">
    <div class="watch-layout">
      <!-- Player column -->
      <div class="main-column">
        <!-- Video Meta section -->
        <div class="video-meta-section glass-panel" v-show="!theaterMode">
          <div class="video-meta-info">
            <h1 class="video-title">{{ videoTitle }}</h1>
            <p class="video-description" v-if="videoDescription">{{ videoDescription }}</p>
          </div>
          <div class="video-meta-actions">
            <button class="btn btn-primary btn-create-list" @click="createVocabListFromVideo" :disabled="isCreatingList || !subtitlesJson.segments?.length">
              <span v-if="isCreatingList">⏳ Creating List...</span>
              <span v-else>📁 Create Vocab List</span>
            </button>
          </div>
        </div>

        <!-- Video Container -->
        <div class="video-container glass-panel">
          <VideoBox
            v-if="videoUrl"
            :key="videoKey"
            ref="videoBoxRef"
            :videoUrl="videoUrl"
            :startTime="seekTime"
            @time-update="handleTimeUpdate"
            @duration-update="handleDurationUpdate"
          />

          <!-- Theater mode draggable subtitles overlay -->
          <div
            v-if="theaterMode"
            class="theater-subtitle-overlay"
            :style="{ top: theaterSubY + '%' }"
          >
            <!-- Clicking the subtitle itself will exit theater mode -->
            <div class="theater-sub-clickable" @click="exitTheater">
              <CharacterDisplay
                v-if="currentSegment"
                :characters="currentText"
                :translated_text="currentTranslation"
                :showPinyin="showPinyin"
                :showCharacters="showCharacters"
                :showTranslation="showTranslation"
                :theaterMode="true"
                :subBgOpacity="subBgOpacity"
                @search-word="handleSearchWord"
              />
              <div v-else class="theater-no-sub"></div>
            </div>

            <!-- Drag handle -->
            <div
              class="theater-drag-handle"
              @mousedown="onDragStart"
              @touchstart.prevent="onDragStart"
              title="Drag to reposition subtitles"
            >
              <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
                <rect y="0" width="24" height="2" rx="1" fill="currentColor"/>
                <rect y="5" width="24" height="2" rx="1" fill="currentColor"/>
                <rect y="10" width="24" height="2" rx="1" fill="currentColor"/>
              </svg>
            </div>
          </div>

          <!-- Theater controls overlay (auto-hide) -->
          <Transition name="fade-ui">
            <div
              v-show="theaterMode && showTheaterUI"
              class="theater-controls-overlay"
              @mouseenter="theaterHoverUI = true"
              @mouseleave="theaterHoverUI = false; startHideTimer()"
            >
              <!-- Nav arrows + playback controls -->
              <div class="theater-nav">
                <button class="ctrl-btn" @click="goPrevSegment" title="Previous subtitle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button class="ctrl-btn" @click="replaySegment" title="Replay segment">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                </button>
                <button class="ctrl-btn" :class="{ active: loopSegment }" @click="loopSegment = !loopSegment" title="Loop segment">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                </button>
                <button class="ctrl-btn" :class="{ active: pauseAtEnd }" @click="pauseAtEnd = !pauseAtEnd" title="Pause at segment end">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/><line x1="22" y1="19" x2="22" y2="5" stroke-width="3"/></svg>
                </button>
                <button class="ctrl-btn" @click="goNextSegment" title="Next subtitle">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              <!-- Settings toggles -->
              <div class="theater-settings">
                <button class="toggle-chip" :class="{ on: showCharacters }" @click="showCharacters = !showCharacters">汉字</button>
                <button class="toggle-chip" :class="{ on: showPinyin }"     @click="showPinyin     = !showPinyin">Pīnyīn</button>
                <button class="toggle-chip" :class="{ on: showTranslation }" @click="showTranslation = !showTranslation">Translation</button>
                
                <!-- Background transparency control in theater mode -->
                <div class="transparency-slider-wrap">
                  <span class="slider-label">Sub BG:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    v-model="subBgOpacity"
                    class="transparency-slider"
                  />
                  <span class="slider-value">{{ subBgOpacity }}%</span>
                </div>

                <button class="exit-theater-btn" @click="exitTheater">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                  Exit Theater
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Normal Subtitle bar (hidden in theater mode) -->
        <div class="subtitle-bar" v-show="!theaterMode && subtitlesJson.segments && subtitlesJson.segments.length > 0">
          <!-- Controls row -->
          <div class="sub-controls">
            <!-- Navigation -->
            <div class="nav-group">
              <button class="icon-btn" @click="goPrevSegment" title="Previous subtitle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button class="icon-btn" @click="replaySegment" title="Replay segment">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              </button>
              <button class="icon-btn" :class="{ 'icon-btn--on': loopSegment }" @click="loopSegment = !loopSegment" title="Loop segment">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </button>
              <button class="icon-btn" :class="{ 'icon-btn--on': pauseAtEnd }" @click="pauseAtEnd = !pauseAtEnd" title="Pause at segment end">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/><line x1="22" y1="19" x2="22" y2="5" stroke-width="3"/></svg>
              </button>
              <button class="icon-btn" @click="goNextSegment" title="Next subtitle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            <!-- Settings toggle -->
            <div class="settings-group">
              <div class="settings-popup-wrap" @mouseenter="settingsOpen = true" @mouseleave="settingsOpen = false">
                <button class="icon-btn settings-btn" :class="{ 'icon-btn--on': settingsOpen }" title="Subtitle settings">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </button>
                <Transition name="popup">
                  <div v-show="settingsOpen" class="settings-popup">
                    <div class="settings-row">
                      <span class="settings-label">Characters</span>
                      <button class="toggle-switch" :class="{ on: showCharacters }" @click="showCharacters = !showCharacters">
                        <span class="toggle-thumb"></span>
                      </button>
                    </div>
                    <div class="settings-row">
                      <span class="settings-label">Pinyin</span>
                      <button class="toggle-switch" :class="{ on: showPinyin }" @click="showPinyin = !showPinyin">
                        <span class="toggle-thumb"></span>
                      </button>
                    </div>
                    <div class="settings-row">
                      <span class="settings-label">Translation</span>
                      <button class="toggle-switch" :class="{ on: showTranslation }" @click="showTranslation = !showTranslation">
                        <span class="toggle-thumb"></span>
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>

              <!-- Theater mode button -->
              <button class="icon-btn theater-toggle" @click="enterTheater" title="Theater mode">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>
              </button>
            </div>
          </div>

          <!-- Subtitle display -->
          <div class="sub-display">
            <CharacterDisplay
              v-if="currentSegment"
              :characters="currentText"
              :translated_text="currentTranslation"
              :showPinyin="showPinyin"
              :showCharacters="showCharacters"
              :showTranslation="showTranslation"
              :theaterMode="false"
              @search-word="handleSearchWord"
            />
            <div v-else class="no-sub-placeholder">
              <span>▶ No subtitle at this timestamp</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Sidebar -->
      <div class="sidebar-column" v-show="!theaterMode">
        <DictionarySearch ref="dictSearchRef" :videoId="activeVideoId" @jump-to-time="onDictionaryJump" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── NORMAL MODE ─── */
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
  .watch-layout { grid-template-columns: 1fr; }
}

.main-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.video-container {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  padding: 0;
  position: relative;
}

/* ── Subtitle bar ── */
.subtitle-bar {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-xl);
  padding: 0.75rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Controls row ── */
.sub-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.nav-group,
.settings-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* ── Icon button ── */
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
  padding: 0;
}

.icon-btn svg {
  width: 16px;
  height: 16px;
}

.icon-btn:hover {
  background: rgba(59,130,246,0.15);
  border-color: rgba(59,130,246,0.4);
  color: #93c5fd;
  transform: translateY(-1px);
}

.icon-btn--on {
  background: rgba(59,130,246,0.2) !important;
  border-color: rgba(59,130,246,0.6) !important;
  color: #60a5fa !important;
  box-shadow: 0 0 8px rgba(59,130,246,0.3);
}

.theater-toggle {
  margin-left: 0.25rem;
}

/* ── Settings popup ── */
.settings-popup-wrap {
  position: relative;
}

.settings-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: rgba(15,23,42,0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  min-width: 180px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.popup-enter-active, .popup-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.popup-enter-from, .popup-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Toggle switch */
.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  background: rgba(255,255,255,0.1);
  cursor: pointer;
  padding: 0;
  transition: background 0.2s ease;
}
.toggle-switch.on {
  background: var(--accent-primary);
}
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}
.toggle-switch.on .toggle-thumb {
  transform: translateX(16px);
}

/* ── Sub display area ── */
.sub-display {
  display: flex;
  justify-content: center;
  min-height: 80px;
  align-items: center;
}

.no-sub-placeholder {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.5;
}

/* ─── THEATER MODE ACTIVE ─── */
.theater-mode-active {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  width: 100vw;
  height: 100vh;
  padding: 0;
}

.theater-mode-active .watch-layout {
  display: block;
  width: 100%;
  height: 100%;
}

.theater-mode-active .main-column {
  width: 100%;
  height: 100%;
  gap: 0;
}

.theater-mode-active .video-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  aspect-ratio: auto;
  border-radius: 0;
  z-index: 9999;
  background: #000;
  box-shadow: none;
}

/* ── Subtitle overlay ── */
.theater-subtitle-overlay {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  user-select: none;
  pointer-events: none;
  transition: top 0.08s ease;
}

/* Restore pointer events so clicking subtitle exits theater mode */
.theater-sub-clickable {
  pointer-events: all;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.theater-no-sub {
  height: 40px;
}

/* Drag handle */
.theater-drag-handle {
  color: rgba(255,255,255,0.45);
  cursor: ns-resize;
  pointer-events: all;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(4px);
  transition: color 0.2s, background 0.2s;
}
.theater-drag-handle:hover {
  color: rgba(255,255,255,0.85);
  background: rgba(0,0,0,0.5);
}

/* ── Theater controls overlay ── */
.theater-controls-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 1.5rem 2rem;
  background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.fade-ui-enter-active, .fade-ui-leave-active {
  transition: opacity 0.4s ease;
}
.fade-ui-enter-from, .fade-ui-leave-to {
  opacity: 0;
}

.theater-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.theater-settings {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

/* Theater control button */
.ctrl-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
  backdrop-filter: blur(8px);
}
.ctrl-btn svg {
  width: 18px;
  height: 18px;
}
.ctrl-btn:hover {
  background: rgba(59,130,246,0.2);
  border-color: rgba(59,130,246,0.5);
  color: #93c5fd;
  transform: scale(1.1);
}
.ctrl-btn.active {
  background: rgba(59,130,246,0.3);
  border-color: #3b82f6;
  color: #60a5fa;
  box-shadow: 0 0 12px rgba(59,130,246,0.4);
}

/* Toggle chips (theater) */
.toggle-chip {
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
  backdrop-filter: blur(8px);
}
.toggle-chip.on {
  background: rgba(59,130,246,0.25);
  border-color: rgba(59,130,246,0.6);
  color: #93c5fd;
}
.toggle-chip:hover {
  background: rgba(255,255,255,0.12);
  color: #fff;
}

/* Exit theater button */
.exit-theater-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(0,0,0,0.4);
  color: rgba(255,255,255,0.8);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
  backdrop-filter: blur(8px);
}
.exit-theater-btn svg {
  width: 14px;
  height: 14px;
}
.exit-theater-btn:hover {
  background: rgba(239,68,68,0.25);
  border-color: rgba(239,68,68,0.5);
  color: #fca5a5;
}

/* Subtitle Background transparency slider */
.transparency-slider-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.45);
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
}

.slider-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.transparency-slider {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  accent-color: var(--accent-primary);
}

.slider-value {
  font-size: 0.8rem;
  color: #93c5fd;
  font-weight: 600;
  min-width: 2.2rem;
  text-align: right;
}

/* Sidebar */
.sidebar-column {
  position: sticky;
  top: 5rem;
}

/* Video Meta Section */
.video-meta-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  gap: 1.5rem;
  border-radius: var(--radius-xl);
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 1rem;
}

.video-meta-info {
  flex: 1;
}

.video-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.video-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.video-meta-actions {
  display: flex;
  align-items: center;
}

.btn-create-list {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
}

.btn-create-list:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
}

.btn-create-list:active:not(:disabled) {
  transform: translateY(0);
}
</style>