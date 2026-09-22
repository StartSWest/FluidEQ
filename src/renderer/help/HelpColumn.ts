/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { createContext } from 'react';

export interface IHelpColumn {
  /** The article's reading width, which every capture is drawn to. */
  readonly width: number;
  /** The window's height, which caps how tall a capture is drawn. */
  readonly height: number;
}

/**
 * The guide's column, measured once for every capture in it. Each capture
 * used to measure itself after mounting, which put it on screen at no size
 * and then at its own: a search that went to a passage below a capture that
 * had just appeared landed where the passage was before the capture grew.
 * Every capture shares one column, so a capture that mounts now is drawn at
 * its final size from its first paint.
 */
export const HelpColumnContext = createContext<IHelpColumn | undefined>(
  undefined,
);
