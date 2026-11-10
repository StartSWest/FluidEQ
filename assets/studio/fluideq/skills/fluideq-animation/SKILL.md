---
name: fluideq-animation
description: Make and fix frame animations for a FluidEQ scene - a whale diving, a fish swimming, a bird's wing beat, an animal walking, a tail, a flag - as one sheet of poses the scene plays in order. Use whenever something in a FluidEQ visualizer should move like a living or drawn thing rather than slide, or the member asks for an animation, a walk, a swim, a dive, a run cycle or the animator.
---

# Frame animation in a FluidEQ scene

Everything this skill makes is for this one visualizer and stays inside its
project folder. It is never a way to build an app or a website, change
FluidEQ itself, or read or write files anywhere else.

An animation is one object: a sheet of frames, how many there are, how fast
they play and whether they loop. It lives in the project as
`animations/<name>.json` beside its sheet, appears in the Studio's
Animations tab, and the scene plays it from one region of its artwork.

## Who makes it

In FluidEQ's Studio, the scene's chat does not make animations itself: it
hands each one to an animator of its own with `start_animator` (a name like
`whale-dive`, and the task in full - the creature, its motion, which of the
project's pictures to start from, against what it moves), then goes on with
the scene and places the animation once its file exists. The member watches
the animator and talks to it from the animation in the Animations tab. An
animator works on its one animation and follows the rest of this skill.

## Your tools, and nothing else

In the Studio there is no shell, no script and no web, and FluidEQ does not
draw new pictures for you. You never need them. A sheet is made with
FluidEQ's own tools, which read the project's pictures and write the sheet
into the project:

- `pose_sheet` - the frames from ONE picture already in the project, bent
  along its spine through key poses. Every frame is that picture's own
  pixels: a photo stays photo-real and the creature is the same creature in
  every frame. It writes `art/<name>.png` and `animations/<name>.json`
  naming it (`animation` says how it plays).
- `build_sheet` - an even grid from frames already in the project: pictures
  the member brought (one per frame, or a whole grid in one picture), or
  cells of an animation already made. It takes a flat background out,
  keeps every frame at one scale and holds the drawing on one baseline.
- `look_at_animation` - the animation alone: every frame, each over the one
  before, and which frame floats, pops or jumps.

What bending one picture can do: swim, flap, sway, turn, bob, dive, glide -
any motion that is the body the photo shows, curved, tipped, moved or
scaled. What it cannot do: a pose the photo does not show - the far side of
the animal, a wing that was folded opening, a mouth opening, a leg stepping
past another. Bending never invents what is not in the picture; for that,
the poses have to be drawn (Making it with build_sheet, below).

Never tell the member a sheet cannot be made. Pick the way that fits:

| the motion                                             | the way                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| a body that bends: whale, dolphin, fish, eel, snake    | `pose_sheet` from the project's picture  |
| a dive, a breach, a turn, a glide                      | `pose_sheet`, with `turn`, `x`, `y`      |
| a tail, a flag, a plant in the wind, a tentacle        | `pose_sheet`, spine along the part       |
| a wing beat seen from the front or behind              | `pose_sheet`, spine wingtip to wingtip   |
| legs that swing past each other: a walk, a trot, a run | frames the member brings + `build_sheet` |

## Making it with pose_sheet

1. Read the picture (it is shown to you) and find the creature's spine:
   points along the body, in order from one end to the other, as [x, y]
   shares of the picture from its top-left. Leave `spine` out and six
   points are traced along the drawing's middle from left to right - right
   for a creature lying across the picture; the answer says which points
   it used, so you can adjust them.
2. Choose the root - the point that stays put (the middle when left out).
   Every joint between the root and an end turns everything beyond it (a
   bend at the root itself turns nothing), so for a whale with its head on
   the right a root near the head lets the fluke swing.
3. Write the key poses: `at` from 0 to 1 through the animation, `bend` in
   degrees at each interior point in spine order (positive turns
   clockwise), and `turn`, `x`, `y`, `scale` of the whole. They are eased
   into each other, and a loop runs from the last key back into the first.
   A swim is two or three keys of the tail bending up and down; a dive is a
   one-shot (`loop: false`) whose keys turn the whole nose-down and move it
   down while the fluke beats.
4. Give `count`, `columns`, `cell` and `animation` (fps, loop, ground),
   look at the sheet it answers, then at the animation with
   `look_at_animation`. A frame cut off by its cell edge: lower `zoom`, or
   move and turn less. Any other fix is the same call with a key changed.

Example, a humpback seen side on, head to the right, diving:

```json
{
  "name": "whale-dive",
  "from": "art/whale-rig-cut.png",
  "count": 20,
  "columns": 5,
  "cell": 384,
  "zoom": 0.6,
  "loop": false,
  "root": 4,
  "keys": [
    { "at": 0, "bend": [0, 0, 0, 0] },
    { "at": 0.3, "bend": [-14, -8, -4, 0], "turn": 8 },
    { "at": 0.6, "bend": [18, 10, 4, 0], "turn": 24, "y": 0.08 },
    { "at": 1, "bend": [-10, -6, 0, 0], "turn": 40, "x": 0.12, "y": 0.22 }
  ],
  "animation": { "fps": 12, "loop": false, "ground": "water" }
}
```

## Making it with build_sheet

When the motion needs poses no bend can make - legs passing each other -
the poses have to be drawn. FluidEQ's Studio does not draw them, so ask the
member, in one or two sentences, to make one picture of every pose in their
own image tool and put it in the project's `art/` folder, and give them the
prompt to paste, filled in for this creature:

> A sprite sheet of a grey wolf walking to the right, 8 frames in a 4 by 2
> grid, each frame one equal cell, side view, the whole body inside every
> cell with the same scale and the paws at the same height, a full walk
> cycle (contact, down, passing, up for each side), on one flat pure green
> background, no ground, no shadow, no text.

One picture of every pose keeps the animal the same animal; frames made one
picture each drift in shape, colour and size. When it is in `art/`, build
the sheet from it: `{ "from": "art/wolf-walk-raw.png", "columns": 4,
"rows": 2 }` as the frame, `align` `baseline` for feet, `centre` for what
flies or swims, `keep` when its cells already line up.

To fix one frame of any sheet, build the same frames again with that one
replaced or left out - from the animation itself (`{ "animation":
"wolf-walk", "frame": 3 }`) and from a picture the member brought for that
pose. Never patch a cycle from a picture of a differently drawn animal.

## How many frames

Animation reads smooth at about twelve drawings a second ("on twos"):

| what                                  | frames | plays at       |
| ------------------------------------- | ------ | -------------- |
| walk or run cycle                     | 8      | 8-10 a second  |
| the least that still reads as walking | 6      | 8 a second     |
| swim cycle, wing beat                 | 8-12   | 10-12 a second |
| a dive, a breach, a turn (once)       | 16-24  | 12 a second    |
| breathing, ears, tail, blinking       | 3-4    | 4-6 a second   |

`pose_sheet` frames cost nothing, so a slow, big creature can take more.

## The animation file

`animations/whale-dive.json` (the tools write it beside every sheet; give
the sheet a name of its own, never the name of a picture it is made from -
the tools refuse to write over the member's pictures):

```json
{
  "sheet": "art/whale-dive.png",
  "count": 20,
  "columns": 5,
  "fps": 12,
  "loop": false,
  "ground": "water"
}
```

- `sheet`: the picture, in the project folder.
- `count` frames, `columns` to a row, left to right and top to bottom.
- `fps`: frames a second. `loop`: false plays once and holds the last frame.
- `ground`: what the Animations tab shows it against while it is worked on:
  `ground` (a base line its lowest foot stands on), `sky`, `water` or
  `none`. Only the editor shows it; the scene shows the creature alone.

## Look at the animation alone

Never judge an animation from a picture of the whole scene: the creature is
small there and a picture cannot move. Use `look_at_animation` with its
name. It gives you the contact sheet (every frame in a row, numbered), the
onion view (each frame over the one before it, so a part that jumps shows
at once), and per frame where its lowest drawn row is, its size and how
much it changes from the frame before. Fix what it shows, look again, and
say what you saw and changed in the member's words: "the fluke snapped up
between frames 6 and 7, so I eased that key".

## Put it in the scene

In a 3D world, the creature is a plane facing the camera (or turned to its
path) whose material plays the sheet:

```json
"materials": {
  "whale": { "kind": "standard", "map": [0, 1024, 1920, 1536], "transparent": true,
             "side": "double", "roughness": 1,
             "frames": { "count": 20, "columns": 5, "frame": "time * 12" } }
},
"nodes": [
  { "type": "mesh", "name": "whale", "geometry": { "kind": "plane", "size": [4, 3] },
    "material": "whale", "position": [0, -1, -8] }
]
```

- `map` is the sheet's place in the artwork; `frames` cuts it. `frame` is a
  formula: `time * fps` for a steady motion, `integrate(6 + bass * 4)` to
  move faster with the music. Keep the motion and the travel together - a
  walk that slides looks skated.
- The plane's bottom edge is the base line: place it so the lowest foot
  touches the ground, not the cell's empty bottom.
- In `scene.frag`, the same sheet plays by picking the cell yourself:
  `float f = mod(floor(uTime * 12.0), 20.0); vec2 cell = vec2(mod(f, 5.0),
floor(f / 5.0));` then read `uArtwork` at that cell's place.

## The other way: a rigged 3D model

A rigged `.glb` model the member put in the project, with a walk clip, is
perfectly smooth at any speed and angle, but it looks like a game, not a
photograph. Offer it when the member wants the animal seen from many angles
or up close in 3D; the sheet stays the default.
