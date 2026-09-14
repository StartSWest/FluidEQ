import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { IScenePack } from 'common/scenePacks';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import { createFlashGuard } from '../graph/sceneFlashGuard';
import type { ISceneFrame } from '../graph/sceneGl';
import { createWarmupLadder } from '../graph/sceneWarmup';
import useSceneRunner, {
  type ISceneSource,
  type ISceneTuning,
} from '../graph/useSceneRunner';
import { useTranslation } from '../utils/I18nContext';
import StudioGraphPaper from './StudioGraphPaper';
import { reportSceneBeat, reportSceneLeft } from '../utils/scenePulse';
import StudioStageLoading from './StudioStageLoading';
import { studioPaper } from './studioPaper';
import { studioSpectrumRect, type IStudioWave } from './studioWave';
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
  /** What the scene heard before its response bent it. */
  heard: ISceneFrame,
) => void;

interface IStudioStageProps {
  /** The folder being worked on: a new one starts the scene from the top. */
  identity: string;
  pack: IScenePack;
  /** Changes with every version that became a pack. */
  serial: number;
  signal: TStudioSignal;
  size: TStudioSize;
  /** The graph's wave height and position, tried on the scene. */
  wave: IStudioWave;
  /**
   * The graph's grid over the scene. The band the spectrum is drawn in moves
   * into the grid's gutters with it, as it does on the graph.
   */
  isGridShown: boolean;
  /** The member's settings, live, over the pack's. */
  tuning?: ISceneTuning;
  onTrouble: (trouble: TStageTrouble) => void;
  onDrawn: TStageDrawn;
  onExitFullscreen: () => void;
  /** Double-clicking the stage: full screen, or back from it. */
  onToggleFullscreen: () => void;
}

/**
 * The Studio's live stage: the member's scene, on their music, through the
 * same runner the graph uses — the warm-up ladder and the brightness limiter
 * included, because this is where a scene nobody has watched is watched first.
 *
 * It holds the live capture open while it is on screen, as the graph does:
 * the Plus tab is a whole view of its own, and a stage that listened to
 * nothing would show the silence test whatever was playing.
 */
export default function StudioStage({
  identity,
  pack,
  serial,
  signal,
  size,
  wave,
  isGridShown,
  tuning,
  onTrouble,
  onDrawn,
  onExitFullscreen,
  onToggleFullscreen,
}: IStudioStageProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  // Answered by the runner, which alone knows when the picture went: a first
  // frame seen once said "settled" for good, so a stage built again after the
  // window had been covered sat black, with no loading, for its whole compile.
  const [waiting, setWaiting] = useState(true);
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

  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  // The element the scene draws in, once the runner has made it: where the
  // window's pulse starts from.
  const hostRef = useRef<RefObject<Element | null>>(undefined);
  const onFrame = useCallback<TStageDrawn>(
    (frame, drawnScale, accent, heard) => {
      // The window beats on the beats this stage is drawing, when the
      // Studio's mode asks it to (`ScenePulse.tsx`).
      reportSceneBeat('studio', frame, hostRef.current?.current);
      drawnRef.current(frame, drawnScale, accent, heard);
    },
    [],
  );
  // The window's light goes with the stage: the Studio closing, another
  // project taking the bench, the stage stood down for a publish.
  useEffect(() => () => reportSceneLeft('studio'), []);

  const { spectrumRange } = pack;
  const paper = useMemo(
    () =>
      isGridShown
        ? studioPaper(box.width, box.height, { spectrumRange }, wave)
        : undefined,
    [isGridShown, box.width, box.height, spectrumRange, wave],
  );
  // One array per band, not per render: the runner redraws whenever the band
  // it is handed changes identity.
  const gridless = useMemo(
    () => studioSpectrumRect({ spectrumRange }, wave),
    [spectrumRange, wave],
  );

  const sceneRef = useSceneRunner({
    source,
    width: box.width,
    height: box.height,
    spectrumRect: paper?.spectrumRect ?? gridless,
    shapeFrame,
    ...(tuning ? { tuning } : {}),
    onDrawn: onFrame,
    onWaiting: setWaiting,
  });
  hostRef.current = sceneRef;

  return (
    <div className="studio-stage__well">
      <div
        ref={frameRef}
        className={`studio-stage studio-stage--${size}`}
        data-testid="studio-stage"
        aria-busy={waiting}
        // The graph's gesture for the same thing, and the same full screen as
        // the size choice beside the stage. Not on the exit button, whose
        // first click has already brought the stage back.
        onDoubleClick={({ target }) => {
          if (!(target instanceof Element && target.closest('button'))) {
            onToggleFullscreen();
          }
        }}
      >
        <div
          ref={sceneRef}
          className="studio-stage__canvas"
          role="img"
          aria-label={t('studio.stage.label', { name: pack.names.en })}
          style={{ width: box.width, height: box.height }}
        />
        {paper && box.width > 0 && <StudioGraphPaper paper={paper} />}
        {waiting && <StudioStageLoading name={pack.names.en} />}
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
