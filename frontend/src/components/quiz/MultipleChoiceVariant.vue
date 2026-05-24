<script setup>
import { computed } from 'vue';

const props = defineProps({
    question: { type: Object, required: true },
    modelValue: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue']);

// Safely reconstruct the choices pool, accommodating options arrays or separate distractors fields
const compiledOptions = computed(() => {
    if (props.question.options && props.question.options.length) {
        return props.question.options;
    }
    const answer = props.question.correct_answer || props.question.correctAnswer || '';
    const distractors = props.question.distractors || [];
    return [...distractors, answer];
});

function selectOption(option) {
    emit('update:modelValue', option);
}
</script>

<template>
    <div class="variant-rendering-wrapper">
        <div class="options-grid">
            <button v-for="(option, oIdx) in compiledOptions" :key="oIdx" @click="selectOption(option)"
                :class="['option-btn', { 'selected': modelValue === option }]">
                <span :class="{ 'long-text-scale': option.length > 10 }">{{ option }}</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
.variant-rendering-wrapper {
    margin-bottom: 2.5rem;
}

.options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

@media (max-width: 576px) {
    .options-grid {
        grid-template-columns: 1fr;
    }
}

.option-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.25rem;
    border-radius: 8px;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.option-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
}

.option-btn.selected {
    background: rgba(79, 70, 229, 0.25);
    border-color: #6366f1;
}

.long-text-scale {
    font-size: 0.95rem !important;
    line-height: 1.4;
}
</style>