import NeuralKart from '@/views/games/NeuralKart.vue'
import NeuralSnake from '@/views/games/NeuralSnake.vue'
import InvertedPendulum from '@/views/games/InvertedPendulum.vue'
import NeuralFlappy from '@/views/games/NeuralFlappy.vue'
import Asteroids from '@/views/games/Asteroids.vue'
import NeuralPong from '@/views/games/NeuralPong.vue'
import HomeView from '@/views/HomeView.vue'
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
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
    {
      path: '/game/neural-pong',
      name: 'Neural Pong',
      component: NeuralPong,
    },
    {
      path: '/game/asteroids',
      name: 'Asteroids',
      component: Asteroids,
    },
  ],
})

export default router
