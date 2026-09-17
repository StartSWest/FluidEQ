/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_CONTEXT_ATTRIBUTES } from './sceneHealth';

/**
 * Which graphics card is actually drawing the scenes, in the words a person
 * would use for it.
 *
 * Worth showing because the answer is not always the card in the machine, and
 * nothing said so. Ivan spent an hour on a window that had gone slow and
 * would not publish: Remote Desktop had started it on the laptop's integrated
 * chip, and coming back to the real machine did not move it — a graphics card
 * is chosen once, when the app starts, and held until it starts again. From
 * the outside that is indistinguishable from the app having become slow.
 *
 * Read once and remembered: it needs a context of its own, and the answer
 * cannot change without a restart, which is the same restart the Graphics
 * card setting asks for.
 */

/**
 * The card's own name out of what the driver reports, which is a sentence:
 *
 *   ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)
 *   ANGLE (Intel, Intel(R) UHD Graphics (0x0000A788) Direct3D11 vs_5_0 ps_5_0, D3D11)
 *
 * Kept apart from the reading so it can be tested: jsdom has no WebGL, and
 * every mistake here is one nobody would see until it was on a card we do
 * not own.
 */
export const gpuNameOf = (reported: string): string => {
  const inside = /^ANGLE \((.*)\)$/.exec(reported.trim());
  // Not ANGLE: some drivers answer with the card's name and nothing else.
  const body = inside ? inside[1] : reported.trim();
  const parts = body.split(', ');
  // ANGLE says vendor, then the card, then the graphics interface. Anything
  // else is taken whole rather than guessed at.
  const card = inside && parts.length >= 2 ? parts[1] : body;
  return (
    card
      // The device id the driver appends in brackets, and the marks that are
      // in a company's legal name and not in what anybody calls the card.
      .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
      .replace(/\((?:R|TM|C)\)/gi, '')
      // The interface and shader model, which belong to how it is being
      // driven rather than to the card.
      .replace(/\s+(?:Direct3D\d*|OpenGL|Vulkan|D3D\d*)\b.*$/i, '')
      .replace(/\s+vs_[\d_]+.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
};

let read: string | undefined | null;

/** The card drawing the scenes, or nothing where the driver will not say. */
export const sceneGpuName = (): string | undefined => {
  if (read !== undefined) {
    return read ?? undefined;
  }
  read = null;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', SCENE_CONTEXT_ATTRIBUTES);
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const reported = info
        ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
      const name = gpuNameOf(reported);
      read = name.length > 0 ? name : null;
      // The context is not needed again, and a page may hold only so many.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    read = null;
  }
  return read ?? undefined;
};
