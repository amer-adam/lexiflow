<script setup>
const props = defineProps({
    modelValue: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'submit']);
</script>

<template>
    <div class="variant-rendering-wrapper">
        <div class="input-entry-block">
            <input type="text" :value="modelValue" @input="emit('update:modelValue', $event.target.value)"
                placeholder="Type matching characters..." class="form-input text-center-bold"
                @keyup.enter="emit('submit')" autofocus />
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

.text-center-bold {
    text-align: center;
    font-size: 1.3rem;
    letter-spacing: 1px;
    font-weight: 600;
    max-width: 450px;
    margin: 0 auto;
}
</style>