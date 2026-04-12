<template>
    <div class="character-container">
        <div v-for="(char, key) in characters" :key="key" class="character"
            :style="{ color: getHskColor(char.hsk_level) }" @mouseover="showTooltip(key, $event)"
            @mouseout="hideTooltip">
            {{ stripCharacters(key) }}
        </div>
        <Transition>
            <div v-if="activeCharacter && showCharacterTooltip" class="character-tooltip"
                :style="{ top: modalPosition.y + 'px', left: modalPosition.x + 'px' }">
                <div class="tooltip-header">
                    <span class="character" :style="{ color: getHskColor(activeCharacter.hsk_level) }">
                        {{ activeCharKey }}
                    </span>
                    <span class="pinyin">{{ activeCharacter.pinyin }}</span>
                    <span class="hsk-level">HSK {{ activeCharacter.hsk_level }}</span>
                </div>
                <div class="translations">
                    <h4>Definitions:</h4>
                    <ul>
                        <li v-for="(translation, index) in activeCharacter.translations" :key="index">
                            {{ translation }}
                        </li>
                    </ul>
                </div>
            </div>
        </Transition>
    </div>
        <div class="pinyin-container">
        <div v-for="(char, key) in characters" :key="key" class="word"
            :style="{ color: getHskColor(char.hsk_level) }" @mouseover="showTooltip(key, $event, true)"
            @mouseout="hideTooltip">
            {{ stripCharacters(char.pinyin) }}
        </div>
        <Transition>
            <div v-if="activeCharacter && showPinyinTooltip" class="character-tooltip"
                :style="{ top: modalPosition.y + 'px', left: modalPosition.x + 'px' }">
                <div class="tooltip-header">
                    <span class="character" :style="{ color: getHskColor(activeCharacter.hsk_level) }">
                        {{ activeCharKey }}
                    </span>
                    <span class="pinyin">{{ activeCharacter.pinyin }}</span>
                    <span class="hsk-level">HSK {{ activeCharacter.hsk_level }}</span>
                </div>
                <div class="translations">
                    <h4>Definitions:</h4>
                    <ul>
                        <li v-for="(translation, index) in activeCharacter.translations" :key="index">
                            {{ translation }}
                        </li>
                    </ul>
                </div>
            </div>
        </Transition>
    </div>
            <div class="translation-container">
        <p class="subtitle-text">{{ translated_text }}</p>
       
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
        }
    },
    data() {
        return {
            activeCharKey: null,
            activeCharacter: null,
            showCharacterTooltip: false,
            showPinyinTooltip: false,
            modalPosition: { x: 0, y: 0 },

        }
    },
    methods: {
        getHskColor(level) {
            // Color coding based on HSK level
            const colors = {
                1: '#4CAF50', // Green
                2: '#8BC34A',
                3: '#FFC107', // Yellow
                4: '#FF9800', // Orange
                5: '#FF5722', // Deep Orange
                6: '#F44336'  // Red
            };
            return colors[level] || '#9E9E9E'; // Gray for unknown levels
        },
        stripCharacters(text) {
            return text.replace('@', '');
        },
        showTooltip(charKey, event, pinyin = false) {
            if (pinyin) {
                this.showPinyinTooltip = true;
            } else {
                this.showCharacterTooltip = true;
            }
            this.activeCharKey = charKey;
            this.activeCharacter = this.characters[charKey];
            // this.showCharacterTooltip = true;

            let num_translations = this.activeCharacter.translations ? this.activeCharacter.translations.length : 0;
            let num_newlines = 0;

            for (let i = 0; i < this.activeCharacter.translations.length; i++) {
                num_newlines += Math.floor(this.activeCharacter.translations[i].length / 27);
                // console.log(num_translations);
            }

            let y_offset = 90 + (num_translations * 24) + (num_newlines * 19);

            // Position the tooltip near the character
            this.modalPosition = {
                x: event.target.offsetLeft + event.target.offsetWidth / 2,
                y: event.target.offsetTop - y_offset
            };
        },
        hideTooltip() {
            this.showCharacterTooltip = false;
            this.showPinyinTooltip = false;
        }
    },

}
</script>

<style scoped>
/* we will explain what these classes do next! */
.v-enter-active,
.v-leave-active {
    transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
    opacity: 0;
}

.character-container {
    background: rgba(0, 0, 0, 0.7);
    padding: 16px 24px;
    border-radius: 8px;
    max-width: 1024px;
    min-height: 70px;
    height: auto;
    margin: 0 auto;
    text-align: center;
    font-size: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    position: relative;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;


}

.pinyin-container {
    background: rgba(0, 0, 0, 0.7);
    padding: 16px 24px;
    border-radius: 8px;
    max-width: 1024px;
    min-height: 70px;
    height: auto;
    margin: 0 auto;
    text-align: center;
    font-size: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    position: relative;
}

.translation-container {
    background: rgba(0, 0, 0, 0.7);
    padding: 16px 24px;
    border-radius: 8px;
    max-width: 1024px;
    min-height: 70px;
    height: auto;
    margin: 0 auto;
    text-align: center;
    font-size: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    position: relative;
}

.subtitle-text {
    margin: 0;
    word-break: break-word;
    font-size: 1.5rem;
    color: #9E9E9E;
    padding: 10px;
    line-height: 1.5;
    max-width: 100%;
    overflow-wrap: break-word;
    word-wrap: break-word;
    white-space: normal !important;
    text-align: center;
}

.word {
    display: inline-block;
    position: relative;
    cursor: default;
    transition: transform 0.2s;
    margin-right: 10px;

}
.word:hover {
    transform: scale(1.2);
}


.character {
    cursor: pointer;
    transition: transform 0.2s;
    /* font-size: 2em; */
    margin-right: 10px;
}

.character:hover {
    transform: scale(1.2);
}

.character-tooltip {
    position: absolute;
    background: white;
    color: black;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    z-index: 100;
    transform: translateX(-50%);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    white-space: nowrap;
    max-width: 300px;
    /* animation: fadeIn 0.2s ease-in-out; */
}

.character-tooltip::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px 5px 0;
    border-style: solid;
    border-color: white transparent transparent;
}


.tooltip-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
}

.tooltip-header .character {
    font-size: 1.5em;
    font-weight: bold;
}

.tooltip-header .pinyin {
    color: #666;
    font-style: italic;
}

.tooltip-header .hsk-level {
    background: #eee;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8em;
}

.translations h4 {
    margin: 5px 0;
    font-size: 1em;
    color: #333;
}

.translations ul {
    margin: 0;
    padding-left: 20px;
}

.translations li {
    margin-bottom: 5px;
    font-size: 0.9em;
    color: #555;
    overflow-wrap: break-word;
    word-wrap: break-word;
    white-space: normal !important;
    max-width: 150px;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(5px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>