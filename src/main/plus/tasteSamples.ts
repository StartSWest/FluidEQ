/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IGalleryAuth } from './galleryAccess';
import { rpc } from './galleryApi';

const PACK_ID = /^[a-z][a-z0-9-]{1,47}$/;

/**
 * The official scenes an account without Plus can taste live, as the server
 * lists them (server migration 0023): a live taste hands the whole scene to
 * the machine playing it, so only scenes chosen to be given away play; every
 * other scene's page shows its picture and the way to Plus.
 *
 * Undefined when the list could not be asked; the gallery then names no
 * scene a free taste, which is the safe way to be wrong — the page still
 * plays a sample, it only goes unadvertised.
 */
export const fetchTasteSamples = async (
  auth: IGalleryAuth,
): Promise<string[] | undefined> => {
  try {
    const response = await rpc(auth, 'official_sample_scenes', {});
    if (!response.ok) {
      return undefined;
    }
    const rows: unknown = await response.json();
    return Array.isArray(rows)
      ? rows.filter(
          (id): id is string => typeof id === 'string' && PACK_ID.test(id),
        )
      : undefined;
  } catch {
    return undefined;
  }
};
