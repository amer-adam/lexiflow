<template>
  <div class="video-box">
    <div v-show="isYoutube" ref="youtubePlayer" id="youtube-player"></div>
    <video
      v-if="!isYoutube"
      class="video-native"
      ref="htmlPlayer"
      :src="parsedMediaUrl"
      controls
      @timeupdate="onHtmlTimeUpdate"
    ></video>
  </div>
</template>

<script>
export default {
  name: 'VideoBox',
  props: {
    videoUrl: {
      type: String,
      required: true
    },
    startTime: {
      type: Number,
      default: 0
    }
  },
  emits: ['time-update', 'duration-update'],
  data() {
    return {
      player: null,
      timeUpdateInterval: null
    };
  },
  computed: {
    isYoutube() {
      return this.videoUrl && !!this.videoUrl.match(/(?:youtube\.com|youtu\.be)/);
    },
    youtubeId() {
      if (!this.isYoutube) return null;
      const ytMatch = this.videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      return ytMatch ? ytMatch[1] : null;
    },
    parsedMediaUrl() {
      if (this.isYoutube) return null;
      const fileName = this.videoUrl.split('/').pop().split('\\').pop();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4556';
      return `${baseUrl}/media/${fileName}`;
    }
  },
  mounted() {
    if (this.isYoutube && this.youtubeId) {
      this.loadYouTubeAPI();
    }
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
        videoId: this.youtubeId,
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
      this.timeUpdateInterval = setInterval(() => {
        this.getCurrentTime();
      }, 100);
    },
    onPlayerStateChange(event) {
      if (event.data === window.YT.PlayerState.PLAYING) {
        clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = setInterval(() => {
          this.getCurrentTime();
        }, 100);
      } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.BUFFERING) {
        clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = setInterval(() => {
          this.getCurrentTime();
        }, 1000);
      } else {
        clearInterval(this.timeUpdateInterval);
      }
    },
    getCurrentTime() {
      if (this.player && this.player.getCurrentTime) {
        const currentTime = this.player.getCurrentTime();
        this.$emit('time-update', currentTime);
        if (this.player.getDuration) {
          const duration = this.player.getDuration();
          if (duration > 0) {
            this.$emit('duration-update', duration);
          }
        }
      }
    },
    onHtmlTimeUpdate() {
      if (this.$refs.htmlPlayer) {
        this.$emit('time-update', this.$refs.htmlPlayer.currentTime);
        if (this.$refs.htmlPlayer.duration) {
          this.$emit('duration-update', this.$refs.htmlPlayer.duration);
        }
      }
    },
    // ── Public control methods ──
    play() {
      if (this.player && this.player.playVideo) {
        this.player.playVideo();
      } else if (this.$refs.htmlPlayer) {
        this.$refs.htmlPlayer.play();
      }
    },
    pause() {
      if (this.player && this.player.pauseVideo) {
        this.player.pauseVideo();
      } else if (this.$refs.htmlPlayer) {
        this.$refs.htmlPlayer.pause();
      }
    },
    seekTo(time) {
      if (this.player && this.player.seekTo) {
        this.player.seekTo(time, true);
      } else if (this.$refs.htmlPlayer) {
        this.$refs.htmlPlayer.currentTime = time;
      }
    },
    getTime() {
      if (this.player && this.player.getCurrentTime) {
        return this.player.getCurrentTime();
      } else if (this.$refs.htmlPlayer) {
        return this.$refs.htmlPlayer.currentTime;
      }
      return 0;
    },
    getDuration() {
      if (this.player && this.player.getDuration) {
        return this.player.getDuration();
      } else if (this.$refs.htmlPlayer) {
        return this.$refs.htmlPlayer.duration || 0;
      }
      return 0;
    },
    isPlaying() {
      if (this.player && this.player.getPlayerState) {
        return this.player.getPlayerState() === window.YT.PlayerState.PLAYING;
      } else if (this.$refs.htmlPlayer) {
        return !this.$refs.htmlPlayer.paused;
      }
      return false;
    }
  },
  beforeDestroy() {
    clearInterval(this.timeUpdateInterval);
    if (this.player) {
      this.player.destroy();
    }
  },
  watch: {
    videoUrl(newUrl, oldUrl) {
      if (!newUrl) return;
      if (this.isYoutube && this.youtubeId) {
        if (this.player && this.player.loadVideoById) {
          this.player.loadVideoById({
            videoId: this.youtubeId,
            startSeconds: this.startTime
          });
        } else {
          this.loadYouTubeAPI();
        }
      } else if (this.$refs.htmlPlayer) {
        this.$refs.htmlPlayer.addEventListener('loadeddata', () => {
          this.$refs.htmlPlayer.currentTime = this.startTime || 0;
        }, { once: true });
      }
    },
    startTime(newTime) {
      if (this.player && this.player.seekTo) {
        this.player.seekTo(newTime, true);
      }
      if (this.$refs.htmlPlayer) {
        this.$refs.htmlPlayer.currentTime = newTime;
      }
    }
  }
};
</script>

<style scoped>
.video-box {
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

#youtube-player {
  width: 100%;
  height: 100%;
}

.video-native {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}
</style>