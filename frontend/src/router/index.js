import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from '@auth0/auth0-vue'
import HomeView from '../views/HomeView.vue'
import WatchView from '../views/WatchView.vue'
import ReqView from '../views/ReqView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      beforeEnter: authGuard
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('../views/LibraryView.vue'),
      beforeEnter: authGuard
    },
    {
      path: '/watch:videoId',
      name: 'watch',
      component: WatchView,
      props: true,
    },
    {
      path: '/req',
      name: 'request',
      component: ReqView,
      beforeEnter: authGuard
    },
  ],
})

export default router
