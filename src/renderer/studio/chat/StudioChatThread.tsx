/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, UIEvent } from 'react';
import type { IStudioChat, TStudioChatRestore } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { AI_IDEAS } from '../aiPrompt';
import ChatText from './ChatText';
import StudioChatCopy from './StudioChatCopy';
import StudioChatPictureViewer from './StudioChatPictureViewer';
import StudioChatReply from './StudioChatReply';
import { chatPicturesOf, pictureKey } from './chatPictureList';

/** Within this many pixels of the end, the thread follows a reply as it grows. */
const FOLLOW_SLACK = 48;

interface IStudioChatThreadProps {
  chat?: IStudioChat;
  /** The version the stage plays. */
  version?: number;
  /** An idea chosen to start from: it goes into the message box. */
  onIdea: (idea: string) => void;
  /** Asks Claude to carry on a reply that was cut short. */
  onCarryOn: () => void;
  /** Answers the last reply again, when it failed. */
  onRetry: () => void;
  /** A reply's version brought back, in this chat. */
  onRestore: (entryId: string) => Promise<TStudioChatRestore>;
  /**
   * The open scene's name, when the project already holds one: an empty
   * chat then asks what should change in it, and offers no ideas for a new
   * scene (Ivan, 2026-10-13: "having pre prompts there when already a scene
   * is open doesn't make sense").
   */
  sceneName?: string | undefined;
  /**
   * What an empty chat says in place of the scene's welcome: an animator's
   * chat says what it works on, and offers no ideas for a scene.
   */
  welcome?: ReactNode;
}

/**
 * The conversation, newest at the foot. It follows a reply as it is written
 * — unless the member has scrolled up to read something earlier, which a
 * reply growing underneath must not pull them away from.
 */
export default function StudioChatThread({
  chat,
  version,
  onIdea,
  onCarryOn,
  onRetry,
  onRestore,
  sceneName,
  welcome,
}: IStudioChatThreadProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  // Scrolled up from the end: the way back to it shows (Ivan, 2026-11-07:
  // "add a go back button with typing animated dot click jump to last").
  const [away, setAway] = useState(false);
  // On the way down after a press: the scroll it causes passes through
  // "away" and must not bring the button back on its way.
  const jumping = useRef(false);
  const entries = chat?.entries ?? [];
  const last = entries[entries.length - 1];
  // The picture open in the viewer, by its key; the viewer steps through
  // every picture in the conversation.
  const [viewing, setViewing] = useState<string>();
  const pictures = useMemo(
    () => chatPicturesOf(chat?.entries ?? [], t),
    [chat?.entries, t],
  );
  const viewed = pictures.findIndex(({ key }) => key === viewing);
  // Changes as a reply grows: its words, its steps, its end.
  const growth = last
    ? `${last.id}:${last.text.length}:${last.kind === 'claude' ? `${last.steps.length}:${last.state}` : ''}`
    : '';

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && following.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [growth, entries.length]);

  // The newest reply whose version is the one on the stage: a version
  // brought back is the playing one, whichever reply made it.
  const playingEntry =
    version === undefined
      ? undefined
      : [...entries]
          .reverse()
          .find(
            (entry) => entry.kind === 'claude' && entry.version === version,
          );

  if (entries.length === 0) {
    return (
      <div className="studio-chat__thread is-empty">
        <div className="studio-chat__welcome">
          <span className="studio-chat__welcome-mark" aria-hidden="true">
            <Glyph name="studio" />
          </span>
          {welcome ??
            (sceneName ? (
              <>
                <h3>
                  {t('studioChat.welcomeSceneTitle', { name: sceneName })}
                </h3>
                <p>{t('studioChat.welcomeSceneBody')}</p>
              </>
            ) : (
              <>
                <h3>{t('studioChat.welcomeTitle')}</h3>
                <p>{t('studioChat.welcomeBody')}</p>
                <div
                  className="studio-chat__ideas"
                  role="group"
                  aria-label={t('studio.maker.examples')}
                >
                  {AI_IDEAS.map((entry) => (
                    <button
                      key={entry.label}
                      type="button"
                      className="studio-idea"
                      title={t(entry.idea)}
                      onClick={() => onIdea(t(entry.idea))}
                    >
                      {t(entry.label)}
                    </button>
                  ))}
                </div>
              </>
            ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={scroller}
        className="studio-chat__thread"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        // A picture that finishes loading grows the thread under the newest
        // line; following, the thread stays on that line rather than on where
        // its end was before the picture came.
        onLoadCapture={(event) => {
          const element = event.currentTarget;
          if (following.current) {
            element.scrollTop = element.scrollHeight;
          }
        }}
        onScroll={(event: UIEvent<HTMLDivElement>) => {
          const element = event.currentTarget;
          following.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            FOLLOW_SLACK;
          if (following.current) {
            jumping.current = false;
          }
          setAway(!following.current && !jumping.current);
        }}
      >
        {entries.map((entry) =>
          entry.kind === 'me' ? (
            <div key={entry.id} className="studio-chat__mine">
              <StudioChatCopy text={entry.text} />
              <div className="studio-chat__me" aria-label={t('studioChat.you')}>
                <ChatText text={entry.text} />
                {entry.picture && (
                  <button
                    type="button"
                    className="studio-chat__attached"
                    aria-label={t('studioChat.seenLarger')}
                    aria-haspopup="dialog"
                    onClick={() => setViewing(pictureKey(entry.id))}
                  >
                    <img
                      src={entry.picture}
                      alt={t('studioChat.attachedNote')}
                    />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <StudioChatReply
              key={entry.id}
              reply={entry}
              onRestore={onRestore}
              playing={entry === playingEntry}
              // Only the last reply, and only one cut short: by Stop, by
              // FluidEQ closing in the middle of it, or by Claude Code ending.
              onCarryOn={
                entry === last &&
                !chat?.busy &&
                (entry.state === 'stopped' || entry.failure === 'crashed')
                  ? onCarryOn
                  : undefined
              }
              onRetry={
                entry === last && !chat?.busy && entry.state === 'failed'
                  ? onRetry
                  : undefined
              }
              onOpenPicture={setViewing}
            />
          ),
        )}
        {away && (
          // Pinned to the foot of the thread while it scrolls, taking no
          // room in it; dots while Claude is still writing below.
          <div className="studio-chat__latest-dock">
            <button
              type="button"
              className="studio-chat__latest"
              title={t(
                chat?.busy ? 'studioChat.latestWriting' : 'studioChat.latest',
              )}
              aria-label={t(
                chat?.busy ? 'studioChat.latestWriting' : 'studioChat.latest',
              )}
              onClick={() => {
                const element = scroller.current;
                if (!element) {
                  return;
                }
                jumping.current = true;
                following.current = true;
                setAway(false);
                // Where the glide ended says what is true now: at the end,
                // or short of it - stopped by the hand, or the reply grew
                // past where the glide was aimed.
                element.addEventListener(
                  'scrollend',
                  () => {
                    jumping.current = false;
                    following.current =
                      element.scrollHeight -
                        element.scrollTop -
                        element.clientHeight <
                      FOLLOW_SLACK;
                    setAway(!following.current);
                  },
                  { once: true },
                );
                element.scrollTo({
                  top: element.scrollHeight,
                  behavior: window.matchMedia(
                    '(prefers-reduced-motion: reduce)',
                  ).matches
                    ? 'auto'
                    : 'smooth',
                });
              }}
            >
              {chat?.busy && (
                <span className="studio-chat__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              <Glyph name="arrow-up" />
            </button>
          </div>
        )}
      </div>
      {viewed !== -1 && (
        <StudioChatPictureViewer
          pictures={pictures}
          index={viewed}
          onStep={(at) => setViewing(pictures[at]?.key)}
          onClose={() => setViewing(undefined)}
        />
      )}
    </>
  );
}
