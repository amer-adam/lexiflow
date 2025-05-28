<template>
    <div class="sub-box">
        <p class="subtitle-text">{{ subtitle }}</p>
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
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.subtitle-text {
    margin: 0;
    word-break: break-word;
}
</style>