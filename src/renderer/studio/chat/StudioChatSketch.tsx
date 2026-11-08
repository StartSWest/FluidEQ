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
import Glyph from '../../community/Glyph';
import DialogFrame from '../../components/DialogFrame';
import holdFocusReturn from '../../utils/focusReturn';
import { useTranslation } from '../../utils/I18nContext';
import usePictureZoom from '../usePictureZoom';
import useSpaceHeld from '../useSpaceHeld';
import {
  drawMark,
  LEAST_ARROW,
  type IPoint,
  type TSketchMark,
} from './sketchMarks';
import StudioChatCropBox from './StudioChatCropBox';
import StudioChatSketchTools, {
  INKS,
  WIDTHS,
  type TSketchMode,
} from './StudioChatSketchTools';
import useSketchCrop from './useSketchCrop';
import useSketchPicture from './useSketchPicture';
import '../../styles/StudioPictureLightbox.scss';
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
 *
 * As large as the window lets it be, and zoomed the way the Studio's picture
 * viewers zoom (`usePictureZoom`: Ctrl with the wheel or a pinch about the
 * pointer, the wheel to move round a zoomed picture, + − 0, the bar) — Ivan,
 * 2026-11-07: "this windows needs to be bigger and be able to zoom the image
 * to see better". The pointer's drags stay the pen's; with Space held they
 * move a zoomed picture instead, as in drawing tools (2026-11-08: "pan with
 * space pressed").
 *
 * The crop tool keeps only the part of the picture inside a box
 * (2026-11-08: "zoom and crop attached chat images"), marks and all: they
 * are part of the picture from then on, and Undo takes the crop back with
 * the marks it held.
 */

/** The most a small picture is enlarged to fill the space when fitted. */
const MOST_FITTED = 2;

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
  const sketch = useSketchPicture(image, onClose);
  const { picture, marks, setMarks } = sketch;
  const [tool, setTool] = useState<TSketchMode>('pen');
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
  const [cropping, setCropping] = useState(false);
  const drawing = useRef<TSketchMark | undefined>(undefined);
  const placeRef = useRef<HTMLDivElement>(null);
  // A crop is a new picture, shown fitted: its zoom is keyed to it.
  const zoom = usePictureZoom(
    placeRef,
    `sketch-${sketch.crops}`,
    picture?.width ?? 1,
    picture?.height ?? 1,
    MOST_FITTED,
  );
  const spaceHeld = useSpaceHeld(!writing);
  const panning = spaceHeld && zoom.pannable;

  /** Where a pointer is on the picture, in the picture's own pixels. */
  const pointAt = (clientX: number, clientY: number): IPoint | undefined => {
    const element = canvas.current;
    if (!element) {
      return undefined;
    }
    const box = element.getBoundingClientRect();
    return {
      x: ((clientX - box.left) / box.width) * element.width,
      y: ((clientY - box.top) / box.height) * element.height,
    };
  };
  const crop = useSketchCrop(picture, pointAt);

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

  // A word still being typed is set down first; the crop is taken once that
  // word is painted, which the layout effect has done when this effect runs.
  const applyCrop = () => {
    if (!crop.usable) {
      return;
    }
    setDownWord();
    setCropping(true);
  };
  useEffect(() => {
    if (!cropping) {
      return undefined;
    }
    const element = canvas.current;
    const { box } = crop;
    if (!element || !box) {
      setCropping(false);
      return undefined;
    }
    sketch
      .cropTo(element, box)
      .then(() => {
        crop.clear();
        setCropping(false);
        return undefined;
      })
      .catch(() => setCropping(false));
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- taken once per press, from the picture and box as the press found them
  }, [cropping]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A word being typed takes its own keys (`onKeyDown` on its field).
      if (writing) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        // A crop box being framed goes first, the dialog on the next press.
        if (crop.box) {
          crop.clear();
        } else {
          onClose();
        }
      } else if (
        event.key === 'Enter' &&
        tool === 'crop' &&
        crop.usable &&
        // A button with the focus is pressed by Enter itself.
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        applyCrop();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        sketch.undo();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

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

  const press = (event: PointerEvent<HTMLCanvasElement>) => {
    if (panning) {
      zoom.handlers.onPointerDown(event);
      return;
    }
    if (tool === 'crop') {
      crop.begin('new', event);
      return;
    }
    // A word starts on the click instead (`startWord`).
    const at = pointAt(event.clientX, event.clientY);
    if (event.button !== 0 || !picture || tool === 'text' || !at) {
      return;
    }
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
    const at = pointAt(event.clientX, event.clientY);
    if (tool !== 'text' || panning || !at) {
      return;
    }
    setDownWord();
    const box = event.currentTarget.getBoundingClientRect();
    setWriting({
      at,
      left: event.clientX - box.left,
      top: event.clientY - box.top,
      text: '',
    });
  };

  // Each of these ignores a drag it did not start.
  const drag = (event: PointerEvent<HTMLCanvasElement>) => {
    zoom.handlers.onPointerMove(event);
    crop.move(event);
    const mark = drawing.current;
    const at = pointAt(event.clientX, event.clientY);
    if (!mark || !at) {
      return;
    }
    if (mark.kind === 'pen') {
      mark.points.push(at);
    } else if (mark.kind === 'arrow') {
      mark.to = at;
    }
    paint();
  };

  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    zoom.handlers.onPointerUp();
    crop.end(event);
    finishMark();
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

  const stageState = [
    zoom.zoomed ? ' is-zoomed' : '',
    panning ? ' is-panning' : '',
    zoom.dragging ? ' is-dragging' : '',
  ].join('');

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
              disabled={!picture || saving || cropping}
              aria-busy={saving}
              onClick={save}
            >
              {t('studioChat.sketch.done')}
            </button>
          </div>
        }
      >
        <StudioChatSketchTools
          tool={tool}
          onTool={(next) => {
            setDownWord();
            setTool(next);
            if (next !== 'crop') {
              crop.clear();
            }
          }}
          ink={ink}
          onInk={setInk}
          width={size}
          onWidth={setSize}
          zoom={zoom}
          canCrop={crop.usable && !cropping}
          onCrop={applyCrop}
          canUndo={sketch.canUndo}
          onUndo={sketch.undo}
          canClear={marks.length > 0}
          onClear={() => setMarks([])}
        />
        <div
          ref={placeRef}
          className={`studio-chat-sketch__stage${stageState}`}
        >
          {picture && zoom.frameStyle && (
            <div
              className={`studio-chat-sketch__frame${zoom.eased ? ' is-eased' : ''}${zoom.crisp ? ' is-crisp' : ''}`}
              style={zoom.frameStyle}
            >
              <canvas
                ref={canvas}
                width={picture.width}
                height={picture.height}
                className={`is-${tool}`}
                aria-label={t('studioChat.sketch.canvas')}
                onPointerDown={press}
                onPointerMove={drag}
                onPointerUp={release}
                onPointerCancel={release}
                onLostPointerCapture={zoom.handlers.onLostPointerCapture}
                onClick={startWord}
              />
              {tool === 'crop' && (
                <StudioChatCropBox
                  crop={crop}
                  width={picture.width}
                  height={picture.height}
                />
              )}
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
