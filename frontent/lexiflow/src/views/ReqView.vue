<script>
import { FingerprintSpinner, HollowDotsSpinner } from 'epic-spinners'
import SvgIcon from '@jamescoyle/vue-icon'
import { mdiCheckAll, mdiYoutube, mdiCloudUpload, mdiLock, mdiEarth } from '@mdi/js'
import { useAuth0 } from '@auth0/auth0-vue'

export default {
  setup() {
    const { user, isAuthenticated } = useAuth0();
    return { user, isAuthenticated };
  },
  components: {
    FingerprintSpinner,
    HollowDotsSpinner,
    SvgIcon
  },
  data() {
    return {
      activeTab: 'youtube', // 'youtube' or 'local'
      url: '',
      localTitle: '',
      file: null,
      jsonData: null,
      error: null,
      state: 'idle', // idle, requesting, processing, queued, completed
      jobId: null,
      jobStatusInterval: null,
      progress: 0,
      pathCheck: mdiCheckAll,
      pathYoutube: mdiYoutube,
      pathUpload: mdiCloudUpload,
      pathLock: mdiLock,
      pathEarth: mdiEarth,
      isPrivate: false,
      queue_number: 0,
      eta: 0,
      time_counter: 0,
      time_counter_interval: null,
    }
  },
  methods: {
    onFileSelected(event) {
      if(event.target.files.length > 0) {
        this.file = event.target.files[0]
      }
    },
    async submitRequest() {
      // Reset statuses
      this.error = null;
      this.state = 'idle';
      this.progress = 0;
      this.queue_number = 0;
      this.eta = 0;
      this.time_counter = 0;
      if (this.jobStatusInterval) clearInterval(this.jobStatusInterval);
      if (this.time_counter_interval) clearInterval(this.time_counter_interval);

      if (this.activeTab === 'youtube' && !this.url) {
        this.error = 'Please enter a valid YouTube URL.'; return;
      }
      if (this.activeTab === 'local' && !this.file) {
        this.error = 'Please select a file to upload.'; return;
      }

      this.state = 'requesting';

      try {
        const userId = this.isAuthenticated && this.user ? this.user.sub : 'guest';

        if (this.activeTab === 'youtube') {
          // Existing Process YouTube URL (UC04)
          const response = await fetch(`https://api.amerai.top/lexiflow/jobs`, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ url: this.url, user_id: userId, is_private: this.isPrivate })
          });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          this.handleJobResponse(response);
        } else {
          // Local File Upload calling new Node.js endpoint
          if (!this.localTitle.trim()) {
            this.error = 'Title is required for local uploads.';
            return;
          }
          const formData = new FormData();
          formData.append('file', this.file);
          formData.append('title', this.localTitle);
          formData.append('user_id', userId);
          formData.append('is_private', this.isPrivate);
          
          const response = await fetch(`https://api.amerai.top/lexiflow/upload`, {
            method: 'POST', mode: 'cors',
            body: formData
          });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          this.handleJobResponse(response);
        }
      } catch (err) {
        this.error = err.message;
      }
    },
    async handleJobResponse(response) {
      const data = await response.json();
      if (response.status === 200) {
        this.jsonData = data.result;
        localStorage.setItem('subtitleJSON', JSON.stringify(this.jsonData));
        this.state = 'completed';
        this.progress = 100;
        if (data.from_cache) {
          alert("This video was found in the library and loaded immediately.");
        }
      } else if (response.status === 201) {
        this.jobId = data.job_id;
        if (data.queue_number > 0) {
          this.state = 'queued';
          this.queue_number = data.queue_number;
        } else {
          this.state = 'processing';
        }
        this.eta = parseInt(data.eta) || 0;
        this.startJobStatusPolling();
        this.startTimeUpdatePolling();
      }
    },
    startJobStatusPolling() {
      this.jobStatusInterval = setInterval(async () => {
        try {
          const response = await fetch(`https://api.amerai.top/lexiflow/jobs/${this.jobId}`, {
            mode: 'cors', headers: { 'Accept': 'application/json' }
          });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const responseData = await response.json();
          this.progress = responseData.progress || 0;

          if (responseData.status === 'completed') {
            this.jsonData = responseData.result;
            localStorage.setItem('subtitleJSON', JSON.stringify(this.jsonData));
            this.state = 'completed'; this.progress = 100;
            this.cleanupIntervals();
          } else if (responseData.status === 'queued') {
            this.state = 'queued'; this.queue_number = responseData.queue_number || 0;
            this.eta = parseInt(responseData.eta) || 0;
          } else if (responseData.status === 'processing') {
            this.state = 'processing'; this.eta = parseInt(responseData.eta) || 0;
          } else if (responseData.status === 'failed') {
            this.error = responseData.error || 'Job failed';
            this.state = 'idle'; this.cleanupIntervals();
          }
        } catch (err) { console.error('Polling error', err); }
      }, 10000);
    },
    startMockJobStatusPolling() {
      // Mock progress logic for UC05
      this.jobStatusInterval = setInterval(() => {
        if(this.state !== 'processing') return;
        this.progress += Math.floor(Math.random() * 20);
        if(this.progress >= 100) {
          this.progress = 100;
          this.state = 'completed';
          this.jsonData = { dummy: true };
          localStorage.setItem('subtitleJSON', JSON.stringify(this.jsonData));
          this.cleanupIntervals(); 
        }
      }, 2000);
    },
    startTimeUpdatePolling() {
      this.time_counter_interval = setInterval(() => { this.time_counter += 1; }, 1000);
    },
    cleanupIntervals() {
      if (this.jobStatusInterval) clearInterval(this.jobStatusInterval);
      if (this.time_counter_interval) clearInterval(this.time_counter_interval);
    },
    youtube_parser(url) {
      if(!url) return 'mock-video-id';
      let regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
      let match = url.match(regExp);
      if (match && match[2].length === 11) return match[2];
      let altRegExp = /^.*(youtube\.com\/shorts\/|youtube\.com\/watch\?v=)([^#&?\/]*).*/;
      let altMatch = url.match(altRegExp);
      if (altMatch && altMatch[2].length === 11) return altMatch[2];
      return 'mock-video-id';
    },
    goToVideo() {
      let videoId = 'mock-video-id';
      if(this.activeTab === 'youtube') videoId = this.youtube_parser(this.url);
      this.$router.push({ name: 'watch', params: { videoId: videoId } });
    }
  },
  beforeUnmount() {
    this.cleanupIntervals();
  },
  computed: {
    formatETA() {
      if (this.eta <= 0) return 'Calculating...';
      let remainingTime = this.eta - this.time_counter;
      if (remainingTime <= 0) remainingTime = 0;
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      return `${minutes} mins ${seconds} seconds`;
    }
  }
}
</script>

<template>
  <div class="request-page">
    <div class="request-card glass-panel">
      <h1 class="page-title">Request Content</h1>
      <p class="subtitle">Process a YouTube video or upload a local file to generate subtitles.</p>

      <div class="tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'youtube' }" @click="activeTab = 'youtube'">
          <svg-icon type="mdi" :path="pathYoutube" class="tab-icon"></svg-icon> YouTube URL
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'local' }" @click="activeTab = 'local'">
          <svg-icon type="mdi" :path="pathUpload" class="tab-icon"></svg-icon> Local File
        </button>
      </div>

      <div class="input-section" v-if="state === 'idle' || state === 'requesting' || error">
        <div v-if="activeTab === 'youtube'" class="youtube-mode">
          <input v-model="url" placeholder="https://www.youtube.com/watch?v=..." class="input-base large-input" />
        </div>
        <div v-if="activeTab === 'local'" class="local-mode">
          <input v-model="localTitle" placeholder="Title for local video" class="input-base large-input" style="margin-bottom: 1rem; width: 100%; box-sizing: border-box;" />
          <label class="file-drop-zone">
            <input type="file" @change="onFileSelected" accept="video/*,audio/*" class="file-input" />
            <div class="drop-content">
              <svg-icon type="mdi" :path="pathUpload" size="48" class="drop-icon"></svg-icon>
              <div class="drop-text">{{ file ? file.name : 'Click to select a video or audio file' }}</div>
            </div>
          </label>
        </div>

        <div class="privacy-toggle" v-if="isAuthenticated">
          <label class="toggle-label" :class="{ active: isPrivate }">
            <input type="checkbox" v-model="isPrivate" class="hidden-checkbox" />
            <div class="toggle-slider"></div>
            <span class="toggle-text">
              <svg-icon type="mdi" :path="pathLock" size="20" v-if="isPrivate"></svg-icon>
              <svg-icon type="mdi" :path="pathEarth" size="20" v-else></svg-icon>
              {{ isPrivate ? 'Private Video' : 'Public Video' }}
            </span>
          </label>
          <p class="privacy-hint" v-if="isPrivate">Only you can see this video in the library.</p>
          <p class="privacy-hint" v-else>Anyone can see this video in the public library.</p>
        </div>

        <div class="action-row">
          <button @click="submitRequest" class="btn btn-primary btn-submit" :disabled="state === 'requesting'">
            <span v-if="state === 'idle'">Process Content</span>
            <span v-else class="spinner-inline"><hollow-dots-spinner :animation-duration="1000" :dot-size="8" :dots-num="3" color="#fff" /></span>
          </button>
        </div>
        
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <!-- Progressive State UI -->
      <div v-if="state === 'queued'" class="status-panel">
        <div class="status-icon queued">🕒</div>
        <h2>Queued</h2>
        <p>Requests ahead: <strong>{{ queue_number }}</strong></p>
        <p>Estimated Time: {{ formatETA }}</p>
      </div>

      <div v-if="state === 'processing' || state === 'completed'" class="status-panel">
        <div class="progress-bar-container">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="progress-stages">
          <div class="stage" :class="{ active: progress > 0, done: progress > 25 }">
            <fingerprint-spinner v-if="progress <= 25 && state !== 'completed'" :size="32" color="var(--accent-primary)" />
            <svg-icon v-else type="mdi" :path="pathCheck" size="32" class="check-icon"></svg-icon>
            <span>Downloading</span>
          </div>
          <div class="stage" :class="{ active: progress > 25, done: progress > 50 }">
            <fingerprint-spinner v-if="progress > 25 && progress <= 50" :size="32" color="var(--accent-primary)" />
            <svg-icon v-else-if="progress > 50" type="mdi" :path="pathCheck" size="32" class="check-icon"></svg-icon>
            <div v-else class="stage-placeholder"></div>
            <span>Transcribing</span>
          </div>
          <div class="stage" :class="{ active: progress > 50, done: progress >= 100 }">
            <fingerprint-spinner v-if="progress > 50 && progress < 100" :size="32" color="var(--accent-primary)" />
            <svg-icon v-else-if="progress >= 100" type="mdi" :path="pathCheck" size="32" class="check-icon"></svg-icon>
            <div v-else class="stage-placeholder"></div>
            <span>Translating</span>
          </div>
        </div>

        <p v-if="state === 'processing'" class="eta-text">ETA: {{ formatETA }}</p>

        <div v-if="state === 'completed'" class="complete-action">
          <button @click="goToVideo" class="btn btn-primary btn-large">Watch Video</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.request-page {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.request-card {
  width: 100%;
  max-width: 800px;
  padding: 3rem;
  text-align: center;
}

.subtitle {
  color: var(--text-secondary);
  margin-bottom: 2.5rem;
}

.tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  background: rgba(0,0,0,0.2);
  padding: 0.5rem;
  border-radius: var(--radius-lg);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
}

.tab-btn:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.05);
}

.tab-btn.active {
  background: var(--bg-surface-light);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}

.large-input {
  font-size: 1.25rem;
  padding: 1.25rem;
  text-align: center;
}

.file-drop-zone {
  display: block;
  width: 100%;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 4rem 2rem;
  cursor: pointer;
  transition: var(--transition);
  background: rgba(0,0,0,0.1);
}

.file-drop-zone:hover {
  border-color: var(--accent-primary);
  background: rgba(59, 130, 246, 0.05);
}

.file-input {
  display: none;
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: var(--text-secondary);
}

.drop-text {
  font-size: 1.2rem;
  font-weight: 500;
}

.action-row {
  margin-top: 2rem;
}

.btn-submit {
  width: 100%;
  font-size: 1.25rem;
  padding: 1rem;
}

.error-msg {
  color: var(--danger);
  margin-top: 1rem;
  font-weight: 500;
}

/* Status Panels */
.status-panel {
  margin-top: 2rem;
  padding: 2rem;
  background: rgba(0,0,0,0.3);
  border-radius: var(--radius-lg);
}

.progress-bar-container {
  height: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2rem;
}

.progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  transition: width 0.3s ease;
}

.progress-stages {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  flex: 1;
  color: var(--text-muted);
}

.stage.active { color: var(--accent-primary); }
.stage.done { color: var(--success); }
.stage-placeholder { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--border-color); }
.check-icon { color: var(--success); }

.eta-text {
  font-size: 1.2rem;
  color: var(--text-secondary);
}

.complete-action {
  margin-top: 2rem;
}

.btn-large {
  font-size: 1.5rem;
  padding: 1rem 3rem;
}

/* Privacy Toggle */
.privacy-toggle {
  margin-top: 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  background: rgba(0,0,0,0.2);
  padding: 0.5rem 1.5rem;
  border-radius: 50px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: all 0.3s ease;
}

.toggle-label.active {
  background: rgba(239, 68, 68, 0.15); /* Subtle red/private indication */
  border-color: rgba(239, 68, 68, 0.4);
}

.hidden-checkbox {
  display: none;
}

.toggle-slider {
  width: 40px;
  height: 20px;
  background: rgba(255,255,255,0.2);
  border-radius: 10px;
  position: relative;
  transition: background 0.3s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s;
}

.hidden-checkbox:checked + .toggle-slider {
  background: var(--danger);
}

.hidden-checkbox:checked + .toggle-slider::after {
  transform: translateX(20px);
}

.toggle-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.privacy-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
}
</style>