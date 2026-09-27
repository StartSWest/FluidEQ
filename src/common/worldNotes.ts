/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Why a pack's 3D world, or a part of it, was not drawn where it played: for
 * the scene's author, in their own language under the Studio's stage
 * (`StudioProblems.tsx`), and in English to their AI (`studioTools.ts`).
 *
 * Carried as codes, not sentences: the engine runs in a worker that knows no
 * language, and an English line out of it was shown under a translated
 * heading in every locale. Only what cannot be translated travels as text —
 * the graphics driver's own log, and an error's own message.
 */
export type TWorldNote =
  /** This copy has no 3D engine where it drew: the shader played. */
  | { code: 'engine-missing' }
  /** The engine's bundle would not load, in the error's words. */
  | { code: 'engine-failed'; detail: string }
  /** The engine cannot draw into this scene's picture on this GPU. */
  | { code: 'engine-unsupported' }
  /** A material's GLSL did not compile, in the driver's words. */
  | { code: 'material'; log: string }
  /** A model is not one this version reads (`worldModelCheck.ts`). */
  | { code: 'model-refused'; model: string }
  /** A model passed the check and still would not parse. */
  | { code: 'model-unreadable'; model: string; detail: string };

export type TWorldNoteCode = TWorldNote['code'];

export const WORLD_NOTE_CODES: readonly TWorldNoteCode[] = [
  'engine-missing',
  'engine-failed',
  'engine-unsupported',
  'material',
  'model-refused',
  'model-unreadable',
];

/** What became of a pack's world where it was drawn. */
export interface IWorldReport {
  /** The world drew; otherwise its shader drew in its place. */
  drawn: boolean;
  notes: readonly TWorldNote[];
}
