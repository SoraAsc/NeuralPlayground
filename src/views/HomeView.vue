<script setup lang="ts">
import ExperimentCard from '@/features/experiments/ui/ExperimentCard.vue'

const experiments = [
  {
    href: '/game/neural-snake',
    algorithm: 'Q-Learning',
    actionSpace: 'Discreto',
    engine: 'Unity',
    title: 'Neural Snake',
    repositoryUrl: 'https://github.com/SoraAsc/NeuralSnake',
    preview: 'snake' as const,
    description:
      'Múltiplas serpentes aprendem a buscar alimento e evitar colisões em simulações aceleradas.',
  },
  {
    href: '/game/neural-kart',
    algorithm: 'PPO',
    actionSpace: 'Contínuo',
    engine: 'PixiJS',
    title: 'Neural Kart',
    repositoryUrl:
      'https://github.com/SoraAsc/NeuralPlayground/tree/main/src/features/pixijs/neural-kart',
    preview: 'kart' as const,
    description:
      'Pilotos compartilham uma política e aprendem a percorrer pistas procedurais usando sensores de distância.',
  },
  {
    href: '/game/inverted-pendulum',
    algorithm: 'PPO',
    actionSpace: 'Contínuo',
    engine: 'PixiJS',
    title: 'Inverted Pendulum',
    repositoryUrl:
      'https://github.com/SoraAsc/NeuralPlayground/tree/main/src/features/pixijs/inverted-pendulum',
    preview: 'pendulum' as const,
    description:
      'Uma política controla a força horizontal da base para equilibrar um pêndulo invertido.',
  },
  {
    href: '/game/neural-flappy',
    algorithm: 'PPO',
    actionSpace: 'Discreto',
    engine: 'PixiJS',
    title: 'Neural Flappy',
    repositoryUrl:
      'https://github.com/SoraAsc/NeuralPlayground/tree/main/src/features/pixijs/flappy-bird',
    preview: 'flappy' as const,
    description:
      'Doze ambientes vetorizados treinam uma única política para atravessar sequências de obstáculos.',
  },
  {
    href: '/game/neural-pong',
    algorithm: 'Q-Learning',
    actionSpace: 'Discreto',
    engine: 'PixiJS',
    title: 'Neural Pong',
    repositoryUrl:
      'https://github.com/SoraAsc/NeuralPlayground/tree/main/src/features/pixijs/neural-pong',
    preview: 'pong' as const,
    description:
      'Duas raquetes treinam em self-play simétrico compartilhando uma Q-table discretizada.',
  },
  {
    href: '/game/asteroids',
    algorithm: 'PPO',
    actionSpace: 'Multidiscreto',
    engine: 'PixiJS',
    title: 'Asteroids',
    repositoryUrl:
      'https://github.com/SoraAsc/NeuralPlayground/tree/main/src/features/pixijs/asteroids',
    preview: 'asteroids' as const,
    description:
      'Naves aprendem a prever ameaças, navegar e destruir ondas de asteroides em paralelo.',
  },
]
</script>

<template>
  <main class="container mx-auto px-4 pb-14 pt-10">
    <section class="grid gap-10 border-b border-border pb-12 md:grid-cols-[1fr_auto] md:items-end">
      <div class="max-w-3xl">
        <p class="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          Reinforcement learning laboratory
        </p>
        <h1 class="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-foreground md:text-6xl">
          Aprendizado por reforço, em movimento.
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Treine, observe e compare agentes neurais em ambientes interativos. Cada experimento
          explora um problema, um espaço de ações e uma dinâmica diferente.
        </p>
      </div>
      <dl class="grid grid-cols-3 divide-x divide-border border border-border bg-card">
        <div class="min-w-24 px-4 py-3">
          <dt class="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Jogos</dt>
          <dd class="mt-1 text-2xl font-semibold text-foreground">06</dd>
        </div>
        <div class="min-w-24 px-4 py-3">
          <dt class="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Algoritmos</dt>
          <dd class="mt-1 text-2xl font-semibold text-foreground">02</dd>
        </div>
        <div class="min-w-24 px-4 py-3">
          <dt class="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Motores</dt>
          <dd class="mt-1 text-2xl font-semibold text-foreground">02</dd>
        </div>
      </dl>
    </section>

    <section class="pt-10">
      <div class="mb-5 flex items-end justify-between gap-4">
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Ambientes disponíveis
          </p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">Experimentos</h2>
        </div>
        <span class="font-mono text-[10px] text-muted-foreground/60">
          {{ String(experiments.length).padStart(2, '0') }} projetos
        </span>
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <experiment-card v-for="experiment in experiments" :key="experiment.href" v-bind="experiment" />
      </div>
    </section>
  </main>
</template>
