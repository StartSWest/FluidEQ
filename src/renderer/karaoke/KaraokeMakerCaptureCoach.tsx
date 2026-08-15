/* FluidEQ Karaoke Maker movable line-capture coach. GPL-3.0-or-later. */

import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import { KaraokeTransportIcon } from './KaraokeTransport';

export interface IKaraokeMakerCaptureSetup {
  eyebrow: string;
  title: string;
  description: string;
  currentLine: string;
  startLabel: string;
}

export interface IKaraokeMakerCaptureGuide {
  title: string;
  instruction: string;
  currentLine: string;
  nextLine?: string;
  nextLabel: string;
  phase: 'start' | 'end';
  startLabel: string;
  endLabel: string;
}

export interface IKaraokeMakerCaptureCountdown {
  cue: string;
  label: string;
}

export interface IKaraokeMakerCaptureHelp {
  audioLabel: string;
  lyricLabel: string;
  playbackLabel: string;
  wordLabel: string;
  undoLabel: string;
}

export interface IKaraokeMakerCaptureActions {
  isPlaying: boolean;
  playLabel: string;
  pauseLabel: string;
  markLabel: string;
  markWordLabel: string;
  undoLabel: string;
  ignoreLabel: string;
  stopLabel: string;
  cancelLabel: string;
  canUndo: boolean;
  canMarkWord: boolean;
  onTogglePlayback: () => void;
  onMark: () => void;
  onMarkWord: () => void;
  onUndo: () => void;
  onIgnore: () => void;
  onStop: () => void;
  onCancel: () => void;
}

interface IKaraokeMakerCaptureCoachProps {
  actions?: IKaraokeMakerCaptureActions;
  anchorRef?: RefObject<HTMLElement | null>;
  setup?: IKaraokeMakerCaptureSetup;
  guide?: IKaraokeMakerCaptureGuide;
  countdown?: IKaraokeMakerCaptureCountdown;
  help?: IKaraokeMakerCaptureHelp;
  moveLabel: string;
  onStart?: () => void;
}

interface ICaptureCoachDrag {
  pointerId: number;
  startX: number;
  startY: number;
  positionX: number;
  positionY: number;
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const KaraokeMakerCaptureCoach = ({
  actions,
  anchorRef,
  setup,
  guide,
  countdown,
  help,
  moveLabel,
  onStart,
}: IKaraokeMakerCaptureCoachProps) => {
  const rootRef = useRef<HTMLElement>(null);
  const dragRef = useRef<ICaptureCoachDrag | undefined>(undefined);
  const wasVisibleRef = useRef(false);
  const [position, setPosition] = useState<
    { x: number; y: number } | undefined
  >(undefined);
  const visible = Boolean(setup || guide || countdown);

  const constrainPosition = useCallback(
    (candidate: { x: number; y: number }) => {
      const card = rootRef.current?.getBoundingClientRect();
      const host = rootRef.current?.parentElement?.getBoundingClientRect();
      if (!card || !host) {
        return candidate;
      }
      const inset = 10;
      const halfWidth = card.width / 2;
      const halfHeight = card.height / 2;
      const minimumX = halfWidth + inset;
      const minimumY = halfHeight + inset;
      return {
        x: clamp(
          candidate.x,
          minimumX,
          Math.max(minimumX, host.width - halfWidth - inset),
        ),
        y: clamp(
          candidate.y,
          minimumY,
          Math.max(minimumY, host.height - halfHeight - inset),
        ),
      };
    },
    [],
  );

  const resetPosition = useCallback(() => {
    const card = rootRef.current?.getBoundingClientRect();
    const host = rootRef.current?.parentElement?.getBoundingClientRect();
    if (!card || !host) {
      return;
    }
    const anchor = anchorRef?.current?.getBoundingClientRect();
    const initialPosition = {
      x: host.width / 2,
      y: anchor ? anchor.bottom - host.top : host.height / 2,
    };
    setPosition(constrainPosition(initialPosition));
  }, [anchorRef, constrainPosition]);

  useLayoutEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (!wasVisibleRef.current) {
      resetPosition();
    }
    wasVisibleRef.current = true;
  }, [resetPosition, visible]);

  useLayoutEffect(() => {
    if (!visible) {
      return undefined;
    }
    const keepInsideWindow = () => {
      setPosition((current) =>
        current ? constrainPosition(current) : current,
      );
    };
    window.addEventListener('resize', keepInsideWindow);
    const host = rootRef.current?.parentElement;
    const resizeObserver =
      host && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(keepInsideWindow)
        : undefined;
    if (host && resizeObserver) {
      resizeObserver.observe(host);
    }
    return () => {
      window.removeEventListener('resize', keepInsideWindow);
      resizeObserver?.disconnect();
    };
  }, [constrainPosition, visible]);

  if (!visible) {
    return null;
  }

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !rootRef.current?.parentElement) {
      return;
    }
    event.preventDefault();
    const card = rootRef.current.getBoundingClientRect();
    const host = rootRef.current.parentElement.getBoundingClientRect();
    const inset = 10;
    const positionX = position?.x ?? card.left - host.left + card.width / 2;
    const positionY = position?.y ?? card.top - host.top + card.height / 2;
    const minimumX = card.width / 2 + inset;
    const minimumY = card.height / 2 + inset;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      positionX,
      positionY,
      minimumX,
      maximumX: Math.max(minimumX, host.width - card.width / 2 - inset),
      minimumY,
      maximumY: Math.max(minimumY, host.height - card.height / 2 - inset),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setPosition({
      x: clamp(
        drag.positionX + event.clientX - drag.startX,
        drag.minimumX,
        drag.maximumX,
      ),
      y: clamp(
        drag.positionY + event.clientY - drag.startY,
        drag.minimumY,
        drag.maximumY,
      ),
    });
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = undefined;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const style: CSSProperties = {
    left: position?.x,
    top: position?.y,
    transform: 'translate(-50%, -50%)',
    visibility: position ? 'visible' : 'hidden',
  };
  return (
    <aside
      ref={rootRef}
      className={`karaoke-maker__capture-coach${
        countdown ? ' is-countdown' : ''
      }${guide ? ` is-${guide.phase}` : ' is-setup'}`}
      style={style}
      aria-live={countdown ? 'assertive' : 'polite'}
    >
      <button
        type="button"
        className="karaoke-maker__capture-drag"
        aria-label={moveLabel}
        data-tooltip={moveLabel}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onDoubleClick={resetPosition}
        onKeyDown={(event) => {
          if (event.key === 'Home') {
            event.preventDefault();
            resetPosition();
            return;
          }
          const movement: Record<string, { x: number; y: number }> = {
            ArrowLeft: { x: -12, y: 0 },
            ArrowRight: { x: 12, y: 0 },
            ArrowUp: { x: 0, y: -12 },
            ArrowDown: { x: 0, y: 12 },
          };
          const delta = movement[event.key];
          if (delta) {
            event.preventDefault();
            setPosition((current) =>
              constrainPosition({
                x: (current?.x ?? 0) + delta.x,
                y: (current?.y ?? 0) + delta.y,
              }),
            );
          }
        }}
      >
        <span />
        <span />
        <span />
      </button>

      {!countdown && actions && (
        <button
          type="button"
          className="karaoke-maker__capture-coach-close"
          aria-label={actions.cancelLabel}
          data-tooltip={actions.cancelLabel}
          onClick={actions.onCancel}
        >
          <KaraokeMakerToolIcon name="close" />
        </button>
      )}

      {countdown ? (
        <div
          key={countdown.cue}
          className="karaoke-maker__capture-coach-countdown"
        >
          <strong>{countdown.cue}</strong>
          <span>{countdown.label}</span>
        </div>
      ) : (
        <>
          <div className="karaoke-maker__capture-coach-icon" aria-hidden="true">
            <KaraokeMakerToolIcon name="align" />
          </div>
          <div className="karaoke-maker__capture-coach-copy">
            <span>{setup?.eyebrow ?? guide?.title}</span>
            <strong>{setup?.title ?? guide?.instruction}</strong>
            {setup?.description && <p>{setup.description}</p>}
            <em>{setup?.currentLine ?? guide?.currentLine}</em>
            {guide?.nextLine && (
              <small>
                {guide.nextLabel}: {guide.nextLine}
              </small>
            )}
          </div>

          {guide ? (
            <div className="karaoke-maker__capture-coach-action">
              <div
                className="karaoke-maker__capture-coach-steps"
                aria-hidden="true"
              >
                <span
                  className={
                    guide.phase === 'start' ? 'is-active' : 'is-complete'
                  }
                >
                  1 · {guide.startLabel}
                </span>
                <i>→</i>
                <span className={guide.phase === 'end' ? 'is-active' : ''}>
                  2 · {guide.endLabel}
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="karaoke-maker__capture-coach-start"
              aria-label={setup?.startLabel}
              aria-keyshortcuts="Enter"
              onClick={onStart}
            >
              <KaraokeTransportIcon name="play" />
              <span>{setup?.startLabel}</span>
              <kbd>Enter</kbd>
            </button>
          )}

          {help && (
            <div
              className="karaoke-maker__capture-coach-help"
              aria-label={setup?.description ?? guide?.instruction}
            >
              <div>
                <KaraokeMakerToolIcon name="timing" />
                <span className="karaoke-maker__capture-coach-keys">
                  <kbd>←</kbd>
                  <kbd>→</kbd>
                </span>
                <small>{help.audioLabel}</small>
              </div>
              <div>
                <KaraokeMakerToolIcon name="lyrics" />
                <span className="karaoke-maker__capture-coach-keys">
                  <kbd>↑</kbd>
                  <kbd>↓</kbd>
                </span>
                <small>{help.lyricLabel}</small>
              </div>
              <div>
                <KaraokeTransportIcon name="play" />
                <kbd>Space</kbd>
                <small>{help.playbackLabel}</small>
              </div>
              <div>
                <KaraokeMakerToolIcon name="lyrics" />
                <kbd>Tab</kbd>
                <small>{help.wordLabel}</small>
              </div>
              <div>
                <KaraokeMakerToolIcon name="undo" />
                <kbd>⌫</kbd>
                <small>{help.undoLabel}</small>
              </div>
            </div>
          )}

          {guide && actions && (
            <div className="karaoke-maker__capture-coach-controls">
              <button type="button" onClick={actions.onTogglePlayback}>
                <KaraokeTransportIcon
                  name={actions.isPlaying ? 'pause' : 'play'}
                />
                <span>
                  {actions.isPlaying ? actions.pauseLabel : actions.playLabel}
                </span>
                <kbd>Space</kbd>
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={actions.onMark}
              >
                <KaraokeMakerToolIcon name="timing" />
                <span>{actions.markLabel}</span>
                <kbd>Enter</kbd>
              </button>
              {actions.canMarkWord && (
                <button type="button" onClick={actions.onMarkWord}>
                  <KaraokeMakerToolIcon name="lyrics" />
                  <span>{actions.markWordLabel}</span>
                  <kbd>Tab</kbd>
                </button>
              )}
              {actions.canUndo && (
                <button type="button" onClick={actions.onUndo}>
                  <KaraokeMakerToolIcon name="undo" />
                  <span>{actions.undoLabel}</span>
                </button>
              )}
              <button type="button" onClick={actions.onIgnore}>
                <KaraokeMakerToolIcon name="next" />
                <span>{actions.ignoreLabel}</span>
              </button>
              <button
                type="button"
                className="is-stop"
                onClick={actions.onStop}
              >
                <KaraokeMakerToolIcon name="close" />
                <span>{actions.stopLabel}</span>
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
};

export default KaraokeMakerCaptureCoach;
