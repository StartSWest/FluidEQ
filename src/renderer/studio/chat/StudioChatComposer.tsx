/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { STUDIO_CHAT_MAX_TEXT } from 'common/studioChat';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { chatPictureIn, firstPicture } from './chatPictureIn';
import StudioChatEffortDots from './StudioChatEffortDots';
import StudioChatAttachment from './StudioChatAttachment';
import StudioChatModelPick from './StudioChatModelPick';
import {
  setEditPicks,
  useEditPicks,
  withEditPicks,
} from '../edit/editPicksStore';
import '../../styles/StudioChatComposer.scss';
import '../../styles/StudioEdit.scss';

interface IStudioChatComposerProps {
  /**
   * The chat this box writes to: its scene's project id. Its model and
   * effort are that chat's own (chatPicks.ts).
   */
  chatKey: string;
  draft: string;
  onDraft: (draft: string) => void;
  /** The stage's picture going with the next message, marks and all. */
  stage?: Uint8Array;
  onStage: (stage?: Uint8Array) => void;
  /** Claude is writing a reply: the box takes no message, and Stop shows. */
  busy: boolean;
  /** What the empty box asks for. */
  placeholder: string;
  /** The message, sent to this box's chat. */
  onSend: (text: string, stage?: Uint8Array) => Promise<void>;
  /** Stops the reply being written. */
  onStop: () => Promise<void>;
  /** How full the chat is, beside the picks; the scene's chat shows it. */
  meter?: ReactNode;
  /** A picture of the stage as it is now; absent while nothing plays. */
  captureStage?: () => Promise<Uint8Array | undefined>;
}

/**
 * Where the member writes to Claude. Enter sends and Shift+Enter starts a
 * new line, as in every chat. "Attach the stage" takes a picture of the
 * scene as it looks now, which the member can draw on, and sends it with
 * the message, for "this, but…" requests. A picture from outside takes the
 * same place: pasted with Ctrl+V, dropped on the box, or chosen with the
 * picture button (`chatPictureIn.ts`). The words and the picture are the
 * project's draft (`chatDraftStore.ts`), kept until they are sent.
 *
 * Everything but the words stands on one bar inside the box, as in Claude's
 * own (design C, Ivan 2026-10-09): the stage's camera, the model, the effort
 * dots, then a round Send that becomes Stop while Claude works.
 */
export default function StudioChatComposer({
  chatKey,
  draft,
  onDraft,
  stage,
  onStage: setStage,
  busy,
  placeholder,
  onSend,
  onStop,
  meter,
  captureStage,
}: IStudioChatComposerProps) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);
  // A picture being dragged over the box, which lights to take it.
  const [dropping, setDropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Between the press and main's first word back: no second send.
  const [sending, setSending] = useState(false);
  const text = draft.trim();
  // What was picked on the stage in Edit mode, said first in the message.
  const picks = useEditPicks(chatKey);
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
      setEditPicks(chatKey, []);
      await onSend(
        withEditPicks(text, picks, t('studioChat.picked.lead')),
        stage,
      );
    } finally {
      setSending(false);
    }
  };

  /** A picture from outside as the message's; one that will not decode is left. */
  const takePicture = (file: File | undefined) => {
    if (!file) {
      return;
    }
    chatPictureIn(file)
      .then((picture) => {
        if (picture) {
          setStage(picture);
        }
        return undefined;
      })
      .catch(() => undefined);
  };

  // Ctrl+V with a picture on the clipboard (a screenshot, a copied image):
  // the picture goes with the message, and words pasted go in as words.
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const picture = firstPicture(event.clipboardData.files);
    if (picture) {
      event.preventDefault();
      takePicture(picture);
    }
  };

  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes('Files');

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
      <div
        className={`studio-chat__box${blocked ? ' is-busy' : ''}${dropping ? ' is-dropping' : ''}`}
        onDragOver={(event) => {
          if (hasFiles(event)) {
            event.preventDefault();
            setDropping(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDropping(false);
          }
        }}
        onDrop={(event) => {
          if (!hasFiles(event)) {
            return;
          }
          event.preventDefault();
          setDropping(false);
          takePicture(firstPicture(event.dataTransfer.files));
        }}
      >
        {stage && (
          <StudioChatAttachment
            image={stage}
            onChange={setStage}
            onRemove={() => setStage(undefined)}
          />
        )}
        {picks.length > 0 && (
          <ul
            className="studio-chat__picks"
            aria-label={t('studioChat.picked.label')}
          >
            {picks.map((pick) => (
              <li key={pick.where}>
                <span>{pick.label}</span>
                <button
                  type="button"
                  aria-label={t('studioChat.picked.remove', {
                    name: pick.label,
                  })}
                  onClick={() =>
                    setEditPicks(
                      chatKey,
                      picks.filter((known) => known !== pick),
                    )
                  }
                >
                  <Glyph name="close" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          aria-label={t('studioChat.label')}
          rows={2}
          maxLength={STUDIO_CHAT_MAX_TEXT}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
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
            // Pressed with a picture on the message, it takes it off - the
            // stage's or one from outside alike. Its name says a picture is
            // on, never "remove", which is the picture's own ×: two buttons
            // of one name cannot be told apart by a screen reader.
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
          {/* A picture from the computer, the camera's neighbour: chosen
              here, pasted with Ctrl+V or dropped on the box. */}
          <button
            type="button"
            className="studio-chat__attach"
            aria-label={t('studioChat.attachPicture')}
            title={t('studioChat.attachPictureHint')}
            disabled={blocked}
            onClick={() => fileInput.current?.click()}
          >
            <Glyph name="image" />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              takePicture(firstPicture(event.target.files));
              // The same file chosen again is a change too.
              event.target.value = '';
            }}
          />
          <StudioChatModelPick chatKey={chatKey} disabled={blocked} />
          <StudioChatEffortDots chatKey={chatKey} disabled={blocked} />
          {meter}
          {busy && (
            <button
              type="button"
              className="button small subtle studio-chat__send"
              aria-label={t('studioChat.stop')}
              title={t('studioChat.stop')}
              onClick={() => {
                onStop().catch(() => undefined);
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
