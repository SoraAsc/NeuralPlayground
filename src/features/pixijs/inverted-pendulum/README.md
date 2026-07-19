# Inverted Pendulum

Inverted Pendulum is a browser implementation of the classic cart-pole control problem. A continuous PPO policy applies horizontal force to a cart and learns to keep an attached pole upright without leaving the track.

## Learning problem

The environment follows the state order, physical constants, termination thresholds, and explicit Euler integration used by CartPole-style benchmarks. State variables are initialized with small random values at the beginning of every episode.

The actor and critic each contain two hidden layers with 64 `tanh` units. Training uses AdamW, 128-step rollouts, generalized advantage estimation, clipped PPO updates, four epochs per rollout, value loss, entropy regularization, and gradient clipping.

### Observation space

The policy receives four continuous values in raw simulation units:

1. Cart position.
2. Cart velocity.
3. Pole angle.
4. Pole angular velocity.

### Action space

The actor produces one continuous action. It is scaled to a horizontal force with a maximum magnitude of 10.

### Physics and termination

The simulation advances in 20 ms steps and models gravity, cart mass, pole mass, pole length, angular acceleration, and cart acceleration. An episode terminates when:

- The cart moves beyond `±2.4` position units.
- The pole angle exceeds `±12°`.

The environment records episode reward, balance duration, best stability time, and rolling histories for visualization.

## Directory structure

- `ai/pendulum-env.ts` implements dynamics, observations, PPO training, episode lifecycle, metrics, and checkpoint management.
- `ui/PendulumPanel.vue` presents simulation controls, training state, stability history, current force, and checkpoint actions.

## Checkpoint

The published actor/critic checkpoint is loaded from `public/models/inverted-pendulum.nnw`. Users can pause training, run evaluation, import or export checkpoints, and reset the policy.
