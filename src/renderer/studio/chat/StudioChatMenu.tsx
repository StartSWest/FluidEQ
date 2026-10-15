/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu from '../../widgets/AnchoredMenu';
import StudioChatZoom from './StudioChatZoom';
import { disconnectStudioChatCodex, useStudioChat } from './studioChatStore';
import useChatPopover from './useChatPopover';

/**
 * The chat's housekeeping, behind ⋯ in its head (Ivan, 2026-10-14, pick A of
 * the composer mockups: "I dont like stuffs underneath the input chat"): the
 * text size, the accounts, the prompt for another AI, ChatGPT's pictures while
 * they are on, and what the chat runs on. Everything here is set once and left; none of it belongs
 * between the member and the message box. Named for the chat, never Publish's
 * "More": two buttons a screen reader names alike cannot be told apart.
 */
export default function StudioChatMenu({
  onAccounts,
  otherAi,
  onOtherAi,
}: {
  onAccounts: () => void;
  /** The pane shows the prompt for another AI instead of the chat. */
  otherAi: boolean;
  onOtherAi: () => void;
}) {
  const { t } = useTranslation();
  const { codex } = useStudioChat();
  const popover = useChatPopover();
  return (
    <>
      <button
        ref={popover.setAnchor}
        type="button"
        className="studio-chat__icon"
        title={t('studioChat.menu')}
        aria-label={t('studioChat.menu')}
        aria-expanded={popover.isOpen}
        aria-haspopup="dialog"
        onClick={popover.toggle}
      >
        <Glyph name="more" />
      </button>
      <AnchoredMenu
        anchor={popover.anchor}
        isOpen={popover.isOpen}
        role="dialog"
        className="studio-chat-pop studio-chat-pop--menu"
        ariaLabel={t('studioChat.menu')}
      >
        <div className="studio-chat-pop__row">
          <span>{t('studioChat.zoom.label')}</span>
          <StudioChatZoom />
        </div>
        <button
          type="button"
          className="studio-chat-pop__item"
          onClick={() => {
            popover.close();
            onAccounts();
          }}
        >
          <Glyph name="person" />
          <span>{t('studioChat.accounts.title')}</span>
        </button>
        <button
          type="button"
          className="studio-chat-pop__item"
          aria-pressed={otherAi}
          onClick={() => {
            popover.close();
            onOtherAi();
          }}
        >
          <Glyph name="link" />
          <span>
            {t(otherAi ? 'studioChat.backToChat' : 'studioChat.otherAi')}
          </span>
        </button>
        {codex?.connected && (
          <div className="studio-chat-pop__row">
            <span className="studio-chat-pop__on">
              <Glyph name="image" />
              {t('studioChat.chatgptOn')}
            </span>
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                disconnectStudioChatCodex().catch(() => undefined);
              }}
            >
              {t('studioChat.chatgptTurnOff')}
            </button>
          </div>
        )}
        <div className="studio-chat-pop__rule" role="none" />
        <p className="studio-chat-pop__fine">{t('studioChat.fine')}</p>
      </AnchoredMenu>
    </>
  );
}
