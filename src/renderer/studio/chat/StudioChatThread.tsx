/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { IStudioChat, TStudioChatRestore } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { AI_IDEAS } from '../aiPrompt';
import useStudioPictureMenu from '../useStudioPictureMenu';
import ChatText from './ChatText';
import StudioChatCopy from './StudioChatCopy';
import type { IZoomView } from '../pictureZoom';
import StudioChatPictureDraw from './StudioChatPictureDraw';
import StudioChatPictureViewer from './StudioChatPictureViewer';
import StudioChatReply from './StudioChatReply';
import {
  chatPicturesOf,
  pictureKey,
  type IChatPicture,
} from './chatPictureList';
import {
  AT_END,
  leavePlace,
  placeLeft,
  placeShown,
  scrollFor,
  threadPlaceKey,
  type TThreadPlace,
} from './chatThreadPlace';

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
   * A picture from the chat, drawn on in the picture viewer, for this chat's
   * message box: the viewer offers Draw only where it is given.
   */
  onAttachPicture?: (image: Uint8Array) => void;
}

/**
 * The conversation, newest at the foot. It follows a reply as it is written
 * — unless the member has scrolled up to read something earlier, which a
 * reply growing underneath must not pull them away from — and each chat
 * opens again where the member left it (`chatThreadPlace.ts`).
 */
export default function StudioChatThread({
  chat,
  version,
  onIdea,
  onCarryOn,
  onRetry,
  onRestore,
  sceneName,
  onAttachPicture,
}: IStudioChatThreadProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  // Scrolled up from the end: the way back to it shows (Ivan, 2026-11-07:
  // "add a go back button with typing animated dot click jump to last").
  const [away, setAway] = useState(false);
  // On the way down after a press: the scroll it causes passes through
  // "away" and must not bring the button back on its way.
  const jumping = useRef(false);
  // Returning to a chat landed near the top of a message (Ivan, 2026-11-28),
  // because the thread is one for every chat and knew only "at the end or
  // not": the chat opened at the scroll offset the previous one was left at,
  // and "at the end" was judged from the scroll event of the thread's own
  // jump, read after the pictures above the end had taken their size, so it
  // stopped following there. Now each chat keeps the member's place, and the
  // thread is put back on it whenever anything in it changes size; only a
  // position the thread did not put there itself is the member's.
  const key = threadPlaceKey(chat);
  // The open chat's key, for the handlers: set as it opens (below).
  const keyNow = useRef(key);
  const place = useRef<TThreadPlace>(AT_END);
  // The offset the thread last put itself at; any other is the member's.
  const placedAt = useRef<number | undefined>(undefined);
  const keep = useCallback((next: TThreadPlace) => {
    place.current = next;
    if (keyNow.current !== undefined) {
      leavePlace(keyNow.current, next);
    }
    setAway(!next.end && !jumping.current);
  }, []);
  /** A move the thread did not make is the member's: their place now. */
  const hearMember = useCallback(() => {
    const element = scroller.current;
    if (
      element &&
      !jumping.current &&
      placedAt.current !== undefined &&
      Math.abs(element.scrollTop - placedAt.current) >= 1
    ) {
      keep(placeShown(element));
      placedAt.current = element.scrollTop;
    }
  }, [keep]);
  /** The thread on the member's place, as it is laid out now. */
  const putBack = useCallback(() => {
    const element = scroller.current;
    if (!element) {
      return;
    }
    const top = scrollFor(element, place.current);
    // Only a real move: setting the offset ends a glide the hand started.
    if (Math.abs(element.scrollTop - top) >= 1) {
      element.scrollTop = top;
    }
    placedAt.current = element.scrollTop;
  }, []);
  const entries = chat?.entries ?? [];
  const last = entries[entries.length - 1];
  // The picture open in the viewer, by its key; the viewer steps through
  // every picture in the conversation.
  const [viewing, setViewing] = useState<string>();
  const { openMenu, menu: pictureMenu } = useStudioPictureMenu();
  const pictures = useMemo(
    () => chatPicturesOf(chat?.entries ?? [], t),
    [chat?.entries, t],
  );
  const viewed = pictures.findIndex(({ key }) => key === viewing);
  // The viewer's picture being drawn on, in the viewer's place, and the
  // closer look to bring the viewer back at when the drawing is left. Both
  // handed over in callbacks that keep their identity: the sketch decodes its
  // picture again whenever its close changes, and this thread renders on
  // every word of a reply.
  const [drawing, setDrawing] = useState<{
    picture: IChatPicture;
    view: IZoomView | undefined;
  }>();
  const [returning, setReturning] = useState<IZoomView>();
  const leaveDrawing = useCallback(() => {
    setReturning(drawing?.view);
    setDrawing(undefined);
  }, [drawing]);
  const attachDrawn = useCallback(
    (image: Uint8Array) => {
      onAttachPicture?.(image);
      setDrawing(undefined);
      setReturning(undefined);
      setViewing(undefined);
    },
    [onAttachPicture],
  );
  // Changes as a reply grows: its words, its steps, its end.
  const growth = last
    ? `${last.id}:${last.text.length}:${last.kind === 'claude' ? `${last.steps.length}:${last.state}` : ''}`
    : '';

  // Another chat opened: its own place, before it is painted anywhere else.
  useLayoutEffect(() => {
    keyNow.current = key;
    place.current = key === undefined ? AT_END : placeLeft(key);
    jumping.current = false;
    setAway(!place.current.end);
    putBack();
  }, [key, putBack]);

  useLayoutEffect(() => {
    hearMember();
    putBack();
  }, [growth, entries.length, hearMember, putBack]);

  // Whatever changes size in the thread - a picture decoded, a reply's
  // words wrapping at a new width, the zoom, the box below growing - puts
  // it back on the place, in the frame that changed it.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) {
      return undefined;
    }
    const watch = new ResizeObserver(() => {
      hearMember();
      putBack();
    });
    watch.observe(element);
    // The messages only: the way back's dock comes and goes, and its going
    // would cut the glide to the end short.
    element
      .querySelectorAll(':scope > [data-entry]')
      .forEach((message) => watch.observe(message));
    return () => watch.disconnect();
  }, [key, entries.length, hearMember, putBack]);

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
          {sceneName ? (
            <>
              <h3>{t('studioChat.welcomeSceneTitle', { name: sceneName })}</h3>
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
          )}
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
        // Every picture in the thread, the ones Claude looked at and made and
        // the ones attached, offers "Copy image" on a right click.
        onContextMenu={(event) => {
          const target = event.target instanceof Element ? event.target : null;
          const frame = target?.closest<HTMLElement>(
            '.studio-chat__seen, .studio-chat__attached',
          );
          const src = frame?.querySelector('img')?.getAttribute('src');
          if (frame && src) {
            openMenu(event, { src }, frame);
          }
        }}
        onScroll={hearMember}
      >
        {entries.map((entry) =>
          entry.kind === 'me' ? (
            <div
              key={entry.id}
              className="studio-chat__mine"
              data-entry={entry.id}
            >
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
                keep(AT_END);
                // Where the glide ended says what is true now: at the end,
                // or short of it - stopped by the hand, or the reply grew
                // past where the glide was aimed.
                element.addEventListener(
                  'scrollend',
                  () => {
                    jumping.current = false;
                    keep(placeShown(element));
                    placedAt.current = element.scrollTop;
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
      {pictureMenu}
      {viewed !== -1 && !drawing && (
        <StudioChatPictureViewer
          pictures={pictures}
          index={viewed}
          onStep={(at) => setViewing(pictures[at]?.key)}
          onClose={() => {
            setReturning(undefined);
            setViewing(undefined);
          }}
          onDraw={
            onAttachPicture
              ? (picture, view) => setDrawing({ picture, view })
              : undefined
          }
          opening={returning}
        />
      )}
      {drawing && (
        <StudioChatPictureDraw
          picture={drawing.picture}
          openingView={drawing.view}
          onBack={leaveDrawing}
          onAttach={attachDrawn}
        />
      )}
    </>
  );
}
