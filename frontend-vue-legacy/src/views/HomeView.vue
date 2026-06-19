<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

const router = useRouter()
const { loginWithRedirect, isAuthenticated } = useAuth0()

// Typewriter effect for the hero tagline
const taglines = [
  'Watch. Listen. Understand.',
  'Chinese content. Your pace.',
  'Every word. In context.',
]
const currentTagline = ref(taglines[0])
const displayedTagline = ref('')
const isTyping = ref(true)
let taglineIndex = 0
let charIndex = 0
let typingTimer = null

const typeWriter = () => {
  const target = taglines[taglineIndex]
  if (charIndex < target.length) {
    displayedTagline.value += target[charIndex]
    charIndex++
    typingTimer = setTimeout(typeWriter, 60)
  } else {
    setTimeout(eraseWriter, 2200)
  }
}

const eraseWriter = () => {
  if (displayedTagline.value.length > 0) {
    displayedTagline.value = displayedTagline.value.slice(0, -1)
    typingTimer = setTimeout(eraseWriter, 30)
  } else {
    taglineIndex = (taglineIndex + 1) % taglines.length
    charIndex = 0
    typingTimer = setTimeout(typeWriter, 400)
  }
}

onMounted(() => {
  typingTimer = setTimeout(typeWriter, 800)
})
onUnmounted(() => clearTimeout(typingTimer))

const handleCTA = () => {
  if (isAuthenticated.value) {
    router.push('/req')
  } else {
    loginWithRedirect()
  }
}

const features = [
  {
    icon: '🎬',
    title: 'Any Video, Instantly',
    desc: 'Paste a YouTube link or upload a local file. Our AI transcribes, translates, and prepares it for deep learning — automatically.'
  },
  {
    icon: '🔤',
    title: 'Live Subtitle Overlay',
    desc: 'Watch with synchronized bilingual subtitles. Every character color-coded by HSK level so you always know your blind spots.'
  },
  {
    icon: '🔍',
    title: 'Tap-to-Lookup',
    desc: 'Click any character in the subtitle to instantly look it up. See pinyin, definitions, HSK level, and every place it appears across your library.'
  },
  {
    icon: '📚',
    title: 'Personal Library',
    desc: 'All your content in one place — public or private. Filter by ownership, sort by date, and search across both titles and subtitles.'
  },
  {
    icon: '🔒',
    title: 'Privacy Control',
    desc: 'Mark your videos private so only you can find them, or make them public to contribute to the shared community library.'
  },
  {
    icon: '⏱',
    title: 'Time-Jump Search',
    desc: 'Search a word in the dictionary and jump directly to every occurrence across all your videos — exactly at the right timestamp.'
  }
]

const stats = [
  { value: '6+', label: 'Languages Detected' },
  { value: '< 15min', label: 'Avg. Processing Time' },
  { value: '100%', label: 'In-Context Learning' },
]
</script>

<template>
  <div class="home">

    <!-- ── HERO ── -->
    <section class="hero">
      <div class="hero-eyebrow">
        <span class="eyebrow-pill">AI-Powered Chinese Immersion</span>
      </div>

      <h1 class="hero-title">
        Learn Chinese
        <span class="gradient-word">the natural way</span>
      </h1>

      <p class="hero-tagline">
        <span class="typewriter">{{ displayedTagline }}</span><span class="cursor">|</span>
      </p>

      <p class="hero-sub">
        LexiFlow turns any Chinese video into an interactive lesson — with real-time subtitles,
        tap-to-lookup dictionary, and HSK-aware character highlighting.
      </p>

      <div class="hero-cta">
        <button class="btn btn-primary btn-hero" @click="handleCTA">
          Start Learning Free
          <svg class="btn-arrow" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
        <button class="btn btn-secondary" @click="router.push('/library')">Browse Library</button>
      </div>

      <!-- Stats row -->
      <div class="stats-row">
        <div v-for="stat in stats" :key="stat.label" class="stat-item">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </section>

    <!-- ── DEMO CARD ── -->
    <section class="demo-section">
      <div class="demo-card glass-panel">
        <div class="demo-video-row">
          <div class="demo-player">
            <div class="demo-screen">
              <div class="demo-play-ring">
                <div class="demo-play-btn">▶</div>
              </div>
              <span class="demo-label">YouTube / Local Video</span>
            </div>
          </div>
          <div class="demo-sidebar">
            <div class="demo-dict glass-panel">
              <div class="demo-dict-title">Dictionary Lookup</div>
              <div class="demo-dict-word">
                <span class="demo-hanzi">学习</span>
                <span class="demo-pinyin">xué xí</span>
              </div>
              <div class="demo-dict-def">to study; to learn</div>
              <div class="demo-occurrences">
                <div class="demo-occ-item" v-for="i in 2" :key="i">
                  <div class="demo-occ-bar"></div>
                  <span class="demo-occ-time">{{ i === 1 ? '0:12' : '1:47' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="demo-subtitles">
          <div class="demo-sub-line">
            <span class="demo-char hsk1">我</span>
            <span class="demo-char hsk1">在</span>
            <span class="demo-char hsk2 hsk-hl">学习</span>
            <span class="demo-char hsk3">中文</span>
          </div>
          <div class="demo-trans">I am studying Chinese</div>
          <div class="demo-pinyin-row">wǒ zài <span class="hl-pinyin">xué xí</span> zhōng wén</div>
        </div>
      </div>
    </section>

    <!-- ── FEATURES ── -->
    <section class="features-section">
      <div class="section-header">
        <span class="section-tag">Features</span>
        <h2>Everything you need to <span class="gradient-word">actually learn</span></h2>
        <p class="section-sub">Not flashcards. Not grammar drills. Real content, real context, real progress.</p>
      </div>

      <div class="features-grid">
        <div v-for="feat in features" :key="feat.title" class="feature-card glass-panel">
          <div class="feat-icon">{{ feat.icon }}</div>
          <h3>{{ feat.title }}</h3>
          <p>{{ feat.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ── HOW IT WORKS ── -->
    <section class="how-section">
      <div class="section-header">
        <span class="section-tag">How it works</span>
        <h2>Three steps to <span class="gradient-word">immersion</span></h2>
      </div>

      <div class="steps-row">
        <div class="step-card">
          <div class="step-number">01</div>
          <h3>Request a Video</h3>
          <p>Paste any YouTube URL or upload a local video file. Set it public or keep it private.</p>
        </div>
        <div class="step-connector"></div>
        <div class="step-card">
          <div class="step-number">02</div>
          <h3>AI Processes It</h3>
          <p>Our pipeline automatically transcribes, translates, and annotates every character with pinyin and HSK level.</p>
        </div>
        <div class="step-connector"></div>
        <div class="step-card">
          <div class="step-number">03</div>
          <h3>Watch & Learn</h3>
          <p>Watch with your bilingual subtitles. Tap any character to look it up. Jump to any occurrence in your library.</p>
        </div>
      </div>
    </section>

    <!-- ── CTA BANNER ── -->
    <section class="cta-banner glass-panel">
      <div class="cta-glow"></div>
      <h2>Ready to level up your Chinese?</h2>
      <p>Join LexiFlow and start watching your way to fluency — for free.</p>
      <button class="btn btn-primary btn-hero" @click="handleCTA">
        Get Started Now
        <svg class="btn-arrow" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
    </section>

  </div>
</template>

<style scoped>
/* ── Page base ── */
.home {
  position: relative;
  overflow: hidden;
}

/* ── HERO ── */
.hero {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 5rem 1rem 3rem;
  max-width: 820px;
  margin: 0 auto;
}

.hero-eyebrow {
  margin-bottom: 1.5rem;
}

.eyebrow-pill {
  display: inline-block;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: var(--accent-primary);
  padding: 0.4rem 1.2rem;
  border-radius: 50px;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.hero-title {
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1.25rem;
  color: var(--text-primary);
}

.gradient-word {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-tagline {
  font-size: clamp(1.2rem, 3vw, 1.6rem);
  font-weight: 600;
  color: var(--text-secondary);
  height: 2.2em;
  margin-bottom: 1.25rem;
}

.typewriter { color: var(--text-primary); }

.cursor {
  animation: blink 1s step-end infinite;
  color: var(--accent-primary);
  margin-left: 1px;
}
@keyframes blink { 50% { opacity: 0; } }

.hero-sub {
  font-size: 1.1rem;
  color: var(--text-secondary);
  line-height: 1.7;
  max-width: 640px;
  margin: 0 auto 2.5rem;
}

.hero-cta {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 3rem;
}

.btn-hero {
  font-size: 1.05rem;
  padding: 0.9rem 2rem;
  gap: 0.5rem;
}

.btn-arrow {
  width: 18px;
  height: 18px;
  transition: transform 0.25s ease;
}

.btn-hero:hover .btn-arrow {
  transform: translateX(4px);
}

/* Stats */
.stats-row {
  display: flex;
  justify-content: center;
  gap: 3rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.stat-value {
  font-family: 'Outfit', sans-serif;
  font-size: 1.75rem;
  font-weight: 800;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ── DEMO CARD ── */
.demo-section {
  position: relative;
  z-index: 1;
  padding: 2rem 0 4rem;
  max-width: 900px;
  margin: 0 auto;
}

.demo-card {
  padding: 2rem;
  overflow: hidden;
}

.demo-video-row {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.demo-player {
  background: #000;
  border-radius: 10px;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.demo-player::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(14,165,233,0.1) 100%);
}

.demo-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  z-index: 1;
}
.demo-play-ring {
  width: 64px; height: 64px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.3);
  display: flex; align-items: center; justify-content: center;
  animation: pulse-ring 2s ease infinite;
}
@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
  50%       { box-shadow: 0 0 0 12px rgba(59,130,246,0); }
}
.demo-play-btn {
  font-size: 1.5rem;
  color: white;
  padding-left: 4px;
}
.demo-label {
  color: rgba(255,255,255,0.5);
  font-size: 0.75rem;
}

.demo-sidebar {
  display: flex;
  flex-direction: column;
}

.demo-dict {
  padding: 1rem;
  height: 100%;
}

.demo-dict-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}

.demo-dict-word {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.demo-hanzi {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent-primary);
}

.demo-pinyin {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-style: italic;
}

.demo-dict-def {
  font-size: 0.8rem;
  color: var(--text-primary);
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.demo-occurrences {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.demo-occ-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.demo-occ-bar {
  flex: 1;
  height: 6px;
  background: rgba(59,130,246,0.25);
  border-radius: 3px;
}

.demo-occ-time {
  background: rgba(59,130,246,0.2);
  color: var(--accent-primary);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
}

/* Demo subtitles */
.demo-subtitles {
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.demo-sub-line {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  font-size: 1.5rem;
  margin-bottom: 0.4rem;
}

.demo-char {
  padding: 0 2px;
  border-radius: 3px;
  cursor: pointer;
  transition: transform 0.2s;
}
.demo-char:hover { transform: scale(1.15); }

.hsk1  { color: #4CAF50; }
.hsk2  { color: #8BC34A; }
.hsk3  { color: #FFC107; }

.hsk-hl {
  background: rgba(255,215,0,0.12);
  outline: 1px solid rgba(255,215,0,0.3);
}

.demo-trans {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-style: italic;
  margin-bottom: 0.25rem;
}

.demo-pinyin-row {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.hl-pinyin {
  color: #ffd700;
  font-weight: 700;
}

/* ── FEATURES ── */
.features-section {
  position: relative;
  z-index: 1;
  padding: 4rem 0;
}

.section-header {
  text-align: center;
  margin-bottom: 3rem;
}

.section-tag {
  display: inline-block;
  background: rgba(59,130,246,0.1);
  color: var(--accent-primary);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.3rem 1rem;
  border-radius: 50px;
  margin-bottom: 1rem;
}

.section-header h2 {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  margin-bottom: 0.75rem;
}

.section-sub {
  color: var(--text-secondary);
  font-size: 1.05rem;
  max-width: 540px;
  margin: 0 auto;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  padding: 1.75rem;
  transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-6px);
  border-color: rgba(59,130,246,0.35);
  box-shadow: var(--shadow-glow);
}

.feat-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
  display: block;
}

.feature-card h3 {
  font-size: 1.1rem;
  margin-bottom: 0.6rem;
  color: var(--text-primary);
}

.feature-card p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
}

/* ── HOW IT WORKS ── */
.how-section {
  position: relative;
  z-index: 1;
  padding: 4rem 0;
}

.steps-row {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
}

.step-card {
  flex: 1;
  min-width: 200px;
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-lg);
  padding: 2rem;
  transition: border-color 0.3s ease;
}

.step-card:hover {
  border-color: rgba(59,130,246,0.3);
}

.step-number {
  font-family: 'Outfit', sans-serif;
  font-size: 2.5rem;
  font-weight: 800;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.75rem;
  line-height: 1;
}

.step-card h3 {
  font-size: 1.1rem;
  margin-bottom: 0.6rem;
}

.step-card p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
}

.step-connector {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, rgba(59,130,246,0.4), rgba(14,165,233,0.2));
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .step-connector { width: 100%; height: 2px; }
  .steps-row { flex-direction: column; gap: 1rem; }
  .demo-video-row { grid-template-columns: 1fr; }
}

/* ── CTA BANNER ── */
.cta-banner {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 4rem 2rem;
  margin: 4rem 0;
  overflow: hidden;
}

.cta-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 200px;
  background: radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%);
  pointer-events: none;
}

.cta-banner h2 {
  font-size: clamp(1.5rem, 4vw, 2.2rem);
  margin-bottom: 0.75rem;
}

.cta-banner p {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  font-size: 1.05rem;
}
</style>