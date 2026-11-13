/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import path from 'path';

/**
 * Where the gallery drawing is built: out of the source tree, as the Help
 * captures' harness is (`scripts/help-captures/built.ts`), because the bundle
 * holds every string of the app.
 */
const BUILT = path.resolve(
  __dirname,
  '../../node_modules/.cache/fluideq-gallery-ground',
);

export default BUILT;
