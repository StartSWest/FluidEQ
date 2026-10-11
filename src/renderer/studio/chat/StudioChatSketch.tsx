/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { TranslationKey } from 'common/i18n';
import Glyph, { type TCommunityGlyph } from '../../community/Glyph';
import DialogFrame from '../../components/DialogFrame';
import holdFocusReturn from '../../utils/focusReturn';
import { useTranslation } from '../../utils/I18nContext';
import {
  drawMark,
  LEAST_ARROW,
  type IPoint,
  type TSketchMark,
  type TSketchTool,
} from './sketchMarks';
import '../../styles/StudioChatSketch.scss';

/**
 * Drawing on the stage's picture before it goes with a message (Ivan,
 * 2026-10-09: "allow user click on attached scene image and draw on
 * them", then "also let me draw arrows and add text"): circle the thing,
 * point an arrow at it, write a word beside it — Claude sees the marks with
 * the picture, which says "this one" better than a sentence can.
 *
 * The marks are drawn at the picture's own size, so they land on what was
 * pointed at whatever size the dialog shows it at, and the picture that
 * leaves is the stage with the marks on it, one JPEG, as before.
 */

/** Ink that reads over any scene: three loud colours and white. */
const INKS: { colour: string; name: TranslationKey }[] = [
  { colour: '#ff4d5e', name: 'studioChat.sketch.red' },
  { colour: '#ffd23f', name: 'studioChat.sketch.yellow' },
  { colour: '#3ce7d8', name: 'studioChat.sketch.cyan' },
  { colour: '#ffffff', name: 'studioChat.sketch.white' },
];

/**
 * Pen widths as fractions of the picture's width, so they read the same on
 * any picture; text is set at a size that matches its pen.
 */
const WIDTHS: { share: number; text: number; name: TranslationKey }[] = [
  { share: 0.005, text: 0.032, name: 'studioChat.sketch.thin' },
  { share: 0.012, text: 0.05, name: 'studioChat.sketch.thick' },
];

const TOOLS: {
  tool: TSketchTool;
  glyph: TCommunityGlyph;
  name: TranslationKey;
}[] = [
  { tool: 'pen', glyph: 'studio', name: 'studioChat.sketch.pen' },
  { tool: 'arrow', glyph: 'arrow-mark', name: 'studioChat.sketch.arrow' },
  { tool: 'text', glyph: 'text-mark', name: 'studioChat.sketch.text' },
];

const JPEG_QUALITY = 0.9;
const MAX_TEXT = 80;

interface IStudioChatSketchProps {
  /** The picture as it is now, a JPEG or PNG. */
  image: Uint8Array;
  /** The picture with the marks on it. */
  onDone: (image: Uint8Array) => void;
  onClose: () => void;
}

/** A word being typed: where it goes, in the picture's pixels and on screen. */
interface IWriting {
  at: IPoint;
  left: number;
  top: number;
  text: string;
}

export default function StudioChatSketch({
  image,
  onDone,
  onClose,
}: IStudioChatSketchProps) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [picture, setPicture] = useState<ImageBitmap>();
  const [marks, setMarks] = useState<TSketchMark[]>([]);
  const [tool, setTool] = useState<TSketchTool>('pen');
  const [ink, setInk] = useState(INKS[0].colour);
  const [size, setSize] = useState(WIDTHS[0]);
  const [writing, setWritingState] = useState<IWriting>();
  // The same word, read synchronously: a press elsewhere both blurs the
  // field and presses the picture or a tool, in one render, and the word
  // must be set down once.
  const writingNow = useRef<IWriting | undefined>(undefined);
  const setWriting = (next: IWriting | undefined) => {
    writingNow.current = next;
    setWritingState(next);
  };
  const [saving, setSaving] = useState(false);
  const drawing = useRef<TSketchMark | undefined>(undefined);

  useEffect(() => {
    let live = true;
    createImageBitmap(new Blob([new Uint8Array(image)]))
      .then((bitmap) => {
        if (live) {
          setPicture(bitmap);
        } else {
          bitmap.close();
        }
        return undefined;
      })
      .catch(() => onClose());
    return () => {
      live = false;
    };
  }, [image, onClose]);

  useEffect(() => () => picture?.close(), [picture]);

  // The picture and every mark, drawn again whenever they change.
  const paint = () => {
    const context = canvas.current?.getContext('2d');
    if (!context || !picture) {
      return;
    }
    context.drawImage(picture, 0, 0);
    marks.forEach((mark) => drawMark(context, mark));
    if (drawing.current) {
      drawMark(context, drawing.current);
    }
  };
  useLayoutEffect(paint);

  useEffect(() => {
    const giveFocusBack = holdFocusReturn();
    return giveFocusBack;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A word being typed takes its own keys (`onKeyDown` on its field).
      if (writing) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        setMarks((done) => done.slice(0, -1));
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, writing]);

  /** Where the pointer is on the picture, in the picture's own pixels. */
  const pointOf = (event: MouseEvent<HTMLCanvasElement>): IPoint => {
    const element = event.currentTarget;
    const box = element.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * element.width,
      y: ((event.clientY - box.top) / box.height) * element.height,
    };
  };

  /** The word typed so far, set down on the picture; an empty one is dropped. */
  const setDownWord = () => {
    const { current } = writingNow;
    const word = current?.text.trim();
    if (current && word && picture) {
      setMarks((done) => [
        ...done,
        {
          kind: 'text',
          colour: ink,
          size: picture.width * size.text,
          at: current.at,
          text: word,
        },
      ]);
    }
    setWriting(undefined);
  };

  const finishMark = () => {
    const mark = drawing.current;
    drawing.current = undefined;
    if (!mark) {
      return;
    }
    if (
      mark.kind === 'arrow' &&
      Math.hypot(mark.to.x - mark.from.x, mark.to.y - mark.from.y) <
        mark.width * LEAST_ARROW
    ) {
      paint();
      return;
    }
    setMarks((done) => [...done, mark]);
  };

  const startMark = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !picture) {
      return;
    }
    // A word starts on the click instead (`startWord`).
    if (tool === 'text') {
      return;
    }
    const at = pointOf(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    const width = Math.max(2, picture.width * size.share);
    drawing.current =
      tool === 'arrow'
        ? { kind: 'arrow', colour: ink, width, from: at, to: at }
        : { kind: 'pen', colour: ink, width, points: [at] };
    paint();
  };

  /**
   * A word starts where the picture was clicked. On the click and not the
   * press: the press goes on to move the focus where the mouse went, and a
   * field opened on it lost its focus at once and closed empty. A word
   * already being typed is set down first.
   */
  const startWord = (event: MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'text') {
      return;
    }
    setDownWord();
    const box = event.currentTarget.getBoundingClientRect();
    setWriting({
      at: pointOf(event),
      left: event.clientX - box.left,
      top: event.clientY - box.top,
      text: '',
    });
  };

  const moveMark = (event: PointerEvent<HTMLCanvasElement>) => {
    const mark = drawing.current;
    if (!mark) {
      return;
    }
    if (mark.kind === 'pen') {
      mark.points.push(pointOf(event));
    } else if (mark.kind === 'arrow') {
      mark.to = pointOf(event);
    }
    paint();
  };

  // Saving sets down a word still being typed first; the picture is taken
  // once that word is painted, which the layout effect above has done by the
  // time this effect runs.
  const save = () => {
    setDownWord();
    setSaving(true);
  };
  useEffect(() => {
    const element = canvas.current;
    if (!saving || !element) {
      return;
    }
    element.toBlob(
      (blob) => {
        if (!blob) {
          setSaving(false);
          return;
        }
        blob
          .arrayBuffer()
          .then((bytes) => onDone(new Uint8Array(bytes)))
          .catch(() => setSaving(false));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  }, [saving, onDone]);

  return createPortal(
    <div
      className="studio-share-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <DialogFrame
        className="studio-chat-sketch"
        icon={<Glyph name="image" />}
        title={t('studioChat.sketch.title')}
        titleId="studio-chat-sketch-title"
        description={t('studioChat.sketch.lead')}
        closeLabel={t('studioChat.sketch.cancel')}
        onClose={onClose}
        footer={
          <div className="dialog-frame__actions">
            <button
              type="button"
              className="button small subtle"
              onClick={onClose}
            >
              {t('studioChat.sketch.cancel')}
            </button>
            <button
              type="button"
              className={`button small${saving ? ' is-running' : ''}`}
              disabled={!picture || saving}
              aria-busy={saving}
              onClick={save}
            >
              {t('studioChat.sketch.done')}
            </button>
          </div>
        }
      >
        <div className="studio-chat-sketch__tools">
          <div
            className="studio-chat-sketch__kinds"
            role="radiogroup"
            aria-label={t('studioChat.sketch.tool')}
          >
            {TOOLS.map((entry) => (
              <button
                key={entry.tool}
                type="button"
                role="radio"
                aria-checked={tool === entry.tool}
                aria-label={t(entry.name)}
                title={t(entry.name)}
                onClick={() => {
                  setDownWord();
                  setTool(entry.tool);
                }}
              >
                <Glyph name={entry.glyph} />
              </button>
            ))}
          </div>
          <div
            className="studio-chat-sketch__inks"
            role="radiogroup"
            aria-label={t('studioChat.sketch.ink')}
          >
            {INKS.map((entry) => (
              <button
                key={entry.colour}
                type="button"
                role="radio"
                aria-checked={ink === entry.colour}
                aria-label={t(entry.name)}
                title={t(entry.name)}
                style={{ color: entry.colour }}
                onClick={() => setInk(entry.colour)}
              />
            ))}
          </div>
          <div
            className="studio-chat-sketch__widths"
            role="radiogroup"
            aria-label={t('studioChat.sketch.width')}
          >
            {WIDTHS.map((entry) => (
              <button
                key={entry.share}
                type="button"
                role="radio"
                aria-checked={size === entry}
                className={entry === WIDTHS[0] ? 'is-thin' : 'is-thick'}
                aria-label={t(entry.name)}
                title={t(entry.name)}
                onClick={() => setSize(entry)}
              >
                <span />
              </button>
            ))}
          </div>
          <span className="studio-chat-sketch__gap" />
          <button
            type="button"
            className="button small subtle"
            disabled={marks.length === 0}
            onClick={() => setMarks((done) => done.slice(0, -1))}
          >
            {t('studioChat.sketch.undo')}
          </button>
          <button
            type="button"
            className="button small subtle"
            disabled={marks.length === 0}
            onClick={() => setMarks([])}
          >
            {t('studioChat.sketch.clear')}
          </button>
        </div>
        <div className="studio-chat-sketch__stage">
          {picture && (
            <div className="studio-chat-sketch__frame">
              <canvas
                ref={canvas}
                width={picture.width}
                height={picture.height}
                className={`is-${tool}`}
                aria-label={t('studioChat.sketch.canvas')}
                onPointerDown={startMark}
                onPointerMove={moveMark}
                onPointerUp={finishMark}
                onPointerCancel={finishMark}
                onClick={startWord}
              />
              {writing && (
                <input
                  // The field the word is typed in, where it will stand;
                  // Enter sets it down, Escape drops it.
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- the press on the picture asked for a word here
                  autoFocus
                  className="studio-chat-sketch__word"
                  style={{
                    left: writing.left,
                    top: writing.top,
                    color: ink,
                  }}
                  maxLength={MAX_TEXT}
                  value={writing.text}
                  placeholder={t('studioChat.sketch.textHint')}
                  aria-label={t('studioChat.sketch.text')}
                  onChange={(event) =>
                    setWriting({ ...writing, text: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      setDownWord();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      setWriting(undefined);
                    }
                  }}
                  onBlur={setDownWord}
                />
              )}
            </div>
          )}
        </div>
      </DialogFrame>
    </div>,
    document.body,
  );
}
