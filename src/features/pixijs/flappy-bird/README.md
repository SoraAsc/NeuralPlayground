# Neural Flappy

Neural Flappy is a discrete-action obstacle-navigation environment inspired by Flappy Bird. Twelve simulations run in parallel and contribute experience to one shared PPO policy while PixiJS overlays them in the same scene.

## Learning problem

Each environment has independently randomized pipe positions and spacing. Environments reset separately after collisions, so a rollout continues collecting useful experience even when individual birds fail.

The actor and critic each use two hidden layers with 128 `tanh` units. PPO trains every 128 vectorized steps with AdamW, generalized advantage estimation, clipped updates, four epochs, entropy regularization, and gradient clipping.

### Observation space

The six normalized inputs are:

1. Bird height.
2. Vertical velocity.
3. Horizontal distance to the next pipe.
4. Height of the next gap.
5. Vertical offset between the bird and the gap center.
6. Vertical pipe velocity when moving pipes are enabled.

### Action space

- `0`: Continue without flapping.
- `1`: Apply an upward flap velocity.

Gravity accelerates the bird downward between actions.

### Rewards and termination

The agent receives a small survival reward every step and a larger reward after passing a pipe. Hitting a pipe or leaving the top or bottom of the world applies a penalty and ends that environment's episode.

The optional moving-pipe mode adds vertically oscillating gaps with configurable speed, allowing the same observation vector to support a harder evaluation scenario.

## Directory structure

- `ai/flappy-env.ts` contains the parallel simulations, physics, observation encoding, reward function, PPO agent, rollout training, diagnostics, and checkpoint handling.
- `ui/FlappyPanel.vue` exposes training controls, pipe-motion settings, scores, policy inputs, and reward history.

## Checkpoint

The published actor/critic checkpoint is loaded from `public/models/flappy-bird.nnw`. The environment supports importing, exporting, evaluating, and resetting the model.
