/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import './bridge';
import 'renderer/styles/cascade';
import { GRAPH_FORM_LOOKS, type GraphStyle } from 'common/graphStyles';
import { stillRoleNames } from 'renderer/graph/lookStills/stillRoles';
import {
  fitStill,
  stillError,
  type IStateRender,
  type IStillError,
  type TRgb,
} from '../fit';
import type { IBuildAnswer, IBuildRequest, TRealState } from '../protocol';
import { compareShot, showStill } from './composeStill';
import { lookOf, paintLook } from './paintLook';
import { applyState, floorNow, rolesNow, type TState } from './stillWindow';

/**
 * The page the generator drives (`../generate.ts`): every standard look
 * drawn by the window's own renderer on the demo song, as the picker's still
 * painter drew it (`LookStillPainter`), under many sets of the window's
 * colours (`stillWindow.ts`), and split into the roles it paints in
 * (`../fit.ts`); then each still laid on a plate as the picker lays it, for
 * the generator to screenshot (`composeStill.tsx`).
 */

const toBase64 = (bytes: Uint8Array) => {
  let text = '';
  const chunk = 0x8000;
  for (let at = 0; at < bytes.length; at += chunk) {
    text += String.fromCharCode(...bytes.subarray(at, at + chunk));
  }
  return btoa(text);
};

const build = async (request: IBuildRequest): Promise<IBuildAnswer> => {
  const started = performance.now();
  const look = lookOf(request.style, request.palette);
  const renders: IStateRender[] = [];
  const grounds: TRgb[] = [];
  const drawIn = async (state: TState) => {
    applyState(request.side, request.colours, state);
    const roles = rolesNow(request.colours);
    const ground = floorNow();
    const pixels = await paintLook(look, request.box, request.out);
    return { render: { pixels, roles }, ground };
  };
  // One drawing at a time, on one window.
  await request.seeds.reduce(
    (before, seed) =>
      before.then(async () => {
        const { render, ground } = await drawIn({ kind: 'mixed', seed });
        renders.push(render);
        grounds.push(ground);
        return undefined;
      }),
    Promise.resolve(),
  );
  const fit = fitStill(
    renders,
    stillRoleNames(request.colours, request.style),
    request.out.width,
    request.out.height,
  );
  const fittedErrors = renders.map((render, index) =>
    stillError(fit, render, grounds[index]),
  );
  const checks: ({ name: TRealState } & IStillError)[] = [];
  await request.checks.reduce(
    (before, name) =>
      before.then(async () => {
        const { render, ground } = await drawIn({ kind: 'real', name });
        checks.push({ name, ...stillError(fit, render, ground) });
        return undefined;
      }),
    Promise.resolve(),
  );
  const masks = new Uint8Array(fit.masks.length * fit.width * fit.height);
  fit.masks.forEach((mask, index) => masks.set(mask, index * mask.length));
  return {
    roles: fit.roles,
    masks: toBase64(masks),
    rest: toBase64(fit.rest),
    coverageDrift: fit.coverageDrift,
    gains: fit.gains,
    fitted: {
      mean: Math.max(...fittedErrors.map((error) => error.mean)),
      p99: Math.max(...fittedErrors.map((error) => error.p99)),
      max: Math.max(...fittedErrors.map((error) => error.max)),
    },
    checks,
    took: performance.now() - started,
  };
};

Object.assign(window, {
  lookStills: {
    forms: (): GraphStyle[] => GRAPH_FORM_LOOKS.map((look) => look.style),
    build,
    showStill,
    compareShot,
  },
});
