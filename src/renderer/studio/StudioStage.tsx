import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import type { IScenePack } from 'common/scenePacks';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import { createFlashGuard } from '../graph/sceneFlashGuard';
import type { ISceneFrame } from '../graph/sceneGl';
import { createWarmupLadder } from '../graph/sceneWarmup';
import useSceneRunner, { type ISceneSource } from '../graph/useSceneRunner';
import { useTranslation } from '../utils/I18nContext';
import {
  createStudioSignalBuffers,
  shapeStudioFrame,
  type TStudioSignal,
} from './studioSignals';

export type TStudioSize = 'graph' | 'narrow' | 'wide' | 'full';

export type TStageTrouble =
  | { kind: 'compile'; log: string }
  | { kind: 'heavy' }
  | { kind: 'unavailable' };

export type TStageDrawn = (
  frame: ISceneFrame,
  scale: number,
  musicAccent: number,
) => void;

/**
 * Handed the stage's canvas right after the next frame is drawn, once. A WebGL
 * canvas is only readable in that moment, before the frame is composited, so
 * a still is taken from inside the frame rather than whenever it is asked.
 */
export type TStillTaker = (canvas: HTMLCanvasElement) => void;

interface IStudioStageProps {
  /** The folder being worked on: a new one starts the scene from the top. */
  identity: string;
  pack: IScenePack;
  /** Changes with every version that became a pack. */
  serial: number;
  signal: TStudioSignal;
  size: TStudioSize;
  onTrouble: (trouble: TStageTrouble) => void;
  onDrawn: TStageDrawn;
  onExitFullscreen: () => void;
  /** Set to ask for a still of the next frame; cleared once it is taken. */
  stillRef?: MutableRefObject<TStillTaker | undefined>;
}

/**
 * The Studio's live stage: the member's scene, on their music, through the
 * same runner the graph uses — the warm-up ladder and the brightness limiter
 * included, because this is where a scene nobody has watched is watched first.
 *
 * It holds the live capture open while it is on screen, as the graph does:
 * the Community tab is a whole view of its own, and a stage that listened to
 * nothing would show the silence test whatever was playing.
 */
export default function StudioStage({
  identity,
  pack,
  serial,
  signal,
  size,
  onTrouble,
  onDrawn,
  onExitFullscreen,
  stillRef,
}: IStudioStageProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLiveAudioCapture(true);

  // The canvas takes the frame's measured size; the frame's shape comes from
  // the chosen size in CSS, so the layout — not this — decides what fits.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      const { width, height } = frame.getBoundingClientRect();
      setBox((previous) =>
        Math.round(previous.width) === Math.round(width) &&
        Math.round(previous.height) === Math.round(height)
          ? previous
          : { width, height },
      );
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Fullscreen is the real thing, not a bigger box: a scene that holds at
  // 1080p and falls apart at 4K is the commonest defect there is.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    if (size === 'full' && document.fullscreenElement !== frame) {
      frame.requestFullscreen().catch(() => onExitFullscreen());
    }
    if (size !== 'full' && document.fullscreenElement === frame) {
      document.exitFullscreen().catch(() => undefined);
    }
    const onChange = () => {
      if (size === 'full' && document.fullscreenElement !== frame) {
        onExitFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [size, onExitFullscreen]);

  const packRef = useRef(pack);
  packRef.current = pack;
  const troubleRef = useRef(onTrouble);
  troubleRef.current = onTrouble;

  const source = useMemo<ISceneSource>(
    () => ({
      identity,
      version: String(serial),
      name: packRef.current.names.en,
      load: () => Promise.resolve(packRef.current),
      block: () => troubleRef.current({ kind: 'unavailable' }),
      reportFailure: (reason, log) =>
        troubleRef.current(
          reason === 'compile'
            ? { kind: 'compile', log: log ?? '' }
            : { kind: 'unavailable' },
        ),
      tooSlow: () => troubleRef.current({ kind: 'heavy' }),
      createLadder: createWarmupLadder,
      createGuard: createFlashGuard,
    }),
    [identity, serial],
  );

  const buffers = useMemo(createStudioSignalBuffers, []);
  const signalRef = useRef(signal);
  signalRef.current = signal;
  const shapeFrame = useMemo(
    () => (frame: ISceneFrame) =>
      shapeStudioFrame(frame, signalRef.current, buffers),
    [buffers],
  );

  // The runner's canvas, kept where the frame callback below can reach it:
  // the callback has to exist before the runner that hands the canvas back.
  const canvasHolder = useRef<RefObject<HTMLCanvasElement | null> | null>(null);
  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  const onFrame = useCallback<TStageDrawn>(
    (frame, drawnScale, accent) => {
      drawnRef.current(frame, drawnScale, accent);
      const take = stillRef?.current;
      const canvas = canvasHolder.current?.current;
      if (take && canvas && stillRef) {
        stillRef.current = undefined;
        take(canvas);
      }
    },
    [stillRef],
  );

  const canvasRef = useSceneRunner({
    source,
    width: box.width,
    height: box.height,
    spectrumRect: [0, 1, 0, 1],
    shapeFrame,
    onDrawn: onFrame,
  });
  canvasHolder.current = canvasRef;

  return (
    <div className="studio-stage__well">
      <div
        ref={frameRef}
        className={`studio-stage studio-stage--${size}`}
        data-testid="studio-stage"
      >
        <canvas
          ref={canvasRef}
          className="studio-stage__canvas"
          aria-label={t('studio.stage.label', { name: pack.names.en })}
          style={{ width: box.width, height: box.height }}
        />
        {size === 'full' && (
          <button
            type="button"
            className="button small subtle studio-stage__exit"
            onClick={onExitFullscreen}
          >
            {t('studio.size.exit')}
          </button>
        )}
      </div>
    </div>
  );
}
