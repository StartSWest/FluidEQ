import { useLayoutEffect, useMemo, useRef } from 'react';
import type {
  ICommunityMessage,
  ICommunityProfile,
} from 'main/community/communityApi';
import { useTranslation } from '../utils/I18nContext';
import Avatar from './Avatar';
import Glyph from './Glyph';
import { identityStyle } from './identity';
import { splitMentions } from './mentions';

interface IMessageThreadProps {
  messages: readonly ICommunityMessage[];
  me?: ICommunityProfile;
  /** What the channel is for, shown under the empty state's title. */
  emptyHint: string;
  hasMore: boolean;
  loading: boolean;
  reported: readonly number[];
  onLoadOlder: () => void;
  onReport: (id: number) => void;
  onBlock: (userId: string) => void;
  onDelete: (id: number) => void;
}

/**
 * Consecutive messages from one person inside this window read as one turn,
 * with the name shown once. Five minutes is where two messages stop being one
 * thought.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const sameDay = (a: number, b: number) => {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
};

/**
 * The conversation.
 *
 * Scrolls itself, not the panel: a chat's natural resting place is the bottom,
 * and a new message must not yank somebody who has scrolled up to read. So the
 * thread remembers whether it was at the bottom before each change and returns
 * there only if it was — measured, not assumed, in a layout effect so the
 * scroll lands before the frame paints.
 *
 * Every person wears their own colour — avatar and name — so a thread can be
 * followed by colour before it is read. The actions on a row are pictures with
 * their names as labels: three words on every message would be louder than
 * the messages.
 */
export default function MessageThread({
  messages,
  me,
  emptyHint,
  hasMore,
  loading,
  reported,
  onLoadOlder,
  onReport,
  onBlock,
  onDelete,
}: IMessageThreadProps) {
  const { t, locale } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const lastCountRef = useRef(0);

  const timeOf = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  );
  const dayOf = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale],
  );

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    // Older messages were prepended: keep the reader where they were rather
    // than snapping them to the top of what just loaded.
    const grew = messages.length > lastCountRef.current;
    lastCountRef.current = messages.length;
    if (wasAtBottomRef.current || !grew) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    wasAtBottomRef.current = distance < 24;
  };

  const isAdmin = me?.role === 'admin';

  return (
    <div className="community__thread" ref={scrollRef} onScroll={onScroll}>
      {hasMore && (
        <button
          type="button"
          className="button small subtle community__older"
          disabled={loading}
          onClick={onLoadOlder}
        >
          {t('community.loadOlder')}
        </button>
      )}
      {messages.length === 0 && !loading && (
        <div className="community__empty">
          <span className="community__empty-mark" aria-hidden="true">
            <Glyph name="general" />
          </span>
          <p className="community__empty-title">{t('community.empty')}</p>
          {emptyHint && <p className="community__empty-hint">{emptyHint}</p>}
        </div>
      )}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const newDay =
          !previous || !sameDay(previous.createdAt, message.createdAt);
        const continues =
          !newDay &&
          previous.userId === message.userId &&
          message.createdAt - previous.createdAt < GROUP_WINDOW_MS;
        const own = me?.userId === message.userId;
        const mentionsMe =
          !!me &&
          splitMentions(message.body).some(
            (segment) =>
              segment.kind === 'mention' && segment.handle === me.handle,
          );
        const isReported = reported.includes(message.id);
        return (
          <div key={message.id}>
            {newDay && (
              <div className="community__day" role="separator">
                <span>{dayOf.format(new Date(message.createdAt))}</span>
              </div>
            )}
            <article
              className={`community__message${continues ? ' community__message--continues' : ''}${mentionsMe ? ' community__message--mentions-me' : ''}${own ? ' community__message--own' : ''}`}
              style={identityStyle(message.handle)}
            >
              {continues ? (
                <time className="community__time">
                  {timeOf.format(new Date(message.createdAt))}
                </time>
              ) : (
                <Avatar
                  handle={message.handle}
                  displayName={message.displayName}
                />
              )}
              <div className="community__body">
                {!continues && (
                  <header className="community__meta">
                    <span className="community__name community__name--hued">
                      {message.displayName || message.handle}
                    </span>
                    <span className="community__handle">@{message.handle}</span>
                    {message.role === 'admin' && (
                      <span className="community__role community__role--admin">
                        {t('community.role.admin')}
                      </span>
                    )}
                    {message.role === 'contributor' && (
                      <span className="community__role">
                        {t('community.role.contributor')}
                      </span>
                    )}
                    <time className="community__time">
                      {timeOf.format(new Date(message.createdAt))}
                    </time>
                  </header>
                )}
                <p className="community__text">
                  {splitMentions(message.body).map((segment) =>
                    segment.kind === 'mention' ? (
                      <span
                        key={segment.start}
                        className={`community__mention${segment.handle === me?.handle ? ' community__mention--me' : ''}`}
                      >
                        {segment.text}
                      </span>
                    ) : (
                      <span key={segment.start}>{segment.text}</span>
                    ),
                  )}
                </p>
              </div>
              <div className="community__actions">
                {!own && (
                  <button
                    type="button"
                    className="community__action"
                    disabled={isReported}
                    aria-label={
                      isReported
                        ? t('community.action.reported')
                        : t('community.action.report')
                    }
                    title={
                      isReported
                        ? t('community.action.reported')
                        : t('community.action.report')
                    }
                    onClick={() => onReport(message.id)}
                  >
                    <Glyph name="report" />
                  </button>
                )}
                {!own && (
                  <button
                    type="button"
                    className="community__action"
                    aria-label={t('community.action.block')}
                    title={t('community.action.block')}
                    onClick={() => onBlock(message.userId)}
                  >
                    <Glyph name="block" />
                  </button>
                )}
                {(own || isAdmin) && (
                  <button
                    type="button"
                    className="community__action community__action--danger"
                    aria-label={t('community.action.delete')}
                    title={t('community.action.delete')}
                    onClick={() => onDelete(message.id)}
                  >
                    <Glyph name="delete" />
                  </button>
                )}
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
