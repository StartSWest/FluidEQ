/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  clampedCaptionCentre,
  type ISize,
  type ISubtitlePosition,
  positionFromPoint,
  SUBTITLE_INK,
  SUBTITLE_SIZE_SCALE,
} from '../../../common/library/subtitleStyle';
import type { ISubtitleCue } from '../../../common/library/subtitleCues';
import type { ILibraryTrack } from '../../../common/library/types';
import { useTranslation } from '../../utils/I18nContext';
import { useSubtitleChoice } from '../subtitleChoice';
import {
  setCaptionsMoving,
  updateSubtitleStyle,
  useCaptionsMoving,
  useSubtitleStyle,
} from '../subtitleStyleStore';
import { useTrackSubtitles } from '../useTrackSubtitles';
import { useActiveCues, usePictureRect } from './videoCaptionHooks';

/** The room kept between the caption box and the picture's edge: a share of
 * the picture's height, as a TV keeps captions inside its safe area, and
 * never under a few pixels in a small pane. */
const EDGE_SHARE = 0.04;
const EDGE_MIN_PX = 8;

const sameSize = (a: ISize, b: ISize) =>
  a.width === b.width && a.height === b.height;

const NO_SIZE: ISize = { width: 0, height: 0 };

const NO_CUES: readonly ISubtitleCue[] = [];

interface IDrag {
  pointerId: number;
  /** Where in the box it was held, from the box's centre. */
  offsetX: number;
  offsetY: number;
  position: ISubtitlePosition;
}

/**
 * The captions over a playing film (Ivan, 2026-11-15: "instead of showing
 * the subs there, we need to show them on top of the video, with some sub
 * colours and settings"): the cues on screen, drawn on the picture — never
 * on its letterbox — in the viewer's size, ink and background, at the place
 * they chose. With "Move captions" on, the box wears a dashed edge and is
 * dragged by the pointer (captured, so a drag that leaves the box keeps
 * going); a sample line stands in while nobody speaks, Escape gives the
 * drag back, and a press anywhere else on the film ends moving
 * (`LibraryVideoStage`'s press).
 */
const Captions = ({
  video,
  track,
  isFullScreen,
}: {
  video: HTMLVideoElement | null;
  track: ILibraryTrack;
  isFullScreen: boolean;
}) => {
  const { t, locale } = useTranslation();
  const { wanted, preferred } = useSubtitleChoice(track.id, locale);
  const read = useTrackSubtitles(track, wanted, preferred);
  const style = useSubtitleStyle();
  const isMoving = useCaptionsMoving();
  // One empty list, so "no cues" is the same value from render to render
  // and the frame callback is not torn down and set up again on each.
  const cues =
    read.state === 'ready' ? (read.answer.shown?.cues ?? NO_CUES) : undefined;
  const active = useActiveCues(video, cues ?? NO_CUES);
  const picture = usePictureRect(video, !isFullScreen);

  const roomRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState<ISize>(NO_SIZE);
  const [box, setBox] = useState<ISize>(NO_SIZE);
  const [drag, setDrag] = useState<IDrag | undefined>(undefined);
  const dragRef = useRef<IDrag | undefined>(undefined);
  dragRef.current = drag;

  // Moving ends with the film: the next one never opens waiting for a drag.
  useEffect(() => () => setCaptionsMoving(false), []);

  // The room changes with the pane, with full screen, and with the bar
  // coming and going over a full-screen film (`_nowPlayingBarStage.scss`):
  // watched from the moment its element exists to the moment it goes.
  const setRoomRef = useCallback((element: HTMLDivElement | null) => {
    roomRef.current = element;
    if (element === null) {
      return undefined;
    }
    const measure = () => {
      const next = { width: element.clientWidth, height: element.clientHeight };
      setRoom((held) => (sameSize(held, next) ? held : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const lines = active.map((cue) => cue.text);
  const shown =
    lines.length > 0 || !isMoving ? lines : [t('library.subtitles.sample')];
  const textKey = shown.join('\n');

  // The box's own size, read before the frame is painted, so a new line is
  // never drawn once where it does not fit and then moved.
  useLayoutEffect(() => {
    const element = boxRef.current;
    const next =
      element === null
        ? NO_SIZE
        : { width: element.offsetWidth, height: element.offsetHeight };
    setBox((held) => (sameSize(held, next) ? held : next));
  }, [textKey, style.size, style.background, room]);

  // Escape gives the drag back: the captions return to where they were.
  useEffect(() => {
    if (drag === undefined) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        const held = dragRef.current;
        const box = boxRef.current;
        if (held !== undefined && box?.hasPointerCapture(held.pointerId)) {
          box.releasePointerCapture(held.pointerId);
        }
        setDrag(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  const margin = Math.max(EDGE_MIN_PX, room.height * EDGE_SHARE);
  const position = drag?.position ?? style.position;
  const centre = clampedCaptionCentre(position, room, box, margin);

  const pointIn = useCallback(
    (event: PointerEvent<HTMLDivElement>, held: IDrag) => {
      const bounds = roomRef.current?.getBoundingClientRect();
      if (bounds === undefined) {
        return held.position;
      }
      return positionFromPoint(
        {
          left: event.clientX - bounds.left - held.offsetX,
          top: event.clientY - bounds.top - held.offsetY,
        },
        room,
        box,
        margin,
      );
    },
    [room, box, margin],
  );

  if (picture === undefined || cues === undefined) {
    return null;
  }
  if (!isMoving && (!style.enabled || shown.length === 0)) {
    return null;
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isMoving || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const bounds = roomRef.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left - centre.left,
      offsetY: event.clientY - bounds.top - centre.top,
      position,
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const held = dragRef.current;
    if (held === undefined || held.pointerId !== event.pointerId) {
      return;
    }
    setDrag({ ...held, position: pointIn(event, held) });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const held = dragRef.current;
    if (held === undefined || held.pointerId !== event.pointerId) {
      return;
    }
    updateSubtitleStyle({ position: pointIn(event, held) });
    setDrag(undefined);
  };

  const boxStyle = {
    left: centre.left,
    top: centre.top,
    '--caption-ink': SUBTITLE_INK[style.colour],
    '--caption-scale': SUBTITLE_SIZE_SCALE[style.size],
    '--caption-box-opacity': style.opacity,
  } as CSSProperties;

  return (
    <div
      className="library-video-stage__captions"
      style={
        {
          left: picture.left,
          top: picture.top,
          width: picture.width,
          height: picture.height,
          '--caption-below': `${picture.below}px`,
        } as CSSProperties
      }
    >
      <div ref={setRoomRef} className="library-video-stage__caption-room">
        <div
          ref={boxRef}
          className={`library-video-stage__caption is-${style.background} is-edge-${style.edge}${
            isMoving ? ' is-moving' : ''
          }${drag === undefined ? '' : ' is-dragging'}${
            room.width === 0 ? ' is-unmeasured' : ''
          }`}
          style={boxStyle}
          // Read out as it changes, as a player's captions are.
          aria-live="polite"
          role={isMoving ? 'button' : undefined}
          aria-label={isMoving ? t('library.subtitles.dragHint') : undefined}
          title={isMoving ? t('library.subtitles.dragHint') : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(undefined)}
        >
          {shown.map((line, index) => (
            // Cues keep their order while they show: the index is the cue.
            // eslint-disable-next-line react/no-array-index-key -- see above
            <p key={index} className="library-video-stage__caption-line">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

/** The captions for the film on the stage, once its library entry is known. */
const LibraryVideoCaptions = ({
  video,
  track,
  isFullScreen,
}: {
  video: HTMLVideoElement | null;
  track: ILibraryTrack | undefined;
  isFullScreen: boolean;
}) =>
  track === undefined ? null : (
    <Captions
      key={track.id}
      video={video}
      track={track}
      isFullScreen={isFullScreen}
    />
  );

export default LibraryVideoCaptions;
