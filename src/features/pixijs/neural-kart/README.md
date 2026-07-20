# Neural Kart

Neural Kart is a continuous-control racing environment in which multiple karts train a shared Proximal Policy Optimization policy while driving on procedurally generated tracks. The simulation is rendered with PixiJS and modeled as a collection of Koota ECS entities and systems.

## Learning problem

Each kart is an independent environment, but every environment contributes experience to the same actor and critic. This vectorized setup lets the policy observe different parts of a track simultaneously and update from batched rollouts.

The actor and critic use three hidden layers with 128 `tanh` units. PPO uses AdamW, generalized advantage estimation, clipped policy updates, gradient clipping, and a configurable learning rate, discount factor, and entropy coefficient.

### Observation space

The policy receives 20 normalized features:

1. World-space X and Y velocity.
2. Maximum speed, acceleration, deceleration, friction, and steering speed.
3. Alignment with the track tangent and lateral displacement from its center.
4. Sine and cosine of the angle to the next checkpoint, plus normalized checkpoint distance.
5. Five forward road-distance rays covering a 180-degree arc.
6. Three rear rays covering a 90-degree arc.

Road sensors use ray marching against the generated track mask and report distances up to 200 pixels.

### Action space

The continuous policy produces two values:

- Throttle/braking input.
- Steering input.

### Rewards and termination

Dense rewards encourage progress toward the next checkpoint, forward alignment, useful speed, and a centered racing line. Per-step, lateral-offset, and low-speed costs discourage stalling or exploiting episode duration. Crossing checkpoints and completing laps provide larger bonuses.

Leaving the road applies a penalty. Episodes also end when the kart remains stationary or fails to reach the next checkpoint within the configured timeout, after which it returns to its assigned spawn point.

## Track generation

Tracks are generated from control nodes and converted into a center line, boundaries, collision mask, checkpoints, starting line, and a two-by-two spawn grid. Available generators include circuit, oval, snake, and irregular layouts.

## Directory structure

- `ai/neural-env.ts` manages the shared NNW actor, critic, PPO agent, rollout buffer, checkpoints, and training settings.
- `ai/system.ts` builds observations, shapes rewards, batches environments, and applies policy actions.
- `kart/` defines ECS traits, kart variants, movement, rendering, and entity creation.
- `track/generators/` contains procedural layout generators.
- `track/` implements masks, collision, checkpoints, sensors, spawns, and rendering.
- `ui/KartPanel.vue` exposes controls, policy diagnostics, sensor readings, and training metrics.

## Checkpoint

The published actor/critic checkpoint is loaded from `public/models/neural-kart.nnw`. The UI also supports importing, exporting, and resetting learned parameters.
