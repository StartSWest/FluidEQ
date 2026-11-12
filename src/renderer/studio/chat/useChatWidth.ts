/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { RefObject } from 'react';
import useColumnWidth from '../useColumnWidth';

/**
 * `$studio-chat-min`, and the stage's own least width beside the chat
 * (`$studio-stage-min`) plus the grid's gap, in `Studio.scss`.
 */
const CHAT_MIN = 320;
const STAGE_MIN = 480;
const GRID_GAP = 16;
/**
 * `$full-scene-least` in `StudioFullscreen.scss`: in full screen the scene
 * keeps the stage's plate and the Edit button beside it in one row.
 */
const FULL_SCENE_LEAST = 960;

/**
 * The chat column's width, as the member dragged it (Ivan, 2026-10-09: "I
 * wanna be able to resize the chat part"). Unset, the sheet's own width
 * stands: 30% of the bench between 320 and 440px.
 */
export default function useChatWidth(column: RefObject<HTMLElement | null>) {
  return useColumnWidth(column, {
    storageKey: 'fluideq.studio.chatWidth',
    property: '--studio-chat-width',
    least: CHAT_MIN,
    besideLeast: STAGE_MIN + GRID_GAP,
  });
}

/**
 * The chat's width in the Studio's full screen, a width of its own (Ivan,
 * 2026-11-12: "el chat debe ser resizable en fullscreen también"): the
 * screen has room the window has not, and a chat widened over the scene
 * would otherwise come back to the window as wide. Unset, the window's
 * width stands (`StudioFullscreen.scss`).
 */
export function useFullscreenChatWidth(column: RefObject<HTMLElement | null>) {
  return useColumnWidth(column, {
    storageKey: 'fluideq.studio.fullscreenChatWidth',
    property: '--studio-full-chat-width',
    least: CHAT_MIN,
    besideLeast: FULL_SCENE_LEAST,
  });
}
