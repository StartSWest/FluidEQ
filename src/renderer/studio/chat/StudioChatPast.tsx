/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useState } from 'react';
import Glyph from '../../community/Glyph';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import {
  deletePastStudioChat,
  loadPastStudioChats,
  openPastStudioChat,
  useStudioChat,
} from './studioChatStore';
import {
  dropChatPin,
  pinnedFirst,
  toggleChatPin,
  useStudioPins,
} from '../studioPins';
import '../../styles/StudioChatPast.scss';

/**
 * The open project's earlier chats, in the pane where the conversation
 * stands (Ivan, 2026-10-09: "how can I recover a previous chat if I create a
 * new one", "do past chats"). Pressing one opens it in place of the open
 * chat, which joins the list in its turn; nothing is lost either way. Those
 * Claude Code kept and FluidEQ did not say so, and offer no delete: they
 * are Claude Code's files.
 */
export default function StudioChatPast({ onOpened }: { onOpened: () => void }) {
  const { t, locale } = useTranslation();
  const { past, chat } = useStudioChat();
  const busy = chat?.busy ?? false;
  const projectId = chat?.projectId;
  const pinned = useStudioPins().chats[projectId ?? ''] ?? [];
  // A delete is for good, so the first press only asks.
  const [deleting, setDeleting] = useState<string>();
  // The reader's own calendar and clock, as the account cards use.
  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  useEffect(() => {
    loadPastStudioChats().catch(() => undefined);
  }, []);

  if (!past) {
    return (
      <p className="studio-chat__note" role="status">
        {t('studioChat.past.loading')}
      </p>
    );
  }
  if (past.length === 0) {
    return (
      <div className="studio-chat-past is-empty">
        <span className="studio-chat-past__mark" aria-hidden="true">
          <Glyph name="history" />
        </span>
        <p>{t('studioChat.past.empty')}</p>
      </div>
    );
  }
  return (
    <div className="studio-chat-past">
      <h3 className="studio-chat-past__heading">
        {t('studioChat.past.title')}
      </h3>
      {busy && (
        <p className="studio-chat-past__busy" role="status">
          {t('studioChat.past.busy')}
        </p>
      )}
      <ul aria-label={t('studioChat.past.title')}>
        {pinnedFirst(past, pinned, (item) => item.id).map((item) => (
          <li key={item.id} className="studio-chat-past__item">
            <button
              type="button"
              className="studio-chat-past__open"
              disabled={busy}
              title={
                item.source === 'claude-code'
                  ? t('studioChat.past.fromClaudeHint')
                  : undefined
              }
              onClick={() => {
                openPastStudioChat(item.id)
                  .then(onOpened)
                  .catch(() => undefined);
              }}
            >
              <span className="studio-chat-past__title">
                {item.title || '…'}
              </span>
              <span className="studio-chat-past__meta">
                <span>{when.format(item.savedAt)}</span>
                {item.source === 'claude-code' && (
                  <span className="studio-chat-past__tag">
                    {t('studioChat.past.fromClaude')}
                  </span>
                )}
              </span>
            </button>
            {/* Pinned to the top of this project's list, newest pin first;
                lit while it is, so a pinned chat says so without a hover. */}
            {projectId && deleting !== item.id && (
              <button
                type="button"
                className={`studio-chat-past__pin${
                  pinned.includes(item.id) ? ' is-on' : ''
                }`}
                aria-pressed={pinned.includes(item.id)}
                aria-label={`${t(
                  pinned.includes(item.id)
                    ? 'studio.pin.remove'
                    : 'studio.pin.add',
                )}: ${item.title || '…'}`}
                title={t(
                  pinned.includes(item.id)
                    ? 'studio.pin.remove'
                    : 'studio.pin.add',
                )}
                onClick={() => toggleChatPin(projectId, item.id)}
              >
                <MenuIcon name="pin" />
              </button>
            )}
            {item.source === 'fluideq' && deleting !== item.id && (
              <button
                type="button"
                className="studio-chat-past__delete"
                title={t('studioChat.past.delete')}
                aria-label={t('studioChat.past.delete')}
                onClick={() => setDeleting(item.id)}
              >
                <Glyph name="delete" />
              </button>
            )}
            {deleting === item.id && (
              <span className="studio-chat-past__confirm">
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => {
                    setDeleting(undefined);
                    // A deleted chat takes its pin with it.
                    deletePastStudioChat(item.id)
                      .then(() => {
                        if (projectId) {
                          dropChatPin(projectId, item.id);
                        }
                        return undefined;
                      })
                      .catch(() => undefined);
                  }}
                >
                  {t('common.icon.delete')}
                </button>
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => setDeleting(undefined)}
                >
                  {t('common.icon.cancel')}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
