import NeuralSnake from '@/views/games/NeuralSnake.vue'
import HomeView from '@/views/HomeView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/game/neural-snake',
      name: 'Neural Snake',
      component: NeuralSnake,
    },
  ],
})

export default router
