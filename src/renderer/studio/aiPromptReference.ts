/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { AMBIENT_SECTION } from './aiPromptAmbient';
import { ARTWORK_SECTION, ART_SECTION } from './aiPromptArt';
import type { TPromptReach } from './aiPromptLook';
import { HANDS_SECTION } from './aiPromptMotion';
import { POINTER_SECTION } from './aiPromptPointer';
import { WORLD_SECTION } from './aiPromptWorld';

/**
 * The parts of the brief that are reference: formats, bounds and recipes a
 * scene needs only when it uses that thing. The Studio's chat read all of
 * them at the start of every conversation - 36,000 of its 105,000
 * characters - whether the scene had a 3D world, a photo or a camera or not
 * (Ivan, 2026-11-11: "review the rules to make sure they are perfect"; the
 * more a brief carries that the request does not need, the less of the rest
 * is followed).
 *
 * So in the chat each is a skill FluidEQ ships, loaded when the work is of
 * its kind, and the brief keeps a few lines in its place: what the thing is,
 * what to do about it unasked, and to load the skill before writing any. A
 * prompt copied for another AI has no skills to load and carries every
 * section whole, where it always stood.
 *
 * ONE SOURCE. The sections stay where they are written
 * (`aiPromptWorld.ts` and the rest), because their numbers are the engine's
 * own constants. Each skill's file under `assets/studio/fluideq/skills` is
 * that text written out, and `studioReferenceSkills.test.ts` fails while a
 * file and its section differ: change a section, then write the files again
 * as that test's header says. Nothing is ever edited in those files.
 *
 * English, like the rest of the brief: it is read by a model.
 */

export interface IReferenceSkill {
  /** The skill's name, which is its folder's. */
  name: string;
  /** When to load it: what Claude Code shows of a skill before it is read. */
  description: string;
  /** The brief's own sections, word for word. */
  body: string;
  /** What the chat's brief says where those sections stood. */
  inChat: string;
}

export const HANDS_REFERENCE: IReferenceSkill = {
  name: 'fluideq-hands',
  description:
    'The reference for what a listener\'s hand does to a FluidEQ scene - uPointer, uTap and uCamera with their formulas, the "camera" ranges and pivot in pack.json, and the pieces thrown from the pointer (pack.json "pointer") with every bound. Load before you use uPointer, uTap or uCamera, before you write or change "camera" or "pointer", and whenever the member says "turn", "rotate", "orbit", "zoom", "drag", "mouse", "pointer", "tap", "click", "touch", "sparks" or "trail".',
  body: `${HANDS_SECTION}${POINTER_SECTION}`,
  inChat: `THE VIEWER'S HANDS, AND WHAT IS THROWN FROM THE HAND
The listener can reach into a scene: point at it, tap it, and turn a 3D one
with the mouse (uPointer, uTap, uCamera; "camera" in pack.json says how
far), and FluidEQ can throw pieces from their pointer over it (pack.json
"pointer"). It is a gift, never the point: nobody can touch the desktop
background or the desk lights, so the scene is whole with uPointer.w at 0.
The formulas, the camera's ranges and pivot, and the pointer's format and
bounds are in the fluideq-hands skill: load it BEFORE you use any of those
uniforms or write "camera" or "pointer".

`,
};

export const ARTWORK_REFERENCE: IReferenceSkill = {
  name: 'fluideq-artwork',
  description:
    'The reference for pictures in a FluidEQ scene - the member\'s own photos in named places of artwork.webp (pack.json "pictures"), and art of your own, made images, library textures and models ("artworkRegions", credits.txt), with every size limit, how to cut out and pack, and which licences may ship. Load before you write a scene around a photo, read or write the artwork\'s regions, or make, fetch or pack any image, texture or model, and whenever the member says "photo", "picture", "image", "texture", "my pet", "poster", "photo-real" or "realistic".',
  body: `${ARTWORK_SECTION}${ART_SECTION}`,
  inChat: `ARTWORK AND YOUR OWN ART
A scene may show photos of mine - each a named place in artwork.webp
(pack.json "pictures") that I fill in FluidEQ - and art of your own: made
images, library textures and models ("artworkRegions", credits.txt).
Photo-real pictures lift a scene from drawn to real, so:
FIND WHAT CAN MAKE IMAGES BEFORE YOU DECIDE NOTHING CAN, and use it for what
should look real; keep drawing in code what moves or answers the music. The
formats, the limits, how to cut out and pack, and which licences may ship
are in the fluideq-artwork skill: load it BEFORE you write a scene around a
photo, read or write the artwork's regions, or make, fetch or pack any
picture, texture or model.

`,
};

export const WORLD_REFERENCE: IReferenceSkill = {
  name: 'fluideq-world-format',
  description:
    'The whole format of a FluidEQ 3D world - world.json\'s nodes, lights, camera and instances, FORMULAS and every signal they may read, MATERIALS and their GLSL, MODELS, the BOUNDS and the frame\'s budget, and what a world costs. Load before you write or change world.json, a material file or a model, together with fluideq-3d-world, which is the craft, and whenever the member says "3D", "world", "depth", "solid", "model", "shadow", "camera travels" or names a place with things standing in it.',
  body: WORLD_SECTION,
  inChat: `A 3D WORLD (optional)
A scene may add a real 3D world, drawn by FluidEQ's 3D engine in front of
scene.frag, which becomes its sky: reach for one when the idea is a place
with depth and solid things in it, and keep to scene.frag alone for flat,
graphic, painterly or abstract ideas.

Anything that must have volume - a tube, a waveform made solid, a crystal,
an animal close by - is real geometry in the world, lit, casting a shadow
and standing on its reflection. Never a line or glow in scene.frag shaded
to look round, never a ribbon (it always faces the camera) and never flat
planes painted with a tube: each reads as paper laid on the picture, and
no shading fixes that.

world.json is data - nodes, lights, a camera, models, instanced crowds,
materials with GLSL of your own - and any number in it may be a formula on
the music. Its whole format (A 3D WORLD, FORMULAS, MATERIALS, MODELS, BOUNDS
AND THE FRAME'S BUDGET) is in the fluideq-world-format skill, and how to
make one worth watching in fluideq-3d-world: load BOTH BEFORE you write or
change world.json, a material file or a model. A world that breaks the
format is not drawn: FluidEQ plays the shader alone and tells you why.

`,
};

export const AMBIENT_REFERENCE: IReferenceSkill = {
  name: 'fluideq-ambient',
  description:
    'The reference for a FluidEQ scene\'s ambient elements - the things of the scene\'s own world that float faintly over the app\'s window (pack.json "ambient") - with every shape, motion, field and bound, the two sliders every scene with elements carries, and how to offer them to the member. Load before you write or change "ambient", for every new scene, and whenever the member says "ambient", "around the app", "over the window", "floating", "flying", "birds", "petals" or "particles".',
  body: AMBIENT_SECTION,
  inChat: `AMBIENT (optional, in pack.json)
The scene's own elements floating faintly over the app's window when I
choose the Ambient mode: birds for a mountain scene, petals for a flower,
stars for a city. FluidEQ draws them from a description in pack.json
("ambient"); none of it is code. Give every new scene the ones that belong
to its world, and ask me in one line which I would like without waiting for
the answer. The format, its bounds and how to offer them are in the
fluideq-ambient skill: load it BEFORE you write or change "ambient".
`,
};

/** Every part of the brief the chat loads as a skill, in the brief's order. */
export const REFERENCE_SKILLS: readonly IReferenceSkill[] = [
  HANDS_REFERENCE,
  ARTWORK_REFERENCE,
  WORLD_REFERENCE,
  AMBIENT_REFERENCE,
];

/**
 * A reference skill's SKILL.md, whole: the open format's frontmatter, then
 * the brief's sections as they stand. One newline ends it, however the
 * section ends in the brief.
 */
export const referenceSkillFile = ({
  name,
  description,
  body,
}: IReferenceSkill): string =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body.trimEnd()}\n`;

/** A reference part as this reader gets it: named in the chat, whole elsewhere. */
export const referenceIn = (reach: TPromptReach, skill: IReferenceSkill) =>
  reach === 'chat' ? skill.inChat : skill.body;
