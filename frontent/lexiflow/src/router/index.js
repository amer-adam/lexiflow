import { createRouter, createWebHistory } from 'vue-router'
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
      path: '/watch:videoId',
      name: 'watch',
      component: WatchView,
      props: true, 
    },
    {
      path: '/req',
      name: 'request',
      component: ReqView,
    },
  ],
})

export default router
