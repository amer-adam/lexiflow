import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createAuth0 } from '@auth0/auth0-vue'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())

// Initialize Auth0 using the environment variables
// Note: If running locally without strict origin enforcement, these will initialize properly.
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN || 'example.auth0.com',
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || 'example-id',
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'http://localhost:3000'
    }
  })
)

app.use(router)

app.mount('#app')
