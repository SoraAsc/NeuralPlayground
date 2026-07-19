# Asteroids

Asteroids is a multi-discrete reinforcement-learning environment in which twelve parallel ships learn to navigate a toroidal arena, avoid predicted collisions, aim at threats, and clear increasingly difficult asteroid waves.

## Learning problem

All environments share one PPO actor and critic. Each simulation has independent ships, bullets, asteroid fields, scores, and episode timing. The visualizer ranks environments by performance and changes their opacity so the strongest current trajectory remains easy to inspect.

The actor and critic use two hidden layers with 128 `tanh` units. Training runs on 128-step vectorized rollouts with AdamW, generalized advantage estimation, clipped policy updates, entropy regularization, and gradient clipping.

### Observation space

The state contains 27 normalized features:

- Ship X/Y velocity.
- Sine and cosine of ship heading.
- Angular error to the primary threat.
- Weapon cooldown.
- Seven features for each of the three highest-ranked threats: relative position, relative velocity, radius, time to closest approach, and predicted clearance.

Threat ranking uses toroidal relative motion and a closest-approach horizon, allowing the policy to reason about future collisions rather than only current distance.

### Action space

The policy selects three categorical axes simultaneously:

- Rotation: idle, turn left, or turn right.
- Propulsion: idle or thrust.
- Weapon: idle or fire.

### Rewards and termination

The reward combines survival, aim alignment, asteroid destruction, wave completion, and reductions in predicted danger. Destroying small fragments is worth more than hitting a large asteroid, while clearing a complete wave provides a larger bonus. Colliding with an asteroid applies a penalty and ends the episode.

Large asteroids split into smaller fragments. Movement, projectiles, and collision calculations wrap across arena boundaries.

## Directory structure

- `ai/asteroids-env.ts` implements parallel worlds, threat prediction, observations, physics, collision detection, reward shaping, PPO training, metrics, and checkpoint handling.
- `ui/AsteroidsPanel.vue` exposes training controls and displays wave, score, survival, threat, action, and policy diagnostics.

## Checkpoint

The published actor/critic checkpoint is loaded from `public/models/asteroids.nnw`. The UI supports import, export, evaluation mode, and training reset.
