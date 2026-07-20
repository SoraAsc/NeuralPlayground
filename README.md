# Neural Playground

An interactive reinforcement learning laboratory where neural agents learn, train, and compete in real-time environments.

[Open the live playground](https://soraasc.github.io/NeuralPlayground/)

## About

Neural Playground brings together a collection of visual reinforcement learning experiments in the browser. Each environment explores a different control problem, action space, and training setup while exposing live metrics and simulation controls.

The playground uses [NNW](https://github.com/SoraAsc/NNW) for neural-network and reinforcement-learning workloads. The Unity-based snake experiment is developed separately in [NeuralSnake](https://github.com/SoraAsc/NeuralSnake) and embedded here as a WebGL build.

## Experiments

| Experiment         | Algorithm       | Action space   | Engine      |
| ------------------ | --------------- | -------------- | ----------- |
| Neural Snake       | Q-Learning      | Discrete       | Unity WebGL |
| Neural Kart        | PPO             | Continuous     | PixiJS      |
| Inverted Pendulum  | PPO             | Continuous     | PixiJS      |
| Neural Flappy      | PPO             | Discrete       | PixiJS      |
| Neural Pong        | Q-Learning      | Discrete       | PixiJS      |
| Asteroids          | PPO             | Multi-discrete | PixiJS      |
| Neural Network Lab | Backpropagation | Supervised     | Browser SVG |
| Color Predictor    | Backpropagation | 11 RGB classes | Browser UI  |
| Shape Classifier   | Backpropagation | 16×16 drawing  | Canvas      |

## Tech stack

- Vue 3 and TypeScript
- Vite
- PixiJS
- Unity WebGL
- NNW and WebAssembly
- Pinia
- Tailwind CSS
- Koota ECS

## Local development

Requirements:

- Node.js 24
- pnpm 10

Install the dependencies:

```sh
pnpm install
```

Start the development server:

```sh
pnpm dev
```

Create a production build:

```sh
pnpm build
```

## Quality checks

Run the TypeScript checks:

```sh
pnpm type-check
```

Run the linters:

```sh
pnpm lint
```

## Deployment

Pushes to `main` are built and deployed automatically to GitHub Pages through GitHub Actions. The Vite base path is derived from the repository name during the workflow, so assets are generated under the correct Pages URL.

The Unity build uses Brotli compression with Decompression Fallback enabled. Its `.unityweb` assets include a browser-side fallback for static hosts such as GitHub Pages, where custom `Content-Encoding` headers cannot be configured.

## Related projects

- [NNW](https://github.com/SoraAsc/NNW) — neural-network and reinforcement-learning library used by the browser experiments.
- [NeuralSnake](https://github.com/SoraAsc/NeuralSnake) — Unity reinforcement-learning environment embedded in Neural Playground.
