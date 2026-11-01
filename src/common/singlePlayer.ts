/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's "one player at a time" switch (`renderer/utils/
 * singlePlayer.ts`), told to main every time it changes and once each time
 * the window loads, for the half of the rule main keeps
 * (`main/systemMediaRule.ts`).
 */
export const SINGLE_PLAYER_CHANNEL = 'single-player-switch';
/**
 * Main → page, `[isOn, peerId]`: the switch a linked computer changed while
 * the window was let go in the tray, for the page to take up as if that
 * computer had just said it (`windowlessShare.ts`).
 */
export const SINGLE_PLAYER_FROM_LINK_CHANNEL = 'single-player-from-link';

/** The switch as the window said it, or nothing for anything else. */
export const parseSinglePlayer = (raw: unknown): boolean | undefined => {
  const [isOn] = Array.isArray(raw) ? raw : [];
  return typeof isOn === 'boolean' ? isOn : undefined;
};
