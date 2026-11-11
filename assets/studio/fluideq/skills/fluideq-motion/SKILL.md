---
name: fluideq-motion
description: Watch how a FluidEQ scene moves - the whole picture or one part of it cut out - as a few frames a moment apart, to judge direction, smoothness, loops, flaps, swings, pulses and camera moves. Use whenever the question is about motion rather than one moment - "it should drift left", "is it smooth", "the fish swims backwards", "it stutters", "does it move with the beat" - and before telling the member anything that moves is done.
---

# Watching a FluidEQ scene move

One picture cannot say which way a thing is going, whether it gets there
evenly, or whether it moves at all. `look_at_scene` answers how a moment
looks; `watch_scene` answers how the scene moves. Use the second for every
claim you make about motion.

## What you get

`watch_scene` draws the scene exactly as `look_at_scene` does, several times
along the music, and returns one picture: the frames side by side, left to
right, each under its number and its moment in seconds. Past five frames
they run onto a second row. With it come the measurements of every step
between two frames:

- how much of the picture's light changed, in percent;
- which way the picture moved, when it moved as one - a share of the part's
  width left or right, a share of its height up or down;
- or "in place", when the change is not a move: a pulse, a flicker, a
  change of shape or colour, or things going different ways at once.

Then one line on the run of steps: even, uneven and by how much, moving in
some steps and still in others, or reversing direction.

Nothing is saved and nothing in the project changes.

## The three choices

**How many frames** (`frames`, 2 to 8, 5 if you say nothing). Three show a
direction. Five show whether the motion is even. Eight show one cycle of
something that repeats.

**How far apart** (`every`, seconds, 0.1 if you say nothing). Match it to
the thing:

| What moves                                 | `every`      |
| ------------------------------------------ | ------------ |
| a flicker, a spark, a hit, a fast flap     | 0.03 to 0.05 |
| a wing beat, a fish tail, a walk, a bounce | 0.08 to 0.12 |
| a swim across, a swing, a wave rolling     | 0.15 to 0.3  |
| a drift, clouds, a slow camera, a swell    | 0.5 to 1     |

Too close and nothing seems to move; too far and one cycle is skipped and
the motion reads backwards or random. If a step shows "nothing to speak of
changed" where something should move, widen `every` before you conclude it
is still.

**Which part** (`region`, in uv: `x`, `y` the bottom-left corner, `width`,
`height`, all 0 to 1). Cut close round the thing. A small part is shown
enlarged, so a fish that is thirty pixels in the whole picture fills its
frame. And the measurements are of the picture, not of the thing: a fish
crossing a still sea shifts only its own share of the light, so over the
whole picture the direction is lost in the background. Cut to the fish and
the number says which way it went.

To find the part: `look_at_scene` first, see where the thing is, and give a
region with room round it for where it will be by the last frame. uv counts
from the bottom-left, the same as `uv` in the shader and as `pointer` and
`tap`.

## When to start

The first frame is at `seconds` (or `beats`); the rest follow. Left out, it
is the first kick after the warm-up, where `look_at_scene` takes its
picture.

- Motion that runs on its own (a drift, a swim, a loop): any moment will do.
- Motion that answers the beat: start a little before a beat and step
  through it. The test music is 118 BPM, a beat a little over half a
  second: `beats: 7.75`, `every: 0.127`, `frames: 5` walks in quarter beats
  from just before the drop on beat 8 to three quarters of a beat after it.
  With a `tempo` of your own, a quarter beat is 15 divided by the tempo.
- What silence does: `sound: "silence"`. A scene at rest should still be
  alive - something drifting - and never frozen or jittering.

## How to judge

Look at the frames first. The numbers are there to keep you honest.

- **Direction.** Follow one feature from frame 1 to the last. If the member
  asked for left and it goes right, that is the fault - commonly a sign on
  `time`, or uv counted from the other edge.
- **Evenness.** For something meant to glide, each step should cover about
  the same ground. Steps that differ by more than about one and a half
  times are an ease, a hit or a stutter: right if you meant it, a fault if
  not.
- **A loop.** Take frames across one whole period and one more. The last
  step should look like the first. A jump at the join is a period that does
  not divide the cycle, or a `fract` that resets where `sin` would not.
- **A flap, a swing, a walk.** Over one cycle the direction reverses once
  each way. Reversing every step is jitter: the motion is faster than your
  spacing, or something is dividing by a frame's time.
- **Sliding.** A thing that should walk, swim or fly but only slides - the
  same shape in every frame, in a new place - needs an animation, not a
  faster slide. Load the fluideq-animation skill.
- **Moving at all.** "Nothing moves" in a part that should is a real
  finding: a speed of zero, a term multiplied by a signal that is silent,
  or the wrong part watched.
- **With the music.** A thing that moves the same in silence as on the drop
  is not answering the music. Watch both and compare the step sizes.

## Working with it

1. Change the scene and save.
2. `look_at_scene` once, to see that it draws and where the thing is.
3. `watch_scene` with a region round the thing.
4. Fix what the frames show; save.
5. `watch_scene` again **with the same arguments**, so the two strips can be
   compared frame for frame.

Each frame is a full draw of the scene, so a watch costs as many looks as
it has frames. Ask for the one that answers your question; do not watch a
scene no save has changed.

Tell the member what they will see - "the fish now swims left, evenly, and
its tail beats twice a second" - never the frames or the numbers, unless
they ask.
