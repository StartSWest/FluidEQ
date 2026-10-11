/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import path from 'path';

/**
 * Where the harness is built: out of the source tree, because the bundle holds
 * every string of the app and the test that every key is read
 * (`i18nKeysInUse.test.ts`) reads `scripts/`.
 */
const BUILT = path.resolve(
  __dirname,
  '../../node_modules/.cache/fluideq-help-captures',
);

export default BUILT;
