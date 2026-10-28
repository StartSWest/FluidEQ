/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState, type KeyboardEvent } from 'react';
import { STUDIO_CHAT_MAX_TEXT } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import StudioChatEffortDots from './StudioChatEffortDots';
import StudioChatAttachment from './StudioChatAttachment';
import StudioChatModelPick from './StudioChatModelPick';
import StudioChatContext from './StudioChatContext';
import { sendToStudioChat, stopStudioChat } from './studioChatStore';
import '../../styles/StudioChatComposer.scss';

interface IStudioChatComposerProps {
  draft: string;
  onDraft: (draft: string) => void;
  /** The stage's picture going with the next message, marks and all. */
  stage?: Uint8Array;
  onStage: (stage?: Uint8Array) => void;
  /** Claude is writing a reply: the box takes no message, and Stop shows. */
  busy: boolean;
  /** Nothing has been said yet: the box asks for the scene itself. */
  first: boolean;
  /** The project's folder, for the brief Claude is given. */
  folder: string;
  /** A picture of the stage as it is now; absent while nothing plays. */
  captureStage?: () => Promise<Uint8Array | undefined>;
}

/**
 * Where the member writes to Claude. Enter sends and Shift+Enter starts a
 * new line, as in every chat. "Attach the stage" takes a picture of the
 * scene as it looks now, which the member can draw on, and sends it with
 * the message, for "this, but…" requests. The words and the picture are the
 * project's draft (`chatDraftStore.ts`), kept until they are sent.
 *
 * Everything but the words stands on one bar inside the box, as in Claude's
 * own (design C, Ivan 2026-10-09): the stage's camera, the model, the effort
 * dots, then a round Send that becomes Stop while Claude works.
 */
export default function StudioChatComposer({
  draft,
  onDraft,
  stage,
  onStage: setStage,
  busy,
  first,
  folder,
  captureStage,
}: IStudioChatComposerProps) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);
  // Between the press and main's first word back: no second send.
  const [sending, setSending] = useState(false);
  const text = draft.trim();
  // While Claude answers, a message still goes: main queues it behind the
  // reply (Ivan, 2026-10-14: "we need to be able to queue messages").
  const blocked = sending;

  const send = async () => {
    if (!text || blocked) {
      return;
    }
    setSending(true);
    try {
      onDraft('');
      setStage(undefined);
      await sendToStudioChat(text, folder, stage);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send().catch(() => undefined);
    }
  };

  return (
    <form
      className="studio-chat__composer"
      onSubmit={(event) => {
        event.preventDefault();
        send().catch(() => undefined);
      }}
    >
      <div className={`studio-chat__box${blocked ? ' is-busy' : ''}`}>
        {stage && (
          <StudioChatAttachment
            image={stage}
            onChange={setStage}
            onRemove={() => setStage(undefined)}
          />
        )}
        <textarea
          aria-label={t('studioChat.label')}
          rows={2}
          maxLength={STUDIO_CHAT_MAX_TEXT}
          value={draft}
          placeholder={t(
            first ? 'studioChat.placeholderFirst' : 'studioChat.placeholder',
          )}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {/* Stop and Send side by side take the effort's name's room: it
            gives way to the dots alone until one of them goes. */}
        <div className={`studio-chat__bar${busy && text ? ' is-crowded' : ''}`}>
          {/* The camera alone; its words go to its name and hint. It takes
              the picture at once, which then stands in the box to be drawn
              on, and lights while one will go with the message; pressed
              again, it takes the picture off. */}
          <button
            type="button"
            className={`studio-chat__attach${capturing ? ' is-running' : ''}`}
            aria-pressed={stage !== undefined}
            aria-label={t(stage ? 'studioChat.attached' : 'studioChat.attach')}
            title={t('studioChat.attachHint')}
            disabled={!captureStage || blocked || capturing}
            onClick={() => {
              if (stage) {
                setStage(undefined);
                return;
              }
              if (!captureStage) {
                return;
              }
              setCapturing(true);
              captureStage()
                .then((picture) => {
                  setStage(picture);
                  return undefined;
                })
                .catch(() => undefined)
                .finally(() => setCapturing(false));
            }}
          >
            <Glyph name="camera" />
          </button>
          <StudioChatModelPick disabled={blocked} />
          <StudioChatEffortDots disabled={blocked} />
          <StudioChatContext folder={folder} />
          {busy && (
            <button
              type="button"
              className="button small subtle studio-chat__send"
              aria-label={t('studioChat.stop')}
              title={t('studioChat.stop')}
              onClick={() => {
                stopStudioChat().catch(() => undefined);
              }}
            >
              <Glyph name="stop" />
            </button>
          )}
          {/* While Claude answers, Send queues: it stands beside Stop once
              there is something to send, and says what it will do. */}
          {(!busy || text) && (
            <button
              type="submit"
              className={`button small studio-chat__send${sending ? ' is-running' : ''}`}
              aria-label={t(busy ? 'studioChat.queue.send' : 'studioChat.send')}
              title={t(busy ? 'studioChat.queue.send' : 'studioChat.send')}
              disabled={!text || blocked}
              aria-busy={sending}
            >
              <Glyph name="arrow-up" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
