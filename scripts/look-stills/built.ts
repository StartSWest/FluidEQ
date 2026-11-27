/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import path from 'path';

/**
 * Where the stills' page is built: out of the source tree, as the Help
 * captures' is (`scripts/help-captures/built.ts`), because the bundle holds
 * every string of the app and `i18nKeysInUse.test.ts` reads `scripts/`.
 */
const BUILT = path.resolve(
  __dirname,
  '../../node_modules/.cache/fluideq-look-stills',
);

export default BUILT;
