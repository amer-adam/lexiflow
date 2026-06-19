<script setup>
const props = defineProps({
    modelValue: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
    <div class="variant-rendering-wrapper">
        <div class="input-entry-block">
            <textarea :value="modelValue" @input="emit('update:modelValue', $event.target.value)"
                placeholder="Type your complete contextual translation answer..." class="form-input text-area-bold"
                rows="3"></textarea>
        </div>
    </div>
</template>

<style scoped>
.variant-rendering-wrapper {
    margin-bottom: 2.5rem;
}

.form-input {
    width: 100%;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: white;
    font-size: 0.95rem;
}

.text-area-bold {
    font-size: 1.1rem;
    line-height: 1.5;
    resize: none;
}
</style>