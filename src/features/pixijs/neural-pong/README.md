# Neural Pong

Neural Pong is a symmetric self-play environment where both paddles are controlled by the same tabular Q-learning agent. Mirroring the right player's state into the left player's perspective lets one Q-table learn from both sides of every rally.

## Learning problem

The game runs in an `800 × 500` world. Paddle hits increase ball speed gradually and change its reflection angle according to the impact position, producing a wider range of trajectories as rallies become longer.

The Q-learning agent uses a learning rate of `0.18`, discount factor of `0.97`, and step-based epsilon decay from `1.0` to `0.025`.

### State representation

Continuous game state is discretized into 396 states:

- Six horizontal ball-position bins from the current paddle's perspective.
- Eleven bins for the ball's vertical offset from the paddle center.
- Three vertical-velocity bins: upward, neutral, or downward.
- Two bins indicating whether the ball is moving toward the paddle.

### Action space

- Stay in place.
- Move up.
- Move down.

### Rewards

Both players receive a small dense signal for reducing their vertical distance from the ball and a small per-step cost. Returning the ball earns a positive reward. Scoring earns a larger reward, while missing the ball applies the main penalty and ends the episode.

Because both paddles update the same table on every step, a single match produces two transitions from mirrored perspectives.

## Directory structure

- `pong-env.ts` implements physics, state discretization, self-play, reward shaping, Q-learning updates, diagnostics, metrics, and Q-table persistence.
- `PongPanel.vue` renders the environment and displays scores, rally history, epsilon, state bins, actions, and Q-values.

## Checkpoint

The published Q-table is loaded from `public/models/neural-pong.nqt`. It can be imported, exported, cleared, trained further, or used with learning disabled.
