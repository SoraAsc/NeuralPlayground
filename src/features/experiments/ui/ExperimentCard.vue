<script setup lang="ts">
import { ArrowUpRight, Code2 } from '@lucide/vue'
import { cn } from '@/shared/lib/utils'

withDefaults(
  defineProps<{
    href: string
    algorithm: string
    actionSpace: string
    engine: string
    title: string
    description: string
    repositoryUrl: string
    preview: 'network' | 'snake' | 'kart' | 'pendulum' | 'flappy' | 'pong' | 'asteroids'
    isEnabled?: boolean
  }>(),
  { isEnabled: true },
)
</script>

<template>
  <article
    :class="
      cn(
        'group relative flex min-h-80 flex-col overflow-hidden border border-border bg-card',
        'transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-xl',
        !isEnabled && 'pointer-events-none opacity-60',
      )
    "
  >
    <router-link
      :to="href"
      :aria-label="`Open ${title} experiment`"
      class="absolute inset-0 z-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
    />
    <div
      class="pointer-events-none relative z-1 h-36 overflow-hidden border-b border-border bg-background text-foreground"
      aria-hidden="true"
    >
      <div
        class="absolute inset-0 opacity-[0.055]"
        style="
          background-image:
            linear-gradient(currentColor 1px, transparent 1px),
            linear-gradient(90deg, currentColor 1px, transparent 1px);
          background-size: 24px 24px;
        "
      />
      <svg viewBox="0 0 320 144" class="relative h-full w-full" fill="none">
        <g v-if="preview === 'network'" stroke="currentColor">
          <g opacity=".35">
            <path
              d="M45 37 137 52M45 37l92 41M45 107l92-55M45 107l92-29M137 52l92 20M137 78l92-6"
            />
            <path d="M137 52l92 44M137 78l92 18" opacity=".45" />
          </g>
          <circle cx="45" cy="37" r="9" fill="var(--background)" stroke-width="2" />
          <circle cx="45" cy="107" r="9" fill="var(--background)" stroke-width="2" />
          <circle cx="137" cy="52" r="11" fill="currentColor" fill-opacity=".13" stroke-width="2" />
          <circle cx="137" cy="78" r="11" fill="currentColor" fill-opacity=".13" stroke-width="2" />
          <circle cx="229" cy="72" r="13" fill="currentColor" fill-opacity=".22" stroke-width="2" />
          <circle cx="229" cy="96" r="7" fill="currentColor" fill-opacity=".08" stroke-width="1" />
        </g>
        <g v-else-if="preview === 'snake'" stroke="currentColor" stroke-linecap="square">
          <path d="M68 92h62V66h54V43h48" stroke-width="12" opacity=".18" />
          <path d="M68 92h62V66h54V43h48" stroke-width="3" />
          <rect x="228" y="39" width="9" height="9" fill="currentColor" stroke="none" />
          <rect
            x="237"
            y="91"
            width="10"
            height="10"
            fill="currentColor"
            stroke="none"
            opacity=".55"
          />
        </g>
        <g v-else-if="preview === 'kart'" stroke="currentColor">
          <path d="M38 116C73 43 124 27 164 65s86 39 119-37" stroke-width="32" opacity=".1" />
          <path d="M38 116C73 43 124 27 164 65s86 39 119-37" stroke-width="2" opacity=".5" />
          <path
            d="M38 116C73 43 124 27 164 65s86 39 119-37"
            stroke-width="1"
            stroke-dasharray="6 8"
            opacity=".28"
          />
          <g transform="translate(197 81) rotate(-64)">
            <rect
              x="-11"
              y="-15"
              width="6"
              height="7"
              rx="1"
              fill="currentColor"
              stroke="none"
              opacity=".7"
            />
            <rect
              x="5"
              y="-15"
              width="6"
              height="7"
              rx="1"
              fill="currentColor"
              stroke="none"
              opacity=".7"
            />
            <rect
              x="-11"
              y="8"
              width="6"
              height="7"
              rx="1"
              fill="currentColor"
              stroke="none"
              opacity=".7"
            />
            <rect
              x="5"
              y="8"
              width="6"
              height="7"
              rx="1"
              fill="currentColor"
              stroke="none"
              opacity=".7"
            />
            <path
              d="M0-13 8-5 7 10 0 14-7 10-8-5Z"
              fill="currentColor"
              fill-opacity=".16"
              stroke-width="2"
            />
            <circle cx="0" cy="-3" r="4" fill="currentColor" fill-opacity=".35" />
            <path d="M-8 5H8" opacity=".45" />
          </g>
        </g>
        <g v-else-if="preview === 'pendulum'" stroke="currentColor">
          <path d="M66 113h188" opacity=".18" stroke-width="4" />
          <rect x="126" y="91" width="68" height="23" fill="currentColor" opacity=".14" />
          <rect x="126" y="91" width="68" height="23" stroke-width="2" />
          <circle cx="143" cy="119" r="7" fill="var(--background)" stroke-width="2" />
          <circle cx="177" cy="119" r="7" fill="var(--background)" stroke-width="2" />
          <path d="M160 91 196 32" stroke-width="5" />
          <rect x="188" y="23" width="17" height="17" fill="currentColor" stroke="none" />
          <path d="M160 91V18" stroke-dasharray="3 5" opacity=".16" />
        </g>
        <g v-else-if="preview === 'flappy'" stroke="currentColor">
          <rect
            x="222"
            y="0"
            width="36"
            height="43"
            fill="currentColor"
            fill-opacity=".1"
            stroke-width="2"
          />
          <rect
            x="216"
            y="38"
            width="48"
            height="11"
            fill="currentColor"
            fill-opacity=".2"
            stroke-width="2"
          />
          <rect
            x="222"
            y="96"
            width="36"
            height="48"
            fill="currentColor"
            fill-opacity=".1"
            stroke-width="2"
          />
          <rect
            x="216"
            y="90"
            width="48"
            height="11"
            fill="currentColor"
            fill-opacity=".2"
            stroke-width="2"
          />
          <g transform="translate(107 70)">
            <circle cx="0" cy="0" r="15" fill="currentColor" fill-opacity=".18" stroke-width="2" />
            <path d="m12-7 18 7-18 7Z" fill="currentColor" fill-opacity=".38" />
            <circle cx="0" cy="0" r="20" opacity=".18" />
          </g>
          <path
            d="M48 93c20-4 31-11 42-19"
            stroke-dasharray="2 7"
            stroke-linecap="round"
            opacity=".3"
          />
        </g>
        <g v-else-if="preview === 'pong'" stroke="currentColor">
          <path d="M160 17v110" stroke-dasharray="7 7" opacity=".2" />
          <rect x="55" y="45" width="8" height="48" fill="currentColor" stroke="none" />
          <rect x="257" y="62" width="8" height="48" stroke-width="2" />
          <circle cx="190" cy="76" r="7" fill="currentColor" stroke="none" />
          <path d="m183 78-63 18" stroke-dasharray="3 6" opacity=".2" />
          <rect x="26" y="15" width="268" height="114" opacity=".12" />
        </g>
        <g v-else stroke="currentColor" stroke-width="2">
          <g transform="translate(144 78) rotate(90)">
            <path
              d="M0-25 8-5 19 16 5 10 0 17-5 10-19 16-8-5Z"
              fill="currentColor"
              fill-opacity=".1"
            />
            <path d="M0-25 8-5 19 16 5 10 0 17-5 10-19 16-8-5Z" />
            <path d="M0-14V9" opacity=".5" />
            <circle cy="-6" r="3.5" fill="currentColor" fill-opacity=".25" />
            <path d="M-4 15 0 25 4 15" opacity=".6" />
          </g>
          <path d="M169 78h24" stroke-dasharray="2 6" stroke-linecap="round" opacity=".25" />
          <circle cx="204" cy="78" r="3" fill="currentColor" stroke="none" />
          <circle cx="219" cy="78" r="2" fill="currentColor" stroke="none" opacity=".5" />
          <path
            d="m69 26 14-8 17 4 10 14-5 17-16 9-18-6-8-14Z"
            fill="currentColor"
            fill-opacity=".06"
            opacity=".7"
          />
          <path
            d="m238 81 13-7 15 5 8 13-4 16-14 9-16-5-8-14Z"
            fill="currentColor"
            fill-opacity=".05"
            opacity=".55"
          />
          <path d="m82 29 9 7-5 12M247 83l8 10 10-4" opacity=".25" />
        </g>
      </svg>
      <span
        class="absolute right-3 top-3 border border-border bg-background/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground backdrop-blur-sm"
      >
        {{ engine }}
      </span>
    </div>

    <div class="pointer-events-none relative z-1 flex flex-1 flex-col p-5">
      <div class="mb-4 flex flex-wrap gap-1.5">
        <span
          class="border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
        >
          {{ algorithm }}
        </span>
        <span
          class="border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
        >
          {{ actionSpace }}
        </span>
      </div>
      <div class="flex items-start justify-between gap-4">
        <h2 class="text-lg font-semibold tracking-tight text-foreground">{{ title }}</h2>
        <arrow-up-right
          class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      </div>
      <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
        {{ description }}
      </p>
      <div
        class="mt-auto flex items-center justify-between gap-3 pt-5 font-mono text-[9px] uppercase"
      >
        <div
          class="flex h-8 items-center gap-1 leading-none tracking-widest text-muted-foreground/60"
        >
          <span class="block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
          <span>Disponível</span>
        </div>
        <a
          :href="repositoryUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`View ${title} source code on GitHub`"
          class="pointer-events-auto flex h-8 items-center gap-2 border border-border bg-background/70 px-2.5 tracking-wider text-foreground shadow-sm transition-all hover:border-foreground/40 hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <code2 class="h-3.5 w-3.5" />
          <span class="text-[10px]">Ver código</span>
        </a>
      </div>
    </div>
  </article>
</template>
