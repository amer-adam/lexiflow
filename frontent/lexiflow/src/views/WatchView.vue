<script>
import SubBox from '@/components/SubBox.vue';
import VideoBox from '@/components/VideoBox.vue';
import CharacterDisplay from '@/components/CharacterDisplay.vue';

export default {
  components: {
    VideoBox,
    SubBox, 
    CharacterDisplay,
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

      return currentSegment?.characters || {};
    },
    currentTranslation() {
      if (!this.subtitlesJson?.segments || this.subtitlesJson.segments.length === 0) return '';

      const currentSegment = this.subtitlesJson.segments.find(segment =>
        this.currentTime >= segment.start && this.currentTime < segment.end
      );

      return currentSegment?.translated_text || '';
    },
  }

};
</script>

<template>
  <div class="watch">
    <VideoBox :videoId=videoId @time-update="handleTimeUpdate" />
    <!-- <SubBox :subtitle=currentText /> -->
    <CharacterDisplay :characters="currentText" :translated_text="currentTranslation"/>
    <!-- <SubBox v-if="showPinyin" :subtitle=currentPinyin /> -->
    <!-- <SubBox :subtitle=currentTranslation /> -->
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