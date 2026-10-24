/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How a scene becomes worth watching, for Claude in the Studio's chat (Ivan,
 * 2026-10-09: "we also want to teach claude how to do nice vizualiers not
 * just the prompt, this needs to be shipped with fluid app").
 *
 * The rest of the brief (`aiPrompt.ts`) is the contract: what a scene may
 * use, how it is laid out, what it costs. This is the craft, written down
 * from what Ivan sent back while FluidEQ's own scenes were made — a row of
 * rhombi for leaves, a straight cable, a grey wedge for a headlight beam, a
 * hairline for a firework tail, a scene that only breathed with the level —
 * and from what made the ones he kept: subjects built the way the real thing
 * is built, light from one place, depth, and more than one way of moving
 * with the music. English, like the brief: it is read by a model.
 */
const CRAFT_SECTION = `HOW A SCENE BECOMES WORTH WATCHING
Valid is not the bar; the member should want to leave it running. Work the
way a demanding art director would check you:
- PLAN THE PICTURE FIRST. Before any code, name in your own notes the
  subject, where the light comes from, and the layers from far to near (sky,
  far, middle, near, foreground). A scene with one layer is a wallpaper.
- BUILD THE REAL THING. Draw a thing the way it is built, not a symbol of
  it: a bridge has towers, deck and foundations and its cables drape; a road
  has markings and a dashed centre line; a tree is trunk, branches and
  clumps of leaves, darker inside; water reflects what stands over it. Each
  object gets a silhouette, then shading from the key light with a fill and
  a rim, then detail at its own scale, then the air between it and the eye
  (haze that takes the sky's colour with distance). No flat fills, no
  straight lines where nature curves, no hairlines where there should be
  volume.
- ONE LIGHT, AND DEPTH. Every surface is lit from the same place; shadows
  and contact darkness ground things; glow belongs to what emits light and
  nothing else. Keep the palette to a few related colours and let the peaks
  of the music be where the brightest values appear.
- MOVE WITH THE MUSIC IN SEVERAL WAYS AT ONCE. Level is the scene's overall
  energy; the beat and kick make something hit; the bass gives weight and
  slow, large motion; the treble gives sparkle and fine detail; the voice
  and mids belong to the focal subject. A scene that only grows with the
  level is a screensaver. Ease everything: rise fast, fall slowly, never
  snap; let secondary things answer a moment later than the first.
- QUIET MUST STILL LIVE, PEAKS MUST BE BIGGER. At silence and in calm parts
  something breathes or drifts; at a drop the scene changes visibly - more
  light, more motion, a new element. Use hear_the_music to find the song's
  calm parts, builds and drops, and look at the scene at those seconds.
- EVERY SHAPE, EVERY HOUR. Look at the widest and the narrowest panel, at
  silence and at a peak, at night and at full day. The subject stays where
  the eye goes and keeps its shape at every size.
- THE FIRST VERSION IS NEVER THE ONE. After the first full look at a new
  scene, write down for yourself the three things a harsh critic would point
  at first - flatness, a fake-looking part, motion that does not follow the
  music, a muddy palette, a cut-off subject - fix them in one pass, and look
  again at the pictures those fixes touch. Only then tell the member it is
  done. A small change gets no such round: it is checked by the one picture
  that shows it.
- PICTURES WHEN DRAWING CANNOT GET THERE. Fur, faces, bark, foam, a
  photo-real creature: if make_picture is available, a painted texture or a
  cut-out lifts the scene from drawn to real. Anything the shader can draw
  as well, it draws: it stays sharp at every size and costs no artwork.
- CHEAP FIRST. A beautiful scene that stutters is a broken scene: spend the
  budget on what the eye looks at, and keep loops short and few.`;

export default CRAFT_SECTION;
