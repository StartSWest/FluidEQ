/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { chatDraftText, setChatDraftText } from './chatDraftStore';

/**
 * A request for the scene's chat from elsewhere in the Studio (Ivan,
 * 2026-11-10: "make the root chat work on animations and all"): the words
 * are written into the chat's message box - never sent, so the member reads
 * them and presses send - after whatever the member had already written
 * there, and the chat is brought into view, its tab chosen on a narrow
 * bench and its column unfolded on a wide one, with the caret in the box.
 */

type TListener = () => void;
const listeners = new Set<TListener>();
/** An ask the chat's box has not yet taken the caret for. */
let unfocused = false;

export const askSceneChat = async (projectId: string, text: string) => {
  const kept = (await chatDraftText(projectId)).trim();
  setChatDraftText(projectId, kept ? `${kept}\n\n${text}` : text);
  unfocused = true;
  listeners.forEach((listener) => listener());
};

/** Calls `onAsked` whenever something asks the scene's chat. */
export const useSceneChatAsked = (onAsked: () => void) => {
  const latest = useRef(onAsked);
  latest.current = onAsked;
  useEffect(() => {
    const listener = () => latest.current();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
};

/**
 * Whether an ask is waiting for the box to take the caret; true once. The
 * box may only exist after the ask brought its tab in, so it asks when it
 * appears as well as when it is told.
 */
export const takeAskFocus = (): boolean => {
  const waiting = unfocused;
  unfocused = false;
  return waiting;
};
