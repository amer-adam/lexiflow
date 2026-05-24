<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

const { isAuthenticated, loginWithRedirect, logout, user, isLoading } = useAuth0()

// Floating Chinese characters for background ambiance
const floatingChars = ['学', '语', '流', '词', '音', '字', '识', '言', '读', '译', '听', '书']

const handleLogin = () => {
  loginWithRedirect()
}

const handleLogout = () => {
  logout({ logoutParams: { returnTo: window.location.origin } })
}
</script>

<template>
  <div class="app-container">
    <!-- Floating background characters (global) -->
    <div class="float-bg" aria-hidden="true">
      <span v-for="(ch, i) in floatingChars" :key="i" class="float-char" :style="{
        left: (7 + i * 8) + '%',
        animationDelay: (i * 0.6) + 's',
        animationDuration: (10 + i % 4 * 2.5) + 's',
        fontSize: (1.5 + i % 3 * 0.8) + 'rem',
        opacity: 0.04 + (i % 5) * 0.012
      }">{{ ch }}</span>
    </div>

    <header class="topbar glass-panel">
      <div class="logo">
        <RouterLink to="/">LexiFlow</RouterLink>
      </div>

      <nav class="nav-links">
        <RouterLink to="/" class="nav-link">Home</RouterLink>
        <RouterLink to="/req" class="nav-link">Request Mode</RouterLink>
        <RouterLink to="/library" class="nav-link" v-if="isAuthenticated">Library</RouterLink>
        <RouterLink to="/lists" class="nav-link" v-if="isAuthenticated">Vocabulary</RouterLink>
        <RouterLink to="/flashcards" class="nav-link" v-if="isAuthenticated">Flashcards</RouterLink>
      </nav>

      <div class="auth-section">
        <div v-if="isLoading" class="loading-state">Loading...</div>
        <template v-else>
          <div v-if="isAuthenticated" class="user-menu">
            <RouterLink to="/profile" class="profile-link">
              <img :src="user.picture" :alt="user.name" class="avatar" v-if="user.picture" />
              <span class="username">{{ user.name }}</span>
            </RouterLink>
            <button @click="handleLogout" class="btn btn-secondary btn-sm">Log Out</button>
          </div>
          <div v-else>
            <button @click="handleLogin" class="btn btn-primary">Log In / Sign Up</button>
          </div>
        </template>
      </div>
    </header>

    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
/* ── Floating BG characters ── */
.float-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.float-char {
  position: absolute;
  color: var(--text-primary);
  font-family: 'Outfit', serif;
  animation: floatUp linear infinite;
  user-select: none;
}

@keyframes floatUp {
  0% {
    transform: translateY(110vh) rotate(0deg);
    opacity: 0;
  }

  5% {
    opacity: 1;
  }

  95% {
    opacity: 1;
  }

  100% {
    transform: translateY(-20vh) rotate(20deg);
    opacity: 0;
  }
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  margin: 1rem 2rem;
  border-radius: var(--radius-xl);
  position: sticky;
  top: 1rem;
  z-index: 1000;
}

.logo a {
  font-family: 'Outfit', sans-serif;
  font-size: 1.5rem;
  font-weight: 800;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-link {
  color: var(--text-secondary);
  font-weight: 500;
  position: relative;
}

.nav-link.router-link-active {
  color: var(--text-primary);
}

.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--accent-gradient);
  border-radius: 2px;
}

.auth-section {
  display: flex;
  align-items: center;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.profile-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-primary);
}

.profile-link:hover {
  opacity: 0.8;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--accent-primary);
  object-fit: cover;
}

.username {
  font-weight: 500;
  font-size: 0.95rem;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}
</style>
