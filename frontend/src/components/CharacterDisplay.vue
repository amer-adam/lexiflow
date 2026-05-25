<template>
  <div
    class="subtitle-card"
    :class="{ 'theater-sub': theaterMode }"
    :style="theaterMode ? { background: `rgba(0, 0, 0, ${subBgOpacity / 100})`, backdropFilter: subBgOpacity > 0 ? 'blur(8px)' : 'none', webkitBackdropFilter: subBgOpacity > 0 ? 'blur(8px)' : 'none' } : {}"
  >

    <!-- Tooltip -->
    <Transition>
      <div
        v-if="activeCharacter"
        class="character-tooltip"
        :style="{ left: modalPosition.x + 'px', top: modalPosition.y + 'px' }"
      >
        <div class="tooltip-header">
          <span class="tt-char" :style="{ color: getHskColor(activeCharacter.hsk_level) }">
            {{ stripCharacters(activeCharKey) }}
          </span>
          <span class="tt-pinyin">{{ activeCharacter.pinyin }}</span>
          <span class="tt-hsk">HSK {{ activeCharacter.hsk_level }}</span>
        </div>
        <div class="translations">
          <ul>
            <li v-for="(t, i) in activeCharacter.translations" :key="i">{{ t }}</li>
          </ul>
        </div>
      </div>
    </Transition>

    <!-- Paired pinyin + character columns -->
    <div class="chars-row" v-if="showCharacters || showPinyin">
      <div
        v-for="(char, key) in characters"
        :key="key"
        class="char-cell"
        :class="{ active: activeCharKey === key }"
        @mouseenter="showTooltip(key, $event)"
        @mouseleave="hideTooltip"
        @click="$emit('search-word', stripCharacters(key))"
      >
        <span
          v-if="showPinyin"
          class="cell-pinyin"
          :style="{ color: getHskColor(char.hsk_level) }"
        >
          {{ stripCharacters(char.pinyin) }}
        </span>
        <span
          v-if="showCharacters"
          class="cell-char"
          :style="{ color: getHskColor(char.hsk_level) }"
        >
          {{ stripCharacters(key) }}
        </span>
      </div>
    </div>

    <!-- Translation -->
    <div class="row-trans" v-if="showTranslation && translated_text">
      <span class="trans-text">{{ translated_text }}</span>
    </div>

  </div>
</template>

<script>
export default {
  props: {
    characters: {
      type: Object,
      required: true
    },
    translated_text: {
      type: String,
      default: ''
    },
    showPinyin: {
      type: Boolean,
      default: true
    },
    showCharacters: {
      type: Boolean,
      default: true
    },
    showTranslation: {
      type: Boolean,
      default: true
    },
    theaterMode: {
      type: Boolean,
      default: false
    },
    subBgOpacity: {
      type: Number,
      default: 50
    }
  },
  emits: ['search-word'],
  data() {
    return {
      activeCharKey: null,
      activeCharacter: null,
      modalPosition: { x: 0, y: 0 },
    }
  },
  methods: {
    getHskColor(level) {
      const colors = {
        1: '#4CAF50',
        2: '#8BC34A',
        3: '#FFC107',
        4: '#FF9800',
        5: '#FF5722',
        6: '#F44336'
      };
      return colors[level] || '#9E9E9E';
    },
    stripCharacters(text) {
      return text ? text.replace('@', '') : '';
    },
    showTooltip(charKey, event) {
      this.activeCharKey = charKey;
      this.activeCharacter = this.characters[charKey];

      const cell = event.currentTarget;
      const card = cell.closest('.subtitle-card');
      const cellRect = cell.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();

      this.modalPosition = {
        x: cellRect.left - cardRect.left + cellRect.width / 2,
        y: cellRect.top - cardRect.top - 8
      };
    },
    hideTooltip() {
      this.activeCharKey = null;
      this.activeCharacter = null;
    }
  }
}
</script>

<style scoped>
/* ── Transition ── */
.v-enter-active, .v-leave-active { transition: opacity 0.2s ease; }
.v-enter-from, .v-leave-to { opacity: 0; }

/* ── Card ── */
.subtitle-card {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 10px;
  padding: 8px 16px 12px;
  max-width: 1024px;
  width: fit-content;
  margin: 0 auto;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}

/* Theater mode: fully transparent bg, larger text */
.subtitle-card.theater-sub {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  border-radius: 0;
  padding: 4px 8px;
}

.theater-sub .cell-char {
  font-size: 2.25rem;
  text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1);
}

.theater-sub .cell-pinyin {
  font-size: 0.9rem;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
}

.theater-sub .trans-text {
  font-size: 1.1rem;
  text-shadow: 0 1px 6px rgba(0,0,0,0.9);
  color: rgba(255, 255, 255, 0.85);
}

/* ── Character cells row ── */
.chars-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 4px;
}

/* ── Each stacked pair ── */
.char-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  border-radius: 6px;
  padding: 2px 4px;
  transition: background 0.15s ease;
  min-width: 1.5em;
}

.char-cell:hover,
.char-cell.active {
  background: rgba(255, 255, 255, 0.08);
}

/* Scale both children when the cell is hovered */
.char-cell:hover .cell-pinyin,
.char-cell.active .cell-pinyin {
  transform: scale(1.1);
}
.char-cell:hover .cell-char,
.char-cell.active .cell-char {
  transform: scale(1.15);
}

.cell-pinyin {
  font-size: 0.75rem;
  font-family: 'Inter', sans-serif;
  line-height: 1.4;
  opacity: 0.85;
  text-align: center;
  transition: transform 0.15s ease;
  white-space: nowrap;
}

.cell-char {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
  transition: transform 0.15s ease;
}

/* ── Translation ── */
.row-trans {
  margin-top: 2px;
}

.trans-text {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
  letter-spacing: 0.01em;
}

/* ── Tooltip ── */
.character-tooltip {
  position: absolute;
  background: #1e293b;
  color: #f8fafc;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.82rem;
  z-index: 200;
  transform: translate(-50%, -100%);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  white-space: nowrap;
  max-width: 240px;
  pointer-events: none;
}

.character-tooltip::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 6px 6px 0;
  border-style: solid;
  border-color: #1e293b transparent transparent;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.tt-char {
  font-size: 1.4em;
  font-weight: 700;
}

.tt-pinyin {
  color: #94a3b8;
  font-style: italic;
  font-size: 0.9em;
}

.tt-hsk {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  color: #94a3b8;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.75em;
}

.translations ul {
  margin: 0;
  padding-left: 14px;
}

.translations li {
  font-size: 0.82em;
  color: #cbd5e1;
  margin-bottom: 2px;
  overflow-wrap: break-word;
  white-space: normal;
  max-width: 200px;
}
</style>