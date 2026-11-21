/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The two messages a shared preset's link travels by (`main/presetLinks.ts`):
 * main telling the window one came, and the window taking it. Here so the
 * preload's bridge names them without loading main's module.
 */
export const PRESET_LINK_ARRIVED = 'preset-link-arrived';
export const PRESET_LINK_TAKE = 'preset-link-take';
