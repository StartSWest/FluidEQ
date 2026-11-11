---
name: fluideq-views
description: Make a FluidEQ scene right in all three views a listener meets it in - STANDARD (the EQ graph), ULTRA WIDE (the graph on an ultra-wide monitor) and MOBILE (the Compact player's tall column, where the scene runs on under the player) - and check them with look_at_views. Use after every change that can be seen, whenever the member says "mobile", "phone", "player", "ultra wide", "wide", "cut off", "black bottom", "black bar" or "doesn't fit", and before telling the member anything is done.
---

# The three views of a FluidEQ scene

A listener meets a scene in three places. A change that is right in one is
often wrong in another, and the member sees all three. Check all three,
every time.

| Name           | Shape                                        | Where                                                         |
| -------------- | -------------------------------------------- | ------------------------------------------------------------- |
| **STANDARD**   | `graph`, about 2.35:1                        | the EQ graph, and the Studio's stage                          |
| **ULTRA WIDE** | `ultra-wide-graph`, 2956 by 534, about 5.5:1 | the graph on an ultra-wide monitor                            |
| **MOBILE**     | `compact-player-column`, 480 by 966          | the Compact player: a tall column, the scene behind all of it |

## How to look

`look_at_views` draws all three in one answer, at the same moment of the
music, with the same sliders and camera. It takes every argument
`look_at_scene` takes except `shape`:

- after every change that can be seen;
- again after every fix, all three - a fix for one view is the commonest
  way to break another;
- with `sliders: { "daylight": 0 }` and `100` when the change touched
  light or colour, so night and day are both checked in all three.

For one view alone, `look_at_scene` with that `shape`. `compact-player` is
the player's picture by itself, 480 by 309; `compact-player-column` is the
whole column and the one that shows what is under it.

## What "right" is in each

**STANDARD.** The picture as composed: the subject whole, the wave where
the member put it, nothing crowded against an edge.

**ULTRA WIDE.** More than twice as wide for the same height. Nothing
important lost off the ends, nothing stretched sideways, no empty band of
flat colour either side of a subject that stayed small in the middle. A
landscape should widen and show more of itself; a single subject should
stay its size with the world carrying on round it.

**MOBILE.** Two things, and both must hold:

1. _The panel._ The top third of the column is the player's picture, and
   narrower than the scene was composed for. FluidEQ slides the picture
   sideways until the scene's `framing` focus is in view. The subject must
   be whole there, not cut by the panel's side.
2. _Under the panel._ The other two thirds of the column, behind the
   player's frosted controls, are **your scene running on past the panel's
   foot** - `uv.y` below 0. Whatever the scene draws there is what the
   member sees. If it draws nothing, they see a black slab under the
   player.

## Black under the player is the scene's fault, and yours to fix

When the member says the bottom is black on mobile, or sends a picture of
the player with a dark slab under the scene, **that slab is your scene**:
it is what your shader returns for `uv.y` below 0. The Studio's player
view, and the Compact player with its Backdrop on, draw the scene behind
the whole column; the player only lays a light shade and its frosted
controls over it. It is not FluidEQ's window, not the player's own body,
and not outside what the scene can paint. Never tell the member it is
before you have drawn the column yourself and seen your scene fill it. Do
this instead:

1. `look_at_scene` with `shape: "compact-player-column"` (or
   `look_at_views`). You will see the whole column, the black included.
   The `compact-player` shape alone shows only the top third and will look
   full: it cannot show this fault, so never judge mobile by it.
2. Find what stops the picture at the panel's foot - a clamp, a test for
   `uv.y < 0.0`, a floor or a reflection that ends at 0, a vignette, a fade
   to black - and let the world carry on down instead.
3. Look at the column again. Under the panel there is now more water,
   floor, sand or sky, never black, and no line where the panel ends.

What is **not** the fix:

- Fading the bottom of the picture to black "so it melts into the dark".
  That makes the scene end sooner and the slab larger.
- The ambient layer (drifting jellies, bubbles, snow). It floats over the
  window in Ambient mode and is not the scene's ground.
- Asking the member to make the panel taller, or to use another view.
- Asking the member where they see it. They see it in the Compact player;
  you can see it too, with the column shape.

## The scene runs on past its panel

`uv` is 0 to 1 across the panel. In the Compact player, and in the
Backdrop (the whole window round the graph), FluidEQ draws the same scene
on a larger canvas with the panel only a part of it, and `uv` carries on
below 0 and above 1. `uResolution` stays the panel's, so sizes and aspect
are what they always were.

So, in the shader:

- Never clamp `uv`, never `discard`, never return black, and never fade to
  nothing outside 0 to 1.
- Carry the world on past every edge: the ground, the floor or the water
  on down; the sky on up; the sides on out. Under the panel is usually the
  foreground - more water, more sand, more floor, darker and calmer, so the
  player's controls read over it.
- A reflection, a gradient or a fog that was written to end at `uv.y = 0`
  ends in a hard line at the panel's foot. Let it run.
- Anything laid out by "the bottom of the picture" - a horizon at a share
  of the height, a floor at `uv.y = 0.2` - keeps working, because `uv`
  still means the panel. Only what tested for the edge breaks.
- A vignette darkens toward the panel's edges and then the column below is
  black. Measure it from the centre and let it level off, or leave the
  bottom out of it.

In a 3D world the camera simply sees more: make the ground, the water and
the backdrop reach well past what the panel shows, downward most of all,
and keep fog and the backdrop colour agreeing so the far edge of the
ground is not a line.

## Framing, briefly

`pack.json`'s `framing` says what the scene keeps in view on a panel
narrower or wider than it was composed for: `focus` is where its important
part is, `narrowest` the narrowest panel it is whole in by itself. Put the
focus on the subject. Never squeeze or stretch the picture yourself to fit
the player.

## Before you answer

All three views looked at, since the last save, and each judged. If one is
wrong, say nothing is done: fix it, save, `look_at_views` again.
