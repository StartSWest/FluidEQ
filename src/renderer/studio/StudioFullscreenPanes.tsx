/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { PANE_LEAST, PANE_MOST } from './useFullscreenPanes';
import '../styles/StudioFullscreen.scss';

interface IStudioFullscreenPanesProps {
  /** The grid that fills the screen, which the pane's height is a share of. */
  gridRef: RefObject<HTMLElement | null>;
  pane: boolean;
  chat: boolean;
  /** Whether the chat is the column beside the work, not one of its tabs. */
  hasChatColumn: boolean;
  height: number;
  onHeight: (share: number) => void;
  onChat: () => void;
}

/**
 * The two handles the Studio's full screen adds over the scene: the work
 * pane's top edge, dragged from a fifth of the screen to seven tenths, and
 * the chat's edge tab, which folds it away and brings it back. The pane and
 * the chat themselves are the Studio's own, laid over the scene by the
 * grid's full-screen rules (`Studio.scss`), never copies.
 */
export default function StudioFullscreenPanes({
  gridRef,
  pane,
  chat,
  hasChatColumn,
  height,
  onHeight,
  onChat,
}: IStudioFullscreenPanesProps) {
  const { t } = useTranslation();
  const drag = useRef<number | undefined>(undefined);

  // The chat's width as it stands, for the pane, the grip and the stage's
  // controls to stop at its edge: the member's own width, read off the
  // column whenever it changes rather than assumed.
  useEffect(() => {
    const grid = gridRef.current;
    const column = grid?.querySelector<HTMLElement>(
      ':scope > .studio-bench__chat',
    );
    if (!grid || !column) {
      return undefined;
    }
    const measure = () =>
      grid.style.setProperty(
        '--studio-chat-width-now',
        `${column.getBoundingClientRect().width}px`,
      );
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(column);
    return () => {
      watch.disconnect();
      grid.style.removeProperty('--studio-chat-width-now');
    };
  }, [gridRef, hasChatColumn]);

  const shareAt = (clientY: number) => {
    const box = gridRef.current?.getBoundingClientRect();
    return box && box.height > 0 ? (box.bottom - clientY) / box.height : height;
  };

  const step = (by: number) => onHeight(height + by);

  return (
    <>
      {pane && (
        // A focusable separator with a value is the ARIA window splitter, an
        // interactive widget; the lint rules know only the bare role (the
        // same reading `PaneResizer.tsx` turns off for the same reason).
        /* eslint-disable jsx-a11y/no-noninteractive-element-interactions,
           jsx-a11y/no-noninteractive-tabindex */
        <div
          className="studio-fullscreen__grip"
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('studio.size.workPaneHeight')}
          aria-valuemin={Math.round(PANE_LEAST * 100)}
          aria-valuemax={Math.round(PANE_MOST * 100)}
          aria-valuenow={Math.round(height * 100)}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = event.pointerId;
          }}
          onPointerMove={(event) => {
            if (drag.current === event.pointerId) {
              onHeight(shareAt(event.clientY));
            }
          }}
          onPointerUp={() => {
            drag.current = undefined;
          }}
          onPointerCancel={() => {
            drag.current = undefined;
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              step(0.05);
            } else if (event.key === 'ArrowDown') {
              step(-0.05);
            } else {
              return;
            }
            event.preventDefault();
          }}
        >
          <span aria-hidden="true" />
        </div>
        /* eslint-enable jsx-a11y/no-noninteractive-element-interactions,
           jsx-a11y/no-noninteractive-tabindex */
      )}
      {hasChatColumn && (
        <button
          type="button"
          className={`studio-fullscreen__chat-tab${chat ? ' is-open' : ''}`}
          aria-expanded={chat}
          aria-label={t('studio.size.chat')}
          title={`${t('studio.size.chat')} (Ctrl+L)`}
          onClick={onChat}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d={chat ? 'M6 3.5 10.5 8 6 12.5' : 'M10 3.5 5.5 8l4.5 4.5'} />
          </svg>
          {!chat && <span>{t('studio.size.chat')}</span>}
        </button>
      )}
    </>
  );
}
