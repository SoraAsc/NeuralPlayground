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
      path: '/lab/neural-network',
      name: 'Neural Network Lab',
      component: () => import('@/views/NeuralNetworkLab.vue'),
    },
    {
      path: '/lab/color-predictor',
      name: 'Color Predictor',
      component: () => import('@/views/ColorPredictor.vue'),
    },
    {
      path: '/lab/shape-classifier',
      name: 'Shape Classifier',
      component: () => import('@/views/ShapeClassifier.vue'),
    },
    {
      path: '/game/neural-snake',
      name: 'Neural Snake',
      component: () => import('@/views/games/NeuralSnake.vue'),
    },
    {
      path: '/game/neural-kart',
      name: 'Neural Kart',
      component: () => import('@/views/games/NeuralKart.vue'),
    },
    {
      path: '/game/inverted-pendulum',
      name: 'Inverted Pendulum',
      component: () => import('@/views/games/InvertedPendulum.vue'),
    },
    {
      path: '/game/neural-flappy',
      name: 'Neural Flappy',
      component: () => import('@/views/games/NeuralFlappy.vue'),
    },
    {
      path: '/game/neural-pong',
      name: 'Neural Pong',
      component: () => import('@/views/games/NeuralPong.vue'),
    },
    {
      path: '/game/asteroids',
      name: 'Asteroids',
      component: () => import('@/views/games/Asteroids.vue'),
    },
  ],
})

export default router
