<script setup lang="ts">
import ExperimentCard from '@/features/experiments/ui/ExperimentCard.vue'
</script>

<template>
  <main class="container mx-auto px-4 py-6">
    <div class="max-w-2xl mb-12">
      <h1 class="text-3xl font-bold text-foreground mb-3 tracking-tight">Neural Playground</h1>
      <p class="text-muted-foreground leading-relaxed">
        Explore, train, and test neural networks applied to interactive minigames. Each game
        implements a different machine learning algorithm.
      </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <experiment-card
        href="/game/neural-snake"
        category="Q-Learning"
        title="Neural Snake"
        description="A snake controlled by a neural network trained using Q-learning. Watch as the AI learns to find food and avoid collisions."
      />
      <experiment-card
        href="/game/neural-pong"
        category="..."
        title="Neural Pong"
        :is-enabled="false"
        description="Two AI agents compete against each other using ... to master the game of Pong."
      />
    </div>
  </main>
</template>
