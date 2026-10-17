/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IStudioChatQueued } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { unqueueStudioChat } from './studioChatStore';

/**
 * Messages sent while Claude was still answering, over the message box
 * (Ivan, 2026-10-14: "we need to be able to queue messages to claude"). Each
 * is handed to Claude when its next step starts and read the moment that
 * step returns (2026-10-16: "so they are read faster not when the turn
 * ends"), and joins the conversation there. Waiting, it can be taken back;
 * handed over, it is Claude's, and says so. A stop keeps them: Claude reads
 * them next.
 */
export default function StudioChatQueue({
  queued,
}: {
  queued: readonly IStudioChatQueued[];
}) {
  const { t } = useTranslation();
  if (queued.length === 0) {
    return null;
  }
  return (
    <section
      className="studio-chat__queue"
      aria-label={t('studioChat.queue.title')}
    >
      <p className="studio-chat__queue-title">{t('studioChat.queue.title')}</p>
      <ol>
        {queued.map((item) => (
          <li key={item.id}>
            {item.picture && (
              <span
                className="studio-chat__queue-picture"
                title={t('studioChat.queue.picture')}
              >
                <Glyph name="camera" />
              </span>
            )}
            <span className="studio-chat__queue-text">{item.text}</span>
            {item.sent ? (
              <span
                className="studio-chat__queue-sent"
                title={t('studioChat.queue.sent')}
                aria-label={t('studioChat.queue.sent')}
              />
            ) : (
              <button
                type="button"
                className="studio-chat__queue-remove"
                title={t('studioChat.queue.remove')}
                aria-label={t('studioChat.queue.remove')}
                onClick={() => {
                  unqueueStudioChat(item.id).catch(() => undefined);
                }}
              >
                <Glyph name="close" />
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
