---
name: fluideq-animation
description: Make and fix frame animations for a FluidEQ scene - a whale diving, a fish swimming, a bird's wing beat, an animal walking, a tail, a flag - as one sheet of poses the scene plays in order. Use whenever something in a FluidEQ visualizer should move like a living or drawn thing rather than slide, or the member asks for an animation, a walk, a swim, a dive or a run cycle.
---

# Frame animation in a FluidEQ scene

An animation is one object: a sheet of frames, how many there are, how fast
they play and whether they loop. It lives in the project as
`animations/<name>.json` beside its sheet, appears in the Studio's
Animations tab, and the scene plays it from one region of its artwork.

## Names

An animation is known by its NAME (`whale-dive`), and the name is where
everything goes: its sheet is always `art/<name>.png` and its file
`animations/<name>.json`. Never name a sheet by a file path; never save a
sheet "as" some other name to keep it apart - that makes a second
animation of it. To change an animation, write it again under its own name
with `replace: true` (the tools refuse an existing name without it, and
refuse a name whose picture another animation already plays). A new
animation gets a name nothing uses yet.

## Who draws, and what FluidEQ does

FluidEQ draws nothing. The Animations tab is a viewer that plays a sheet,
and FluidEQ's tools only write a playable sheet and check it. The pictures -
new poses, a cleaner background, more resolution, a fixed frame - come from
what the member has: their Claude Code plugins and skills, their tool
servers, and through those any external model they use (OpenAI, Gemini,
Replicate, a local Stable Diffusion server, and so on). Look first at what
tools you actually have in this chat - the PLUGINS section of your brief
lists the member's - and pick the best one for the job. Never say FluidEQ
or this chat draws by itself.

FluidEQ's own tools, all inside this project:

- `build_sheet` - the playable sheet from frames in the project: a grid a
  picture tool made (one picture of every pose, or several), single frames,
  or cells of the animation as it is. It takes a flat background out, keeps
  every frame at one scale and holds the drawing on one baseline.
- `look_at_animation` - the animation alone: every frame, each over the one
  before, and which frame floats, pops or jumps.
- `pose_sheet` - frames made from ONE picture by bending it along its spine
  through key poses: swim, flap, sway, turn, bob, dive, glide. It shows
  nothing the picture does not (the far side, a mouth opening, legs passing
  each other); those are poses a picture tool draws.

Every sheet the tools write is kept in the animation's history, with the
first one as its original: the member can undo, redo or go back to the
original from the Animations tab. So write the animation again under its
own name to change it; never make copies under other names to keep the old
one.

## Making it with the member's picture tools

1. Find the picture tool: a plugin skill or tool server that makes or edits
   images. Read its own instructions before using it.
2. Ask it for ONE picture holding every pose in a grid, so the creature
   stays one creature (frames made one picture each drift in shape, colour
   and size). Give it the guide: the animation's sheet as it is, or its
   original, or the member's picture of the creature. For more resolution,
   ask for 4 frames per picture and make several. Ask for one flat pure
   green background when the creature has to stand on transparency, and
   for the result to be saved in this project's `art/` folder.
3. Cut it into the animation with `build_sheet` (`{ "from":
"art/wolf-walk-grid.png", "columns": 4, "rows": 2 }`, `align`
   `baseline` for feet, `centre` for what flies or swims, `keep` when its
   cells already line up).
4. Look at it with `look_at_animation`, every frame on the grey it shows;
   and when the scene plays it over both dark and light, look at the scene
   too. Fix and look again.

To fix one frame, give the picture tool that frame and its neighbours as
the guide, then build the same frames again with that one replaced -
`{ "animation": "wolf-walk", "frame": 3 }` for the ones that stay. Timing,
loop and frame order are the animation file's fields, not a new picture.

With no picture tool at all, say so plainly in one sentence, and give the
member the prompt to paste into the image tool they use, filled in for this
creature:

> A sprite sheet of a grey wolf walking to the right, 8 frames in a 4 by 2
> grid, each frame one equal cell, side view, the whole body inside every
> cell with the same scale and the paws at the same height, a full walk
> cycle (contact, down, passing, up for each side), on one flat pure green
> background, no ground, no shadow, no text.

When they put the result in `art/`, cut it with `build_sheet` as above.

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

## How many frames

Animation reads smooth at about twelve drawings a second ("on twos"):

| what                                  | frames | plays at       |
| ------------------------------------- | ------ | -------------- |
| walk or run cycle                     | 8      | 8-10 a second  |
| the least that still reads as walking | 6      | 8 a second     |
| swim cycle, wing beat                 | 8-12   | 10-12 a second |
| a dive, a breach, a turn (once)       | 16-24  | 12 a second    |
| breathing, ears, tail, blinking       | 3-4    | 4-6 a second   |

A grid from a picture tool costs the member's plan per picture; `pose_sheet`
frames cost nothing, so a slow, big creature bent from one picture can take
more.

## The animation file

`animations/whale-dive.json` (the tools write it beside every sheet, under
the animation's own name; they refuse to write over the member's pictures
or another animation's sheet):

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
