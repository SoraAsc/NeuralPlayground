import NeuralKart from '@/views/games/NeuralKart.vue'
import NeuralSnake from '@/views/games/NeuralSnake.vue'
import InvertedPendulum from '@/views/games/InvertedPendulum.vue'
import NeuralFlappy from '@/views/games/NeuralFlappy.vue'
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
    {
      path: '/game/inverted-pendulum',
      name: 'Inverted Pendulum',
      component: InvertedPendulum,
    },
    {
      path: '/game/neural-flappy',
      name: 'Neural Flappy',
      component: NeuralFlappy,
    },
  ],
})

export default router
