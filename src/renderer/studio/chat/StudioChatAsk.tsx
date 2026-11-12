/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TStudioChatAsk } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { answerStudioChat } from './studioChatStore';
import '../../styles/StudioChatAsk.scss';

/**
 * The card a reply waits on when Claude wants one of the member's own Claude
 * Code tools that their settings do not already allow, at the foot of the
 * conversation where the reply stands waiting: its name, what it is about to
 * do, and the yes or no. Allow is the loud press, the suggested one, since
 * Claude asked because the request needs it; the member can still say no,
 * and that is final.
 *
 * The cards that asked before ChatGPT made a picture, and which of two
 * makers to use, went with GPT (Ivan, 2026-11-11).
 */
export default function StudioChatAsk({ ask }: { ask: TStudioChatAsk }) {
  const { t } = useTranslation();
  const answer = (choice: 'yes' | 'chat' | 'no') => {
    answerStudioChat(ask.id, choice).catch(() => undefined);
  };
  return (
    <section
      className="studio-chat__ask"
      aria-label={t('studioChat.ask.toolTitle', { tool: ask.tool })}
    >
      <span className="studio-chat__ask-mark" aria-hidden="true">
        <Glyph name="shield" />
      </span>
      <div className="studio-chat__ask-content">
        <p className="studio-chat__ask-title">
          {t('studioChat.ask.toolTitle', { tool: ask.tool })}
        </p>
        <p className="studio-chat__ask-body">{t('studioChat.ask.toolBody')}</p>
        {ask.foreign && (
          <p className="studio-chat__ask-need">{t('studioChat.ask.foreign')}</p>
        )}
        <pre className="studio-chat__ask-detail">{ask.detail}</pre>
        {/* Three answers on one row at the chat's narrowest (Ivan,
            2026-11-07: a fourth wrapped "Don't allow" onto a line of its
            own). Always is for this chat, never every scene's: "always allow
            is per chat not global". */}
        <div className="studio-chat__ask-actions">
          <button
            type="button"
            className="button small"
            onClick={() => answer('yes')}
          >
            {t('studioChat.ask.allow')}
          </button>
          {/* Nothing is allowed for always in a scene from outside FluidEQ. */}
          {!ask.foreign && (
            <button
              type="button"
              className="button small subtle"
              title={t('studioChat.ask.allowAlwaysHint', { tool: ask.tool })}
              onClick={() => answer('chat')}
            >
              {t('studioChat.ask.allowAlways')}
            </button>
          )}
          <button
            type="button"
            className="button small subtle"
            onClick={() => answer('no')}
          >
            {t('studioChat.ask.deny')}
          </button>
        </div>
      </div>
    </section>
  );
}
