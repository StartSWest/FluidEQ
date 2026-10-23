/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IStudioChatQueued } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { sendNowStudioChat, unqueueStudioChat } from './studioChatStore';

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
  folder,
}: {
  queued: readonly IStudioChatQueued[];
  /** The project's folder, for the brief a message sent now goes with. */
  folder: string;
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
      <div className="studio-chat__queue-head">
        <p className="studio-chat__queue-title">
          {t('studioChat.queue.title')}
        </p>
        {/* Claude Code's own Send now (Ivan, 2026-10-18: "I also need the
            send now that will send it now"): the step Claude is on ends,
            and everything here is read next, as one message. */}
        <button
          type="button"
          className="button small"
          title={t('studioChat.queue.sendNowHint')}
          onClick={() => {
            sendNowStudioChat(folder).catch(() => undefined);
          }}
        >
          <Glyph name="arrow-up" />
          {t('studioChat.queue.sendNow')}
        </button>
      </div>
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
            {item.sent && (
              <span
                className="studio-chat__queue-sent"
                title={t('studioChat.queue.sent')}
                aria-label={t('studioChat.queue.sent')}
              />
            )}
            {/* Handed over or not: Claude Code takes back a message it has
                not read yet (2026-10-18: "I need to remove message sent
                from the queue"). */}
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
          </li>
        ))}
      </ol>
    </section>
  );
}
