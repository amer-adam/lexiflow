<template>
    <div class="sub-box">
        <p class="subtitle-text">
            <span v-for="(word, index) in words" :key="index" class="word" @mouseover="showTooltip($event, word, index)"
                @mouseout="hideTooltip">
                {{ word }}
                
            </span>
        </p>
        <div v-if="showModal" class="word-count-modal"
            :style="{ top: modalPosition.y + 'px', left: modalPosition.x + 'px' }">
            {{ currentWordCount }}
        </div>
    </div>
</template>

<script>
export default {
    name: 'SubBox',
    props: {
        subtitle: {
            type: String,
            default: ''
        }
    },
    data() {
        return {
            showModal: false,
            currentWordCount: 0,
            modalPosition: { x: 0, y: 0 },
            currentWord: ''
        }
    },
    computed: {
        words() {
            return this.subtitle.split(' ');
        }
    },
    methods: {
        showTooltip(event, word, index) {
            this.currentWord = word;
            this.currentWordCount = index + 1;
            this.modalPosition = {
                x: event.target.offsetLeft + event.target.offsetWidth / 2,
                y: event.target.offsetTop - 30
            };
            this.showModal = true;
        },
        hideTooltip() {
            this.showModal = false;
        }
    }
}
</script>

<style scoped>
.sub-box {
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
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
}

.word {
    display: inline-block;
    position: relative;
    cursor: default;
}

.word-count-modal {
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
}

.word-count-modal::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px 5px 0;
    border-style: solid;
    border-color: white transparent transparent;
}
</style>