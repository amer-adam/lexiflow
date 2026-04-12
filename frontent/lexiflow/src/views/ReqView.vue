<template>

  <div class="sidebar">
    <h2 class="sidebar-title">Recommended Videos</h2>
    <div class="recommendations-list">
      <div v-for="(item, index) in recommended" :key="index" class="recommendation-card" @click="openVideo(item.url)">
        <div class="thumbnail-container">
          <img :src="item.thumbnail" :alt="item.title" class="thumbnail">
          <div class="play-icon">▶</div>
        </div>
        <div class="card-content">
          <h3 class="title">{{ item.title }}</h3>
          <p class="description">{{ item.description }}</p>
          <p class="description">{{ item.eta }}</p>
        </div>
      </div>
    </div>
  </div>

  <div class="request">
    <h1>This is request page</h1>
    <p>Here you can request a video to be added to the LexiFlow.</p>
    <div style="display: flex; flex-direction: row; align-items: center; gap: 10px;">
      <input v-model="url" placeholder="Enter URL" class="urlInput" />
      <button v-if="state === 'idle'" @click="fetchWithGet">Request</button>
      <hollow-dots-spinner v-if="state !== 'idle' && state !== 'completed' && !error" :animation-duration="1000"
        :dot-size="10" :dots-num="3" color="green" />

    </div>

    <div v-if="state === 'processing' || state === 'completed'">
      <!-- Progress bars container -->
      <div class="progress-container">
        <!-- Downloading progress -->
        <div class="progress-stage">
          <div class="progress-text"> Downloading </div>
          <fingerprint-spinner v-if="progress <= 25" :animation-duration="1500" :size="42" color="green" />
          <!-- Show check icon if progress > 25 -->
          <svg-icon v-if="progress > 25" type="mdi" :path="path" :size="42"></svg-icon>
        </div>

        <!-- Transcribing progress -->
        <div class="progress-stage">
          <div class="progress-text"> Transcribing </div>
          <fingerprint-spinner v-if="progress > 25 && progress <= 50" :animation-duration="1500" :size="42"
            color="green" />
          <!-- Show check icon if progress > 25 -->
          <svg-icon v-if="progress > 50" type="mdi" :path="path" :size="42"></svg-icon>
        </div>

        <!-- Translating progress -->
        <div class="progress-stage">
          <div class="progress-text"> Translating </div>
          <fingerprint-spinner v-if="progress > 50 && progress <= 75" :animation-duration="1500" :size="42"
            color="green" />
          <!-- Show check icon if progress > 25 -->
          <svg-icon v-if="progress > 75" type="mdi" :path="path" :size="42"></svg-icon>
        </div>
        <p v-if="state === 'processing'">Estimated Time: {{ formatETA }}</p>
      </div>
    </div>
    <div v-else-if="state === 'queued'">
      <p>Video is queued for processing. Please wait...</p>
      <p>requests ahead: {{ queue_number }}</p>
      <p>Estimated Time: {{ formatETA }}</p>
    </div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <button v-if="state === 'completed'" @click="goToVideo">Watch Video</button>
  </div>
</template>


<script>
import { FingerprintSpinner, HollowDotsSpinner } from 'epic-spinners'

import SvgIcon from '@jamescoyle/vue-icon'
import { mdiCheckAll } from '@mdi/js';

export default {
  components: {
    FingerprintSpinner,
    HollowDotsSpinner,
    SvgIcon
  },
  data() {
    return {
      url: '',  // Default URL
      jsonData: null,
      error: null,
      state: 'idle', // Reset state
      outputLines: [],
      eventSource: null,
      jobId: null,
      jobStatusInterval: null,
      progress: 0,
      recommended: [
        {
          "url": "https://www.youtube.com/watch?v=9FNRb71akL4",
          "title": "张谦和丝绸之路",
          "description": "(zh) true crime documentary",
          "eta": "51 mins ETA: 596.1 seconds",
          "thumbnail": "https://i.ytimg.com/vi/9FNRb71akL4/hqdefault.jpg",
        },
        {
          "url": "https://www.youtube.com/watch?v=7v2BMJvUhOk",
          "title": "TeaTime News 茶歇新闻 | 2024年12月20日: 习近平去澳门，退休年龄，死刑 ",
          "description": "(zh) quick news update from China",
          "eta": "9.7 mins  ETA: 96.1 seconds",
          "thumbnail": "https://i.ytimg.com/vi/7v2BMJvUhOk/hqdefault.jpg",
        },
        {
          "url": "https://www.youtube.com/watch?v=5fWvyFMrD9g",
          "title": "第93集: 张骞和丝绸之路 Zhang Qian and the Silk Road ",
          "description": "(zh) short history of Zhang Qian and the Silk Road",
          "eta": "24 mins  ETA: 179.13 seconds",
          "thumbnail": "https://i.ytimg.com/vi/5fWvyFMrD9g/hqdefault.jpg",
        },
        {
          "url": "https://www.youtube.com/shorts/Vz-stDkm0oc?feature=share",
          "title": "shorts test video ",
          "description": "(zh) short video to test shorts",
          "eta": "19 seconds ETA: 40 seconds",
          "thumbnail": "https://i.ytimg.com/vi/Vz-stDkm0oc/hqdefault.jpg",
        }
      ],
      path: mdiCheckAll,
      queue_number: 0, // Number of jobs in the queue
      eta: 0, // Estimated time for the job
      time_counter: 0, // Counter for the time elapsed
      time_counter_interval: null, // Interval for the time counter
    }
  },
  methods: {
    async fetchWithGet() {
      // Reset states before starting a new request
      this.error = null;
      this.state = 'idle'; // Reset state
      this.progress = 0; // Reset progress
      this.queue_number = 0; // Reset queue number
      this.eta = 0; // Reset ETA
      this.time_counter = 0; // Reset time counter
      if (this.jobStatusInterval) {
        clearInterval(this.jobStatusInterval);
      }
      if (this.time_counter_interval) {
        clearInterval(this.time_counter_interval);
      }

      // Start the request
      this.state = 'requesting'; // Set state to requesting

      if (!this.url) {
        this.error = 'Please enter a valid URL.';
        return;
      }

      try {
        const response = await fetch(
          `https://api.amerai.top/lexiflow/jobs`,
          {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ url: this.url })
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (response.status === 200) {
          const data = await response.json();
          this.jsonData = data.result;
          localStorage.setItem('subtitleJSON', JSON.stringify(this.jsonData));
          this.state = 'completed'; // Set state to completed
          this.progress = 100; // Set progress to 100% when completed
          clearInterval(this.jobStatusInterval);
          clearInterval(this.time_counter_interval);
        }
        else if (response.status === 201) {
          const data = await response.json();
          this.jobId = data.job_id;
          if (data.queue_number > 0) {
            this.state = 'queued'; // Set state to queued
            this.queue_number = data.queue_number || 0; // Set queue number if available
          } else {
            this.state = 'processing'; // Set state to processing
          }
          this.eta = parseInt(data.eta) || 0;
          this.startJobStatusPolling();
          this.startTimeUpdatePolling();
          console.log('data:', data);
        }

      } catch (err) {
        this.error = err.message;
        this.loading = false;
      }
    },
    startJobStatusPolling() {
      this.jobStatusInterval = setInterval(async () => {
        try {
          const response = await fetch(
            `https://api.amerai.top/lexiflow/jobs/${this.jobId}`,
            {
              mode: 'cors',
              headers: {
                'Accept': 'application/json',
              }
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const responseData = await response.json();
          this.progress = responseData.progress || 0;

          if (responseData.status === 'completed') {
            this.jsonData = responseData.result;
            localStorage.setItem('subtitleJSON', JSON.stringify(this.jsonData));
            this.state = 'completed'; // Set state to completed
            this.progress = 100; // Set progress to 100% when completed
            clearInterval(this.jobStatusInterval);
            clearInterval(this.time_counter_interval);
          } else if (responseData.status === 'queued') {
            this.state = 'queued'; // Set state to queued
            this.queue_number = responseData.queue_number || 0; // Update queue number
            this.eta = parseInt(responseData.eta) || 0; // Update ETA if available
          } else if (responseData.status === 'processing') {
            this.state = 'processing'; // Set state to processing
            this.eta = parseInt(responseData.eta) || 0; // Update ETA if available
          }
          else if (responseData.status === 'failed') {
            this.error = responseData.error || 'Job failed';
            this.state = 'idle'; // reSet state 
            clearInterval(this.jobStatusInterval);
            clearInterval(this.time_counter_interval);
          }
        } catch (err) {
          console.error('Error checking job status:', err);
        }
      }, this.fetchTimeInterval); // Check every 10 seconds
    },

    goToVideo() {
      if (this.jsonData && this.url) {
        // Navigate to the video page with the videoId

        let videoId = this.youtube_parser(this.url);

        console.log('Parsed Video ID:', videoId);
        this.$router.push({ name: 'watch', params: { videoId: videoId } });
      } else if (!this.url) {
        alert('Please enter a valid URL.');
      } else {
        alert('No video data available. Please try again later.');
      }
    },
    youtube_parser(url) {
      // Regular YouTube URLs and shorts
      var regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
      var match = url.match(regExp);

      // Check if we found a video ID and it's the correct length (11 characters)
      if (match && match[2].length === 11) {
        return match[2];
      }

      // Try to match YouTube URL patterns that might have additional parameters
      var altRegExp = /^.*(youtube\.com\/shorts\/|youtube\.com\/watch\?v=)([^#&?\/]*).*/;
      var altMatch = url.match(altRegExp);

      if (altMatch && altMatch[2].length === 11) {
        return altMatch[2];
      }

      return false;
    },
    openVideo(url) {
      this.url = url; // Set the URL to the clicked video
      // clear any previous error or loading state
      this.error = null;
      this.state = 'idle'; // Reset state
      this.progress = 0; // Reset progress
      this.queue_number = 0; // Reset queue number
      this.eta = 0; // Reset ETA
      this.time_counter = 0; // Reset time counter
      if (this.jobStatusInterval) {
        clearInterval(this.jobStatusInterval);
      }
      if (this.time_counter_interval) {
        clearInterval(this.time_counter_interval);
      }
    },

    startTimeUpdatePolling() {
      this.time_counter_interval = setInterval(async () => {
        this.time_counter += 1; // Increment the time counter every second
      }, 1000); // Check every 1 seconds
    },

  },
  beforeUnmount() {
    this.state = 'idle'; // Reset state
    if (this.jobStatusInterval) {
      clearInterval(this.jobStatusInterval);
    }
    if (this.time_counter_interval) {
      clearInterval(this.time_counter_interval);
    }
  },
  computed: {
    progressMessage() {
      if (this.progress <= 33) return `Downloading video... (${this.progress}%)`;
      if (this.progress <= 66) return `Transcribing audio... (${this.progress}%)`;
      return `Translating text... (${this.progress}%)`;
    },
    fetchTimeInterval() {
      // if (this.progress <= 33) return 3000; // 2.5 seconds for downloading
      return 10000; // 10 second for translating
    },
    formatETA() {
      if (this.eta <= 0) return 'Calculating...';
      let remainingTime = this.eta - this.time_counter;
      if (remainingTime <= 0) remainingTime = 0;
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      return `${minutes} mins ${seconds.toFixed(2)} seconds`;
    }
  },
}
</script>


<style scoped>
.request {
  /* display: flex; */
  /* flex-direction: column; */
  /* align-items: center; */
  /* justify-content: center; */
  /* height: 100vh; */
  /* background-color: #f0f0f0; */
  margin: 50px;
  width: 1280px;
  /* padding-right: 300px; */
}

.urlInput {
  width: 75%;
  padding: 10px;
  margin: 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.error {
  color: red;
}

/* pre { */
/* background: #f4f4f4; */
/* padding: 10px; */
/* border-radius: 5px; */
/* } */

.terminal-output {
  height: 700px;
  overflow-y: auto;
  background: #000;
  color: #0f0;
  padding: 10px;
  max-width: 75%;
  font-family: monospace;
  white-space: pre-wrap;
}


.progress-container {
  width: 100%;
  margin: 20px 0;
}

.progress-stage {
  margin-bottom: 10px;
  /* position: relative; */
  display: flex;
  flex-direction: row;
  align-self: start;
  /* justify-content: center; */
  align-items: center;
  min-height: 50px;
}

.progress-text {
  /* margin-top: 30px; */
  min-width: 100px;
  font-weight: bold;
  /* text-align: center; */
  margin-right: 20px;
}


.sidebar {
  position: fixed;
  right: 0;
  top: 0;
  width: 300px;
  /* height: 100vh; */
  height: calc(100vh - 100px);
  background: #1e1e1e;
  /* Dark background */
  /* border-left: 1px solid #333; */
  /* Darker border */
  border-radius: 16px;
  padding: 20px;
  overflow-y: auto;
  /* box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3); */
  /* z-index: 100; */
  margin-top: 50px;
  margin-bottom: 50px;
  margin-right: 40px;

}

.sidebar-title {
  margin: 0 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid #333;
  color: #f0f0f0;
  /* Light text */
  font-size: 1.1rem;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.recommendation-card {
  background: #2d2d2d;
  /* Dark card background */
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
  cursor: pointer;
}

.recommendation-card:hover {
  transform: translateX(-5px);
  background: #3a3a3a;
  /* Slightly lighter on hover */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.thumbnail-container {
  position: relative;
  width: 100%;
  height: 160px;
  overflow: hidden;
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.9);
  /* Slightly darker thumbnails */
}

.play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.2);
  /* Lighter overlay */
  backdrop-filter: blur(2px);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.card-content {
  padding: 12px;
}

.title {
  margin: 0;
  font-size: 0.95rem;
  color: #f0f0f0;
  /* Light text */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.description {
  margin: 5px 0 0;
  font-size: 0.8rem;
  color: #aaa;
  /* Lighter gray for description */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Scrollbar styling for dark mode */
.sidebar::-webkit-scrollbar {
  width: 8px;
}

.sidebar::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.sidebar::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: #666;
}


/* Responsive adjustments */
@media (max-width: 1200px) {

  .sidebar {
    position: static;
    width: 100%;
    height: auto;
    border-left: none;
    border-bottom: 1px solid #e0e0e0;
  }

  .recommendations-list {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 10px;
  }

  .recommendation-card {
    min-width: 200px;
  }
}
</style>