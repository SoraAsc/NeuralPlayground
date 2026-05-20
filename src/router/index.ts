import NeuralKart from '@/views/games/NeuralKart.vue'
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
    {
      path: '/game/neural-kart',
      name: 'Neural Kart',
      component: NeuralKart,
    },
  ],
})

export default router
