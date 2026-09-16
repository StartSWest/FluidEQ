/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';
import { PRODUCT_VERSION } from '../common/branding';

/**
 * FluidEQ's own version, for the main process.
 *
 * `app.getVersion()` is not it under `pnpm dev`. Electron reads a version out
 * of the app's `package.json`, and development runs it on a file rather than
 * on a package — so it answers `process.versions.electron` instead, and the
 * whole app called itself 43.2.0: the bug report, the restart marker the
 * unattended updater leaves, the Razer package the lighting helper registers,
 * and what the app tells the account service about itself. The About dialog
 * said 1.7.2 at the same moment, because the window reads `PRODUCT_VERSION`.
 *
 * `PRODUCT_VERSION` comes from `release/app/package.json`, the same file
 * electron-builder takes the installer's number from, and reaches both halves
 * of the app the same way — webpack's `EnvironmentPlugin` when packaged, and
 * `dev-main.cjs` filling `process.env` before main loads in development. So
 * this and the window can no longer disagree.
 *
 * `app.getVersion()` stays as the fallback, for the one case that would
 * otherwise report nothing at all: a build where `FLUIDEQ_VERSION` is unset.
 * An empty version in a bug report is worse than Electron's.
 */
export const appVersion = (): string => PRODUCT_VERSION || app.getVersion();
