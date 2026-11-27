/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import ShippedLookStill from 'renderer/graph/lookStills/ShippedLookStill';
import { fetchShippedStills } from 'renderer/graph/lookStills/stillFetch';
import { readStillRoles } from 'renderer/graph/lookStills/stillRoles';
import type { IStillError, TRgb } from '../fit';
import PLATE_AT from '../plate';
import type { IShowRequest } from '../protocol';
import { lookOf, paintLook } from './paintLook';
import { applyState, floorNow } from './stillWindow';

/**
 * The end of the check: a shipped still laid on a plate by the window's own
 * component and stylesheet (`ShippedLookStill`), as the picker shows it,
 * screenshot by the generator, and compared with the look itself drawn in
 * the same colours on the same plate. What `fit.ts` measures is the
 * arithmetic; this is what the browser actually composites.
 */

const plate = document.createElement('div');
document.body.appendChild(plate);
const plateRoot = createRoot(plate);

let lastReal: { pixels: Uint8ClampedArray; ground: TRgb } | undefined;

const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

/** The look drawn in `state`, and its still on a plate of the floor beside it. */
export const showStill = async (request: IShowRequest): Promise<void> => {
  applyState(request.side, request.colours, {
    kind: 'real',
    name: request.state,
  });
  const ground = floorNow();
  const pixels = await paintLook(
    lookOf(request.style, request.palette),
    request.box,
    request.out,
  );
  lastReal = { pixels, ground };
  plate.style.cssText = `position:fixed;left:${PLATE_AT.left}px;top:${PLATE_AT.top}px;width:${request.box.width}px;height:${request.box.height}px;background:rgb(${ground.join(',')});`;
  const file = { url: request.url, roles: request.roles };
  // Fetched as the picker fetches it while shut; the still lays its layers
  // once the picture is in (`useShippedStillReady`).
  fetchShippedStills([file]);
  flushSync(() =>
    plateRoot.render(
      <ShippedLookStill file={file} roles={readStillRoles(request.colours)} />,
    ),
  );
  const laid = await new Promise<boolean>((resolve) => {
    let frames = 0;
    const look = () => {
      frames += 1;
      if (plate.querySelector('.look-still__layer') || frames > 600) {
        resolve(plate.querySelector('.look-still__layer') !== null);
      } else {
        requestAnimationFrame(look);
      }
    };
    look();
  });
  if (!laid) {
    throw new Error(`The still ${request.url} never laid its layers.`);
  }
  await nextFrame();
  await nextFrame();
};

/** The screenshot of the plate (PNG, base64) against the look on the same floor. */
export const compareShot = async (png: string): Promise<IStillError> => {
  if (!lastReal) {
    throw new Error('No still on show.');
  }
  const { pixels, ground } = lastReal;
  const bitmap = await createImageBitmap(
    await (await fetch(`data:image/png;base64,${png}`)).blob(),
  );
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('No 2D canvas.');
  }
  context.drawImage(bitmap, 0, 0);
  const shot = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  if (shot.length !== pixels.length) {
    throw new Error(
      `The screenshot is ${bitmap.width} x ${bitmap.height}, not the still's size.`,
    );
  }
  const differences: number[] = [];
  let total = 0;
  for (let at = 0; at < pixels.length; at += 4) {
    const alpha = pixels[at + 3] / 255;
    let worst = 0;
    let sum = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const real = pixels[at + channel] * alpha + ground[channel] * (1 - alpha);
      const difference = Math.abs(real - shot[at + channel]);
      sum += difference / 3;
      worst = Math.max(worst, difference);
    }
    // Measured where something is drawn, in the look or in the still, as
    // the arithmetic's check is (`stillError`): the bare plate would hide a
    // bad still under its own agreement.
    const bare = [0, 1, 2].every(
      (channel) => Math.abs(shot[at + channel] - ground[channel]) <= 1,
    );
    if (alpha > 0 || !bare) {
      total += sum;
      differences.push(worst);
    }
  }
  if (differences.length === 0) {
    return { mean: 0, p99: 0, max: 0 };
  }
  differences.sort((left, right) => left - right);
  return {
    mean: total / differences.length,
    p99: differences[Math.floor((differences.length - 1) * 0.99)],
    max: differences[differences.length - 1],
  };
};
