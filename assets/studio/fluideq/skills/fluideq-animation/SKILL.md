---
name: fluideq-animation
description: Make and fix frame animations for a FluidEQ scene - an animal walking or running, a bird's wing beat, a fish swimming, a tail, a flag - as one sheet of poses the scene plays in order. Use whenever something in a FluidEQ visualizer should move like a living or drawn thing rather than slide, or the member asks for an animation, a walk, a run cycle or the animator.
---

# Frame animation in a FluidEQ scene

An animation is one object: a sheet of frames, how many there are, how fast
they play and whether they loop. It lives in the project as
`animations/<name>.json` beside its sheet, appears in the Studio's
Animations tab, and the scene plays it from one region of its artwork. This
skill is how to make one that reads as alive without spending pictures it
does not need.

## Who makes it

In FluidEQ's Studio, the scene's chat does not draw animations itself: it
hands each one to an animator of its own with `start_animator` (a name like
`wolf-walk`, and the task in full - the creature, its gait, which of the
project's pictures to start from, against what it moves), then goes on with
the scene and places the animation once its file exists. The member watches
the animator and talks to it from the animation in the Animations tab. An
animator works on its one animation and follows the rest of this skill.
Elsewhere, whoever is asked makes it the same way.

## How many frames

Animation reads smooth at about twelve drawings a second ("on twos"). You
rarely need that many different ones:

| what                                  | frames | plays at      |
| ------------------------------------- | ------ | ------------- |
| walk or run cycle                     | 8      | 8-10 a second |
| the least that still reads as walking | 6      | 8 a second    |
| breathing, ears, tail, blinking       | 3-4    | 4-6 a second  |
| close-up hero, slow motion            | 12     | 12 a second   |

Four frames of a walk read as stepping, not walking. Default to eight, and
go to twelve only when the creature is big on screen and moves slowly.

## One picture for every frame

Have every pose drawn in ONE picture: a sheet of poses in a grid, the same
animal, the same size, the same light, each pose in its own equal cell, on
a transparent (or one flat, plain) background. Then the animation file says
how the sheet is cut. That is one generation instead of eight, and the
animal stays the same animal in every frame: frames made one picture each
drift in shape, colour and size, and the drift is what makes a cycle look
wrong even when every pose is right.

Ask for the sheet like this, filling in the animal and the gait:

> A sprite sheet of a grey wolf walking to the right, 8 frames in a 4 by 2
> grid, each frame one equal cell, side view, the whole body inside every
> cell with the same scale and the paws at the same height, a full walk
> cycle (contact, down, passing, up for each side), transparent background,
> no ground, no shadow, no text.

- The legs carry the animation; the body stays the same size and height in
  every cell. The scene moves the animal across the ground and bobs it with
  each step, so the frames only carry the legs.
- A side view walks best. Facing right; the scene mirrors it for the other
  way (a negative x scale).
- If one cell comes out wrong, make that cell again from its neighbours, or
  make the sheet again - never patch the cycle from a separate picture of a
  differently drawn animal.
- Use the pictures and parts the project already has (`art/`, the
  Pictures tab) when they are the animal the member means: build from them,
  do not draw a new one unasked.

## The animation file

`animations/wolf-walk.json`:

```json
{
  "sheet": "art/wolf-walk.png",
  "count": 8,
  "columns": 4,
  "fps": 9,
  "loop": true,
  "ground": "ground"
}
```

- `sheet`: the picture, in the project folder.
- `count` frames, `columns` to a row, left to right and top to bottom.
- `fps`: frames a second. `loop`: false plays once and holds the last frame.
- `ground`: where it belongs, which the Animations tab shows it against
  while it is worked on: `ground` (a base line its lowest foot stands on,
  flat, uphill or downhill), `sky`, `water` or `none`. Only the editor shows
  it; the scene and the thumbnails show the animal alone.

## Look at the animation alone

Never judge an animation from a picture of the whole scene: the animal is
small there and a picture cannot move. In FluidEQ's Studio chat, use
`look_at_animation` with its name (elsewhere, lay the frames side by side
and over each other yourself and measure the same things). It gives you,
from the frames you already have, without making a picture:

- the contact sheet - every frame in a row, the same scale, numbered;
- the onion view - each frame over the one before it, so a leg that jumps,
  a body that shrinks or a head that drifts shows at once;
- the numbers - for each frame, where its lowest opaque pixel is (the feet
  must stay on one line: a walk whose lowest row moves more than a few
  pixels bounces or floats), its width and height (a body that changes size
  between frames was drawn inconsistently) and how much it differs from
  the frame before (one frame far above the rest is a jump).

Fix what it shows, then look again. Say what you saw and what you changed,
in the member's words: "frame 5's back leg lifted before it pushed off".

## Put it in the scene

In a 3D world, the animal is a plane facing the camera (or turned to its
path) whose material plays the sheet:

```json
"materials": {
  "wolf": { "kind": "standard", "map": [0, 1024, 2048, 1024], "transparent": true,
            "side": "double", "roughness": 1,
            "frames": { "count": 8, "columns": 4, "frame": "time * 9" } }
},
"nodes": [
  { "type": "mesh", "name": "wolf", "geometry": { "kind": "plane", "size": [2.4, 1.2] },
    "material": "wolf", "position": ["mod(time * 1.4, 30) - 15", 0.6, -6],
    "castShadow": true }
]
```

- `map` is the sheet's place in the artwork; `frames` cuts it. `frame` is a
  formula: `time * fps` for a steady gait, `integrate(6 + bass * 4)` to walk
  faster with the music. Keep the step and the travel together - a walk
  that slides (feet moving slower than the ground passes) looks skated.
- The plane's bottom edge is the base line: place it so the lowest foot
  touches the ground, not the cell's empty bottom.
- In `scene.frag`, the same sheet plays by picking the cell yourself:
  `float f = mod(floor(uTime * 9.0), 8.0); vec2 cell = vec2(mod(f, 4.0),
floor(f / 4.0));` then read `uArtwork` at that cell's place.

## The other way: a rigged 3D model

A rigged `.glb` model with a walk clip costs no pictures and is perfectly
smooth at any speed and angle, but it looks like a game, not a drawing or a
photograph. Offer it as the alternative when the member wants the animal
seen from many angles or up close in 3D; the sheet stays the default.
