/* FluidEQ Karaoke Maker live-stage preview. GPL-3.0-or-later. */

import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { IKaraokeSong } from '../../common/karaoke/types';
import KaraokeLyrics from './KaraokeLyrics';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

interface IKaraokeMakerPreviewProps {
  song: IKaraokeSong;
  playheadMs: number;
  textSize: number;
  height: number;
  open: boolean;
  followRequestKey: number;
  title: string;
  showLabel: string;
  hideLabel: string;
  resizeLabel: string;
  textSizeLabel: string;
  onTextSize: (textSize: number) => void;
  onHeight: (height: number) => void;
  onSeek: (timeMs: number) => void;
  onToggle: () => void;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

type TKaraokePreviewStyle = CSSProperties & {
  '--karaoke-maker-preview-height': string;
};

const KaraokeMakerPreviewNotes = ({
  song,
  playheadMs,
}: {
  song: IKaraokeSong;
  playheadMs: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(3, 17, 28, .68)';
    context.beginPath();
    context.roundRect(0.5, 0.5, width - 1, height - 1, height / 2);
    context.fill();
    context.strokeStyle = 'rgba(102, 184, 202, .14)';
    context.stroke();

    const windowMs = 8_000;
    const windowStartMs = playheadMs - windowMs / 2;
    const notes = song.pitch.kind === 'notes' ? song.pitch.notes : [];
    const rainbow = document.documentElement.classList.contains('is-euphoric');
    notes.forEach((note, index) => {
      if (
        note.startMs === undefined ||
        note.endMs === undefined ||
        note.endMs < windowStartMs ||
        note.startMs > windowStartMs + windowMs
      ) {
        return;
      }
      const left = clamp(
        ((note.startMs - windowStartMs) / windowMs) * width,
        0,
        width,
      );
      const right = clamp(
        ((note.endMs - windowStartMs) / windowMs) * width,
        0,
        width,
      );
      let noteFill =
        note.kind === 'golden'
          ? 'rgba(255, 209, 84, .9)'
          : 'rgba(61, 225, 217, .82)';
      if (rainbow) {
        noteFill = `hsl(${(performance.now() / 10 + index * 17) % 360}, 94%, 67%)`;
      }
      context.fillStyle = noteFill;
      context.shadowColor = rainbow
        ? context.fillStyle
        : 'rgba(47, 227, 214, .28)';
      context.shadowBlur = 5;
      context.beginPath();
      context.roundRect(left, height / 2 - 2, Math.max(2, right - left), 4, 2);
      context.fill();
    });
    context.shadowBlur = 0;
    context.fillStyle = '#fe53ba';
    context.shadowColor = 'rgba(254, 83, 186, .72)';
    context.shadowBlur = 7;
    context.fillRect(width / 2 - 0.75, 1, 1.5, height - 2);
  }, [playheadMs, song.pitch]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="karaoke-maker-preview__notes"
      aria-hidden="true"
    />
  );
};

/**
 * The Maker deliberately uses the production lyric renderer here instead of
 * maintaining a visually similar preview. Typography, timing fills, motion,
 * readability treatment and Rainbow mode therefore remain exactly in sync
 * with the Karaoke stage.
 */
const KaraokeMakerPreview = ({
  song,
  playheadMs,
  textSize,
  height,
  open,
  followRequestKey,
  title,
  showLabel,
  hideLabel,
  resizeLabel,
  textSizeLabel,
  onTextSize,
  onHeight,
  onSeek,
  onToggle,
}: IKaraokeMakerPreviewProps) => {
  const resizeRef = useRef<
    { pointerId: number; startY: number; height: number } | undefined
  >(undefined);
  const resizePreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    onHeight(clamp(drag.height + drag.startY - event.clientY, 96, 420));
  };
  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) {
      return;
    }
    resizeRef.current = undefined;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const style: TKaraokePreviewStyle = {
    '--karaoke-maker-preview-height': `${height}px`,
  };

  return (
    <section
      className={`karaoke-maker-preview${open ? ' is-open' : ''}`}
      style={style}
    >
      {open && (
        /* eslint-disable jsx-a11y/no-noninteractive-element-interactions,
            jsx-a11y/no-noninteractive-tabindex */
        <div
          className="karaoke-maker-preview__splitter"
          role="separator"
          aria-label={resizeLabel}
          aria-orientation="horizontal"
          aria-valuemin={96}
          aria-valuemax={420}
          aria-valuenow={Math.round(height)}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            event.preventDefault();
            resizeRef.current = {
              pointerId: event.pointerId,
              startY: event.clientY,
              height,
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={resizePreview}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
              return;
            }
            event.preventDefault();
            onHeight(
              clamp(height + (event.key === 'ArrowUp' ? 12 : -12), 96, 420),
            );
          }}
        >
          <span aria-hidden="true" />
        </div>
        /* eslint-enable jsx-a11y/no-noninteractive-element-interactions,
            jsx-a11y/no-noninteractive-tabindex */
      )}
      <header>
        <div>
          <KaraokeMakerToolIcon name="preview" />
          <span>{title}</span>
        </div>
        <div className="karaoke-maker-preview__actions">
          {open && (
            <label
              className="karaoke-maker-preview__zoom"
              htmlFor="karaoke-maker-preview-text-size"
            >
              <span aria-hidden="true">A</span>
              <input
                id="karaoke-maker-preview-text-size"
                type="range"
                min="75"
                max="200"
                step="5"
                value={textSize}
                aria-label={textSizeLabel}
                aria-valuetext={`${textSize}%`}
                title={`${textSizeLabel} · ${textSize}%`}
                onChange={(event) => onTextSize(Number(event.target.value))}
              />
              <strong>{textSize}%</strong>
            </label>
          )}
          <button
            className="karaoke-maker-preview__toggle"
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? hideLabel : showLabel}
            data-tooltip={open ? hideLabel : showLabel}
          >
            <KaraokeMakerToolIcon name={open ? 'previewHide' : 'preview'} />
            <span>{open ? hideLabel : showLabel}</span>
          </button>
        </div>
      </header>
      {open && (
        <div className="karaoke-maker-preview__stage">
          <div className="karaoke-maker-preview__meta">
            {song.artist && <span>{song.artist}</span>}
            <strong>{song.title}</strong>
          </div>
          <KaraokeLyrics
            song={song}
            playheadMs={playheadMs}
            onSeek={onSeek}
            followRequestKey={followRequestKey}
            showFollowButton={false}
            textSize={textSize}
          />
          <KaraokeMakerPreviewNotes song={song} playheadMs={playheadMs} />
        </div>
      )}
    </section>
  );
};

export default KaraokeMakerPreview;
