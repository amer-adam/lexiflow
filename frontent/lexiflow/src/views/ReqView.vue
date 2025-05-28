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
    <div>
      <input v-model="url" placeholder="Enter URL" class="urlInput" />
      <button :disabled="loading" @click="fetchWithGet">Request</button>
    </div>

    <div v-if="loading">Loading data...</div>

    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <button v-if="loaded" @click="goToVideo">Watch Video</button>

    </div>
    <div v-if="loading || loaded" class="terminal-output" ref="terminalOutput">
      <pre v-for="(line, index) in outputLines" :key="index">{{ line }}</pre>
    </div>
  </div>
</template>


<script>
export default {
  data() {
    return {
      url: '',  // Default URL
      jsonData: null,
      loading: false,
      error: null,
      loaded: false,
      outputLines: [],
      eventSource: null,
      jobId: null,
      jobStatusInterval: null,
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
          "url": "https://www.youtube.com/watch?v=x9vi6UfBgn4",
          "title": "Fanta - Nazi Favorite? | STUFF YOU SHOULD KNOW",
          "description": "(en) short history of Fanta",
          "eta": "14.25 mins ETA: 148.5 seconds",
          "thumbnail": "https://i.ytimg.com/vi/x9vi6UfBgn4/hqdefault.jpg",
        },
        {
          "url": "https://www.youtube.com/watch?v=Do412OfPPhU",
          "title": "EP 1 | Ask Dr. Athina",
          "description": "(my)(en) short video to test multi-language ",
          "eta": "4.55 mins ETA: 77.4 seconds",
          "thumbnail": "https://i.ytimg.com/vi/Do412OfPPhU/hqdefault.jpg",
        },
        {
          "url": "https://www.youtube.com/watch?v=kq1E_KANpZw",
          "title": "KELUANG MAN - FINAL TRAILER",
          "description": "(my) trailer to test sound effects",
          "eta": "1.1 mins ETA: 38.4 seconds",
          "thumbnail": "https://i.ytimg.com/vi/kq1E_KANpZw/hqdefault.jpg",
        }
      ]
    }
  },
  methods: {
    async fetchWithGet() {
      this.loading = true;
      this.error = null;
      this.connectStream();
      this.loaded = false;

      if (!this.url) {
        this.error = 'Please enter a valid URL.';
        this.loading = false;
        return;
      }

      try {
        const response = await fetch(
          `https://api.amerai.top/lexiflow/data/jobs`,
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

        const data = await response.json();
        this.jobId = data.job_id;
        this.startJobStatusPolling();
      } catch (err) {
        this.error = err.message;
        this.loading = false;
        this.disconnectStream();
      }
    },
    startJobStatusPolling() {
      this.jobStatusInterval = setInterval(async () => {
        try {
          const response = await fetch(
            `https://api.amerai.top/lexiflow/data/jobs/${this.jobId}`,
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

          const statusData = await response.json();

          if (statusData.status === 'completed') {
            this.getJobResult();
            clearInterval(this.jobStatusInterval);
          } else if (statusData.status === 'failed') {
            this.error = statusData.error || 'Job failed';
            this.loading = false;
            this.disconnectStream();
            clearInterval(this.jobStatusInterval);
          }
        } catch (err) {
          console.error('Error checking job status:', err);
        }
      }, 2500); // Check every 2.5 seconds
    },

    async getJobResult() {
      try {
        const response = await fetch(
          `https://api.amerai.top/lexiflow/data/jobs/${this.jobId}/result`,
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

        this.jsonData = await response.json();
        localStorage.setItem('subtitleJSON', JSON.stringify(this.jsonData));
        this.loading = false;
        this.loaded = true;
        this.disconnectStream();
      } catch (err) {
        this.error = err.message;
        this.loading = false;
        this.disconnectStream();
      }
    },

    goToVideo() {
      if (this.jsonData && this.url) {
        // Navigate to the video page with the videoId
        let videoId = this.youtube_parser(this.url);
        console.log('Parsed Video ID:', videoId);
        this.$router.push({ name: 'watch', params: { videoId: videoId } });
      } else {
        alert('No video ID found in the response.');
      }
    },
    youtube_parser(url) {
      var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
      var match = url.match(regExp);
      return (match && match[7].length == 11) ? match[7] : false;
    },
    connectStream() {
      if (this.eventSource) return;

      this.eventSource = new EventSource('https://api.amerai.top/lexiflow/data/logs');

      this.eventSource.onmessage = (event) => {
        this.outputLines.push(event.data);
        // Keep only the last 100 lines
        if (this.outputLines.length > 100) {
          this.outputLines.shift();
        }
        // Auto-scroll to bottom
        this.$nextTick(() => {
          const terminal = this.$refs.terminalOutput;
          if (terminal) {
            terminal.scrollTop = terminal.scrollHeight;
          }
        });
      };

      this.eventSource.onerror = (error) => {
        console.error('EventSource failed:', error);
        this.reconnect();
      };
    },
    disconnectStream() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    },
    reconnect() {
      this.disconnectStream();
      setTimeout(() => this.connectStream(), 5000);
    },
    openVideo(url) {
      this.url = url; // Set the URL to the clicked video
    },
  },
  beforeUnmount() {
    this.disconnectStream(); // Clean up
    if (this.jobStatusInterval) {
      clearInterval(this.jobStatusInterval);
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