/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The pinned electron-builder can select BCJ2 or ARM64 automatically. Use the
 * single-stream BCJ filter supported by the install-time Nsis7z extractor.
 * https://github.com/electron-userland/electron-builder/pull/9989
 *
 * @param {{ electronPlatformName: string, targets: { name: string }[] }} context
 */
module.exports = ({ electronPlatformName, targets }) => {
  if (
    electronPlatformName === 'win32' &&
    targets.some(({ name }) => name === 'nsis' || name === 'nsis-web')
  ) {
    process.env.ELECTRON_BUILDER_7Z_FILTER = 'BCJ';
  }
};
