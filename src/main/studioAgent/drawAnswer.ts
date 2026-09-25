/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from '../../common/scenePacks';
import {
  STUDIO_AGENT_MOMENT_KEYS,
  STUDIO_AGENT_SHAPES,
  type IStudioAgentDrawAsk,
  type IStudioAgentMoment,
  type TStudioAgentDrawAnswer,
} from '../../common/studioAgent';

/**
 * What goes into a look and what comes back from one, checked here and
 * nowhere else: the sliders a picture is drawn at, and the window's answer,
 * read as a stranger's before any of it reaches the member's AI.
 */

/** Room for a JPEG of the largest shape, and nothing like a payload. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_LOG_CHARACTERS = 16 * 1024;

/** A JPEG from both ends: its start-of-image marker, and its end. */
const isJpeg = (bytes: Uint8Array) =>
  bytes.byteLength > 4 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[2] === 0xff &&
  bytes[bytes.byteLength - 2] === 0xff &&
  bytes[bytes.byteLength - 1] === 0xd9;

/** A moment of finite numbers, every one of them there; or nothing. */
const readMoment = (raw: unknown): IStudioAgentMoment | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const fields = raw as Record<string, unknown>;
  const moment: Partial<IStudioAgentMoment> = {};
  const whole = STUDIO_AGENT_MOMENT_KEYS.every((key) => {
    const value = fields[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return false;
    }
    moment[key] = value;
    return true;
  });
  return whole ? (moment as IStudioAgentMoment) : undefined;
};

/**
 * What the window sent back, checked as a stranger's: the page runs other
 * people's shaders, and whatever it says reaches the member's AI.
 */
export const readDrawAnswer = (
  raw: unknown,
  ask: Pick<IStudioAgentDrawAsk, 'shape'>,
): TStudioAgentDrawAnswer => {
  const unavailable: TStudioAgentDrawAnswer = {
    ok: false,
    reason: 'unavailable',
  };
  if (typeof raw !== 'object' || raw === null) {
    return unavailable;
  }
  const answer = raw as Record<string, unknown>;
  if (answer.ok === true) {
    const { width, height } = STUDIO_AGENT_SHAPES[ask.shape];
    const { image, drawMs, renderWidth, renderHeight, spectrumRect } = answer;
    const moment = readMoment(answer.moment);
    const whole = (value: unknown): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value > 0;
    if (
      !(image instanceof Uint8Array) ||
      image.byteLength > MAX_IMAGE_BYTES ||
      !isJpeg(image) ||
      answer.width !== width ||
      answer.height !== height ||
      typeof drawMs !== 'number' ||
      !Number.isFinite(drawMs) ||
      drawMs < 0 ||
      !whole(renderWidth) ||
      !whole(renderHeight) ||
      !Array.isArray(spectrumRect) ||
      spectrumRect.length !== 4 ||
      !spectrumRect.every(
        (edge) => typeof edge === 'number' && Number.isFinite(edge),
      ) ||
      !moment
    ) {
      return unavailable;
    }
    return {
      ok: true,
      image,
      width,
      height,
      drawMs,
      renderWidth,
      renderHeight,
      spectrumRect: [
        spectrumRect[0],
        spectrumRect[1],
        spectrumRect[2],
        spectrumRect[3],
      ],
      moment,
    };
  }
  switch (answer.reason) {
    case 'compile':
      // The driver's log ends in a NUL on ANGLE, and a control character in
      // what the model reads is noise at best; line breaks and tabs stay.
      return typeof answer.log === 'string'
        ? {
            ok: false,
            reason: 'compile',
            log: answer.log
              .slice(0, MAX_LOG_CHARACTERS)
              // eslint-disable-next-line no-control-regex -- matching them is the point
              .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ''),
          }
        : unavailable;
    case 'gpu-reset':
    case 'context-lost':
    case 'too-heavy':
      return { ok: false, reason: answer.reason };
    default:
      return unavailable;
  }
};

/**
 * `pack` with the sliders the caller chose for this one picture, each kept
 * inside its own range; the name of the first one the scene does not have.
 */
export const withSliders = (
  pack: IScenePack,
  sliders: Readonly<Record<string, number>>,
): IScenePack | { unknown: string } => {
  const wanted = Object.keys(sliders).find(
    (id) => !pack.params.some((param) => param.id === id),
  );
  if (wanted !== undefined) {
    return { unknown: wanted };
  }
  return {
    ...pack,
    params: pack.params.map((param) => {
      // Own keys only: a slider may be called `constructor`, and reading it
      // through the object's prototype handed it a function, which came out
      // as NaN.
      if (!Object.prototype.hasOwnProperty.call(sliders, param.id)) {
        return param;
      }
      const value = sliders[param.id];
      return {
        ...param,
        value: Math.min(param.max, Math.max(param.min, value)),
      };
    }),
  };
};
