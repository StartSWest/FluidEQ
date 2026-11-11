/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TTakedownCost } from '../../common/plusGallery';
import { rpc, type IAuthorised } from './galleryApi';

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * What taking one of the member's scenes down would give back (premium
 * 0103's `my_scene_takedown`): how many buyers get their credit back and
 * lose the scene, and how many credits come off the member's balance.
 *
 * A server without the function answers 404, and there a takedown still
 * leaves every copy where it is: that is `before-refunds`, so the window
 * says so rather than promising a refund nobody would get. Anything else
 * that is not an answer is `unknown`.
 */
const takedownCost = async (
  auth: IAuthorised,
  sceneId: string,
): Promise<TTakedownCost> => {
  let response: Response;
  try {
    response = await rpc(auth, 'my_scene_takedown', { p_scene: sceneId });
  } catch {
    return { known: 'unknown' };
  }
  if (response.status === 404) {
    return { known: 'before-refunds' };
  }
  if (!response.ok) {
    return { known: 'unknown' };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // The body stopped arriving, or was not JSON.
    return { known: 'unknown' };
  }
  return typeof body === 'object' &&
    body !== null &&
    'buyers' in body &&
    'credits' in body &&
    isCount(body.buyers) &&
    isCount(body.credits)
    ? { known: 'yes', buyers: body.buyers, credits: body.credits }
    : { known: 'unknown' };
};

export default takedownCost;
