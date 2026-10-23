/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu from '../../widgets/AnchoredMenu';
import { compactStudioChat, useStudioChat } from './studioChatStore';
import useChatPopover from './useChatPopover';

/** Past these the ring turns amber, then red: time to compact. */
const NEARLY = 0.7;
const ALMOST = 0.9;
const RING = 2 * Math.PI * 6;

const levelOf = (share: number | undefined) => {
  if (share !== undefined && share >= ALMOST) {
    return 'is-full';
  }
  return share !== undefined && share >= NEARLY ? 'is-near' : 'is-fine';
};

/**
 * How full Claude's context window is (Ivan, 2026-10-14: "show the context
 * windows in the chat"), as a ring in the message box's own bar beside Send
 * (his pick A of the composer mockups, the same day: nothing under the box).
 * Pressed, it says the size in tokens and offers Compact, which is what
 * empties it. Before a reply has finished the model's window is not known,
 * and the ring shows the size alone.
 */
export default function StudioChatContext({ folder }: { folder: string }) {
  const { t, locale } = useTranslation();
  const { chat } = useStudioChat();
  const popover = useChatPopover();
  const tokens = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'compact' }),
    [locale],
  );
  const percents = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent' }),
    [locale],
  );
  const context = chat?.context;
  if (!context) {
    return null;
  }
  const share = context.window
    ? Math.min(1, context.used / context.window)
    : undefined;
  const used = tokens.format(context.used);
  const detail = context.window
    ? t('studioChat.context.detail', {
        used,
        window: tokens.format(context.window),
      })
    : t('studioChat.context.tokens', { used });
  const level = levelOf(share);
  return (
    <>
      <button
        ref={popover.setAnchor}
        type="button"
        className={`studio-chat__context ${level}`}
        title={detail}
        aria-label={detail}
        aria-expanded={popover.isOpen}
        aria-haspopup="dialog"
        onClick={popover.toggle}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle className="studio-chat__context-track" cx="8" cy="8" r="6" />
          <circle
            className="studio-chat__context-fill"
            cx="8"
            cy="8"
            r="6"
            strokeDasharray={`${(share ?? 0) * RING} ${RING}`}
          />
        </svg>
        <span>{share === undefined ? used : percents.format(share)}</span>
      </button>
      <AnchoredMenu
        anchor={popover.anchor}
        isOpen={popover.isOpen}
        role="dialog"
        className={`studio-chat-pop ${level}`}
        ariaLabel={detail}
      >
        <p className="studio-chat-pop__title">
          {share === undefined
            ? t('studioChat.context.tokens', { used })
            : t('studioChat.context.share', {
                percent: Math.round(share * 100),
              })}
        </p>
        {share !== undefined && context.window && (
          <>
            <div className="studio-chat-pop__meter" aria-hidden="true">
              <span style={{ width: `${share * 100}%` }} />
            </div>
            <p className="studio-chat-pop__figures">
              {t('studioChat.context.tokensOf', {
                used,
                window: tokens.format(context.window),
              })}
            </p>
          </>
        )}
        <p className="studio-chat-pop__text">
          {t('studioChat.context.explain')}
        </p>
        <button
          type="button"
          className="button small studio-chat-pop__action"
          disabled={chat.busy}
          onClick={() => {
            popover.close();
            compactStudioChat(folder).catch(() => undefined);
          }}
        >
          <Glyph name="compact" />
          {t('studioChat.compact.label')}
        </button>
      </AnchoredMenu>
    </>
  );
}
