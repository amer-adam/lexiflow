<script setup>
import { useAuth0 } from '@auth0/auth0-vue'
import { ref, onMounted } from 'vue'

const { user } = useAuth0()

const nickname = ref('Guest')
const languagePreference = ref('en')
const autoplay = ref(true)

onMounted(() => {
  const profile = localStorage.getItem('lexiflow_profile')
  if (profile) {
    const data = JSON.parse(profile)
    nickname.value = data.nickname || 'Guest'
    languagePreference.value = data.languagePreference || 'en'
    autoplay.value = data.autoplay !== undefined ? data.autoplay : true
  }
})

const saveProfile = () => {
  const data = {
    nickname: nickname.value,
    languagePreference: languagePreference.value,
    autoplay: autoplay.value
  }
  localStorage.setItem('lexiflow_profile', JSON.stringify(data))
  alert('Profile preferences saved!')
}
</script>

<template>
  <div class="profile-page">
    <h1 class="page-title">My Profile</h1>
    
    <div class="profile-card glass-panel" v-if="user">
      <div class="profile-header">
        <div class="avatar-container">
          <img :src="user.picture" :alt="user.name" class="avatar-lg" />
          <div class="avatar-glow"></div>
        </div>
        <div class="user-info">
          <h2>{{ nickname !== 'Guest' ? nickname : user.name }}</h2>
          <p class="text-secondary">{{ user.email }}</p>
        </div>
      </div>
      
      <div class="profile-body">
        <div class="info-group">
          <label>Nickname</label>
          <input type="text" v-model="nickname" class="input-base" placeholder="Enter your nickname" />
        </div>
        
        <div class="info-group">
          <label>Target Language Translation</label>
          <select v-model="languagePreference" class="input-base">
            <option value="en">English (en)</option>
            <option value="es">Spanish (es)</option>
            <option value="fr">French (fr)</option>
            <option value="ar">Arabic (ar)</option>
          </select>
        </div>

        <div class="info-group checkbox-group">
          <label>
            <input type="checkbox" v-model="autoplay" />
            Autoplay next segment
          </label>
        </div>
      </div>
      
      <div class="profile-actions">
        <button class="btn btn-primary" @click="saveProfile">Save Profile</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 0;
}

.profile-card {
  width: 100%;
  max-width: 600px;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border-color);
}

.avatar-container {
  position: relative;
  width: 120px;
  height: 120px;
}

.avatar-lg {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  position: relative;
  z-index: 2;
  border: 4px solid var(--bg-primary);
}

.avatar-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--accent-gradient);
  filter: blur(20px);
  opacity: 0.5;
  z-index: 1;
}

.user-info h2 {
  margin-bottom: 0.5rem;
}

.profile-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-group label {
  font-size: 0.875rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.info-value {
  font-size: 1.125rem;
  color: var(--text-primary);
  background: rgba(0,0,0,0.2);
  padding: 1rem;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255,255,255,0.05);
}

.profile-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.profile-actions button {
  flex: 1;
}

.input-base {
  padding: 0.75rem;
  background: var(--bg-surface-light);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  text-transform: none;
}
</style>
