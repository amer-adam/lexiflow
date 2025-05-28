<script>
import SubBox from '@/components/SubBox.vue';
import VideoBox from '@/components/VideoBox.vue';


export default {
  components: {
    VideoBox,
    SubBox,
  },
  props: {
    videoId: {
      type: String,
      default: '9FNRb71akL4', // Default video ID if not provided
    },
  },
  data() {
    return {
      // currentVideoId: this.$route.params.videoId? this.$route.params.videoId : '9FNRb71akL4', // Default video ID if not provided
      currentTime: 0.0,
      subtitlesJson: { segments: [] }, // Initialize with empty segments
    };
  },
  methods: {
    handleTimeUpdate(time) {
      this.currentTime = time;
    },
  },
  async mounted() {
    const storedSubtitles = localStorage.getItem(`subtitleJSON`);
    if (storedSubtitles) {
      this.subtitlesJson = JSON.parse(storedSubtitles);
      console.log('Subtitles loaded from localStorage:', this.subtitlesJson);
    }
  },
  computed: {
    currentText() {
      if (!this.subtitlesJson?.segments || this.subtitlesJson.segments.length === 0) return '';

      const currentSegment = this.subtitlesJson.segments.find(segment =>
        this.currentTime >= segment.start && this.currentTime < segment.end
      );

      return currentSegment?.text || '';
    },
    currentTranslation() {
      if (!this.subtitlesJson?.segments || this.subtitlesJson.segments.length === 0) return '';

      const currentSegment = this.subtitlesJson.segments.find(segment =>
        this.currentTime >= segment.start && this.currentTime < segment.end
      );

      return currentSegment?.translated_text || '';
    },
    currentPinyin() {
      if (!this.subtitlesJson?.segments || this.subtitlesJson.segments.length === 0) return '';

      const currentSegment = this.subtitlesJson.segments.find(segment =>
        this.currentTime >= segment.start && this.currentTime < segment.end
      );

      return currentSegment?.pinyin || '';
    },
    showPinyin() {
      if (!this.subtitlesJson?.language || this.subtitlesJson.segments.length === 0) return false;

      const source_language = this.subtitlesJson.language.toLowerCase();
      console.log('Source Language:', source_language);
      // Check if the source language is Chinese 
      if (source_language === 'zh') {
        return true;
      }
      else {
        return false;;
      }
    },
  }

};
</script>

<template>
  <div class="watch">
    <VideoBox :videoId=videoId @time-update="handleTimeUpdate" />
    <SubBox :subtitle=currentText />
    <SubBox v-if="showPinyin" :subtitle=currentPinyin />
    <SubBox :subtitle=currentTranslation />
  </div>
</template>

<style scoped>
.watch {
  /* display: flex; */
  /* flex-direction: column; */
  /* align-items: center; */
  /* justify-content: center; */
  /* height: 100vh; */
  /* background-color: #f0f0f0; */
  margin: 50px;
  width: 1280px;
}
</style>