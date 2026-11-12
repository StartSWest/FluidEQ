/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';

/**
 * The Studio's full screen with its work in it (Ivan, 2026-11-11: "on full
 * screen can we show a toggle bottom pane for tune, code etc", "also in full
 * screen we show the chat with a collapsible"): whether the work pane and
 * the chat are out over the scene, and how tall the pane stands, kept for
 * the next full screen.
 *
 * Ctrl+J for the pane and Ctrl+L for the chat, the panel and chat keys of
 * the editors members know (VS Code, Cursor); neither means anything else
 * in the Studio. Heard only while the screen is full.
 */

const KEY = 'fluideq.studio.fullscreenPanes';
/** The pane's height as a share of the screen, and how far it may go. */
export const PANE_DEFAULT = 0.4;
export const PANE_LEAST = 0.2;
export const PANE_MOST = 0.7;

export interface IFullscreenPanes {
  pane: boolean;
  chat: boolean;
  /** The pane's height, as a share of the screen. */
  height: number;
}

const START: IFullscreenPanes = {
  pane: true,
  chat: true,
  height: PANE_DEFAULT,
};

export const clampPaneHeight = (share: number) =>
  Math.min(PANE_MOST, Math.max(PANE_LEAST, share));

/** What was kept, read as nothing unless it is what this keeps. */
export const readKeptPanes = (raw: string | null): IFullscreenPanes => {
  if (raw === null) {
    return START;
  }
  try {
    const kept: unknown = JSON.parse(raw);
    if (typeof kept !== 'object' || kept === null) {
      return START;
    }
    const { pane, chat, height } = kept as Record<string, unknown>;
    return {
      pane: typeof pane === 'boolean' ? pane : START.pane,
      chat: typeof chat === 'boolean' ? chat : START.chat,
      height:
        typeof height === 'number' && Number.isFinite(height)
          ? clampPaneHeight(height)
          : START.height,
    };
  } catch {
    // Written by something else, or half: the panes as they start.
    return START;
  }
};

const read = (): IFullscreenPanes => {
  try {
    return readKeptPanes(window.localStorage.getItem(KEY));
  } catch {
    // Storage refused (a locked-down profile): the panes as they start.
    return START;
  }
};

const keep = (panes: IFullscreenPanes) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(panes));
  } catch {
    // Storage refused: the panes still work, for this full screen.
  }
};

export default function useFullscreenPanes(full: boolean) {
  const [panes, setPanes] = useState(read);

  /** The panes changed from what they are now, and kept so. */
  const update = useCallback(
    (patch: (now: IFullscreenPanes) => Partial<IFullscreenPanes>) =>
      setPanes((now) => {
        const next = { ...now, ...patch(now) };
        keep(next);
        return next;
      }),
    [],
  );
  const togglePane = useCallback(
    () => update((now) => ({ pane: !now.pane })),
    [update],
  );
  const toggleChat = useCallback(
    () => update((now) => ({ chat: !now.chat })),
    [update],
  );

  useEffect(() => {
    if (!full) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'j') {
        togglePane();
      } else if (key === 'l') {
        toggleChat();
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () =>
      window.removeEventListener('keydown', onKey, { capture: true });
  }, [full, togglePane, toggleChat]);

  return {
    ...panes,
    togglePane,
    toggleChat,
    setHeight: (share: number) =>
      update(() => ({ height: clampPaneHeight(share) })),
  };
}
