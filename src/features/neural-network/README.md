# Neural Network Labs

This feature contains three supervised-learning experiments powered by [NNW](https://github.com/SoraAsc/NNW) and WebAssembly. Training runs in the browser, with live loss, accuracy, and predictions.

## Logic Gate Lab

The logic-gate lab compares two binary-classification problems:

- **AND** is linearly separable and produces a positive output only for `1 AND 1`.
- **XOR** alternates its classes and requires a nonlinear decision boundary.

Both datasets contain the four possible pairs of binary inputs. The controls allow up to three hidden layers, configurable layer widths and activations, learning rate, and epochs per frame.

The model has two inputs and one sigmoid output. Evaluating it over a regular grid produces the probability map shown during training.

## Color Predictor

The color predictor classifies normalized RGB values into 11 families: black, gray, white, red, orange, yellow, green, cyan, blue, purple, and pink.

Its training set combines deterministic samples from the RGB cube with extra grayscale and near-grayscale colors. Value, saturation, and hue determine the labels. Relative luminance is used separately to choose light or dark text in the preview.

The network architecture is:

1. Three RGB inputs.
2. A hidden layer with 16 `tanh` units.
3. A hidden layer with 12 `tanh` units.
4. Eleven sigmoid outputs, one for each color family.

Colors can be selected with the picker or generated at random. The page shows the predicted family, score, expected family, and a fixed validation palette.

## Shape Classifier

The shape classifier recognizes circles, squares, and triangles drawn on a `16 × 16` canvas. Its synthetic dataset has 160 variants of each shape, with changes in position, scale, stroke thickness, and rotation.

Each image is flattened into 256 input values. Two ReLU layers with 32 and 16 units feed three sigmoid outputs. Predictions update as the user draws.

## Training

All three labs use AdamW with shuffled mini-batches. Training is split across animation frames so the UI and predictions can update between batches. Models and trainers are disposed on reset and when their views unmount.

## Directory structure

- `model/logic-gate-lab.ts` defines the AND/XOR datasets, configurable dense model, training loop, predictions, and decision-grid evaluation.
- `model/color-predictor.ts` generates the RGB dataset, assigns color-family labels, calculates luminance, and manages the color model.
- `model/shape-classifier.ts` generates rasterized shape variants and manages the shape model.
- `ui/DecisionBoundary.vue` renders the logic gate's probability surface and labeled samples.
- `ui/NeuralNetworkPanel.vue` exposes the logic model architecture and training parameters.
- `../../views/NeuralNetworkLab.vue` hosts the interactive AND/XOR experiment.
- `../../views/ColorPredictor.vue` hosts the color-classification experiment.
- `../../views/ShapeClassifier.vue` hosts the drawing-classification experiment.
