<script setup>
const props = defineProps({
    modelValue: { type: String, default: null }
});

const emit = defineEmits(['update:modelValue']);

function selectValue(val) {
    emit('update:modelValue', val);
}
</script>

<template>
    <div class="variant-rendering-wrapper">
        <div class="tf-flex-grid">
            <button @click="selectValue('TRUE')"
                :class="['tf-btn btn-true', { 'selected-true': modelValue === 'TRUE' }]">
                正确 (True)
            </button>
            <button @click="selectValue('FALSE')"
                :class="['tf-btn btn-false', { 'selected-false': modelValue === 'FALSE' }]">
                错误 (False)
            </button>
        </div>
    </div>
</template>

<style scoped>
.variant-rendering-wrapper {
    margin-bottom: 2.5rem;
}

.tf-flex-grid {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    max-width: 500px;
    margin: 0 auto;
    width: 100%;
}

.tf-btn {
    flex: 1;
    padding: 1.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    color: white;
}

.btn-true {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
}

.btn-true:hover {
    background: rgba(16, 185, 129, 0.25);
}

.btn-true.selected-true {
    background: #10b981;
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
}

.btn-false {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
}

.btn-false:hover {
    background: rgba(239, 68, 68, 0.25);
}

.btn-false.selected-false {
    background: #ef4444;
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
}
</style>