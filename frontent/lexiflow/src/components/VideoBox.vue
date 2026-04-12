<template>
  <div class="video-box">
    <div ref="youtubePlayer" id="youtube-player"></div>
  </div>
</template>

<script>
export default {
  name: 'VideoBox',
  props: {
    videoId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      player: null,
      timeUpdateInterval: null
    };
  },
  mounted() {
    this.loadYouTubeAPI();
  },
  methods: {
    loadYouTubeAPI() {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          this.createPlayer();
        };
      } else {
        this.createPlayer();
      }
    },
    createPlayer() {
      if (this.player) {
        this.player.destroy();
      }

      this.player = new window.YT.Player(this.$refs.youtubePlayer, {
        height: '100%',
        width: '100%',
        videoId: this.videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          start: this.startTime
        },
        events: {
          'onReady': this.onPlayerReady,
          'onStateChange': this.onPlayerStateChange
        }
      });
    },
    onPlayerReady(event) {
      // Start tracking time updates
      this.timeUpdateInterval = setInterval(() => {
        this.getCurrentTime();
      }, 100); // Update every second
    },
    onPlayerStateChange(event) {
      // Clean up interval when video ends
      if (event.data === window.YT.PlayerState.PLAYING) {
        clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = setInterval(() => {
          this.getCurrentTime();
        }, 100); // Update every 0.1 second
      }
      else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.BUFFERING) {
        clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = setInterval(() => {
          this.getCurrentTime();
        }, 1000); // Update every second
      }
      else {
        clearInterval(this.timeUpdateInterval);
      }
    },
    getCurrentTime() {
      if (this.player && this.player.getCurrentTime) {
        const currentTime = this.player.getCurrentTime();
        this.$emit('time-update', currentTime);
      }
    }
  },
  beforeDestroy() {
    clearInterval(this.timeUpdateInterval);
    if (this.player) {
      this.player.destroy();
    }
  },
  watch: {
    videoId(newId) {
      if (newId && this.player) {
        this.player.loadVideoById({
          videoId: newId,
          startSeconds: this.startTime
        });
      }
    },
    startTime(newTime) {
      if (this.player && this.player.seekTo) {
        this.player.seekTo(newTime, true);
      }
    }
  }
};
</script>


<style scoped>
.video-box {
  /* width: 100%; */
  width: 1024px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.no-video {
  color: #fff;
  text-align: center;
}
</style>