import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IScenePack } from 'common/scenePacks';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import { useSceneAudio } from '../audio/SceneAudioContext';
import type { ISceneFrame } from '../graph/sceneGl';
import { createSceneInteraction } from '../graph/sceneInteraction';
import SceneViewReset from '../graph/SceneViewReset';
import type { ISceneDrawReport } from '../graph/sceneRunnerTypes';
import useSceneRunner, {
  type ISceneSource,
  type ISceneTuning,
} from '../graph/useSceneRunner';
import { useTranslation } from '../utils/I18nContext';
import StudioStageReading from './StudioStageReading';
import StudioGraphPaper from './StudioGraphPaper';
import { reportSceneBeat, reportSceneLeft } from '../utils/scenePulse';
import { forgetSceneDraw, reportSceneDraw } from '../utils/sceneDrawStats';
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
  /** What the frame cost, for the bench's readout. */
  report: ISceneDrawReport,
) => void;

/**
 * Every frame the moment it is made, before the GPU draws it: what the scene
 * gets, what it heard before its response bent it, and the musical accent's
 * envelope as the scene last drew it (`ISceneRunnerOptions.onHeard`).
 */
export type TStageHeard = (
  frame: ISceneFrame,
  heard: ISceneFrame,
  musicAccent: number,
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
  /**
   * How the scene is keeping up, shown in the stage's own corner as well as
   * on the card down the column: judging a scene means watching it, and the
   * reading that says whether it is keeping up was too far from the picture
   * it was about to be seen with it. Absent while nothing is playing.
   */
  cost?: TranslationKey;
  /** The size the controller has the scene at, for the corner's sentence. */
  percent?: number;
  /** Written to from the frame callback (`StudioBench.tsx`), never by React. */
  readingRef: RefObject<HTMLSpanElement | null>;
  onTrouble: (trouble: TStageTrouble) => void;
  /** What the meters show, as soon as each frame is made. */
  onHeard?: TStageHeard;
  onDrawn: TStageDrawn;
  onExitFullscreen: () => void;
  /** Double-clicking the stage: full screen, or back from it. */
  onToggleFullscreen: () => void;
}

/**
 * The Studio's live stage: the member's scene, on their music, through the
 * same runner the graph and the desktop use, run by the same rules as the
 * listener's own scene is everywhere else (`sceneRules.ts`) — so what the
 * author sees here is what the graph, the desktop and the Library's player
 * will show.
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
  cost,
  percent,
  readingRef,
  onTrouble,
  onHeard,
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
  //
  // Whether the screen is actually full is kept as its own state, read from
  // the browser rather than assumed from the size. The two can part: leaving
  // is a promise that can be refused — mid-transition, or by the window
  // manager — and the refusal was swallowed, which left the screen full with
  // the size back to windowed and the only way out unrendered. That is Ivan's
  // "exit button can't click it sometimes": the button was not there to
  // click, and nothing but Escape was left.
  const [isFullscreen, setIsFullscreen] = useState(
    () =>
      typeof document !== 'undefined' && document.fullscreenElement !== null,
  );
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    setIsFullscreen(document.fullscreenElement === frame);
    if (size === 'full' && document.fullscreenElement !== frame) {
      frame.requestFullscreen().catch(() => onExitFullscreen());
    }
    if (size !== 'full' && document.fullscreenElement === frame) {
      document.exitFullscreen().catch(() => undefined);
    }
    const onChange = () => {
      const full = document.fullscreenElement === frame;
      setIsFullscreen(full);
      if (size === 'full' && !full) {
        onExitFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [size, onExitFullscreen]);

  /**
   * The way out, from either side: the size goes back to what it was, and
   * the screen is asked to leave fullscreen even when the size already says
   * windowed — which is the state the two can be left in, and where a button
   * that only set the size would do nothing at all.
   */
  const leaveFullscreen = useCallback(() => {
    onExitFullscreen();
    if (document.fullscreenElement === frameRef.current) {
      document.exitFullscreen().catch(() => undefined);
    }
  }, [onExitFullscreen]);

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
      // The author is at the machine looking at their own work, which is the
      // watching the brightness limiter exists for (`sceneRules.ts`).
      madeBy: 'listener',
    }),
    [identity, serial],
  );

  const buffers = useMemo(createStudioSignalBuffers, []);
  const signalRef = useRef(signal);
  signalRef.current = signal;
  // The window's sound, which Bass, Mids and Treble hear their part of: read
  // inside the frame, after the runner's own read, so both hear one moment.
  const { readFrame } = useSceneAudio();
  const readFrameRef = useRef(readFrame);
  readFrameRef.current = readFrame;
  const shapeFrame = useMemo(
    () => (frame: ISceneFrame) =>
      shapeStudioFrame(frame, signalRef.current, buffers, {
        sound: readFrameRef.current()?.sound,
      }),
    [buffers],
  );

  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  // The element the scene draws in, once the runner has made it: where the
  // window's pulse starts from.
  const hostRef = useRef<RefObject<Element | null>>(undefined);
  const nameRef = useRef(pack.names.en);
  nameRef.current = pack.names.en;
  const onFrame = useCallback<TStageDrawn>(
    (frame, drawnScale, accent, heard, report) => {
      // The window beats on the beats this stage is drawing, when the
      // Studio's mode asks it to (`ScenePulse.tsx`).
      reportSceneBeat('studio', frame, hostRef.current?.current);
      // And the Processes dialog says what it is costing.
      reportSceneDraw('studio', nameRef.current, report);
      drawnRef.current(frame, drawnScale, accent, heard, report);
    },
    [],
  );
  // The window's light goes with the stage: the Studio closing, another
  // project taking the bench, the stage stood down for a publish.
  useEffect(
    () => () => {
      reportSceneLeft('studio');
      forgetSceneDraw('studio');
    },
    [],
  );

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

  // The viewer's hands, as a listener's would be on the graph: the author
  // turns the scene to see it from every angle it allows, and taps it.
  const interaction = useMemo(createSceneInteraction, []);

  const sceneRef = useSceneRunner({
    source,
    width: box.width,
    height: box.height,
    spectrumRect: paper?.spectrumRect ?? gridless,
    shapeFrame,
    ...(tuning ? { tuning } : {}),
    onHeard,
    onDrawn: onFrame,
    onWaiting: setWaiting,
    interaction,
  });
  hostRef.current = sceneRef;

  // Every drag on the stage is the scene's: nothing else on it drags, and
  // its one other gesture, the double click, is two taps the scene hears.
  useEffect(() => {
    const frame = frameRef.current;
    const host = sceneRef.current;
    if (!frame || !host) {
      return undefined;
    }
    return interaction.attach(frame, {
      frame: () => host.getBoundingClientRect(),
      turns: () => true,
      grabs: () => true,
    });
  }, [interaction, sceneRef]);

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
        {/* In the corner of the picture it is about, on exactly the terms the
            card down the column shows it on. NOT also gated on the stage
            having settled: frames arrive — and the card reports them — while
            the runner still says it is waiting, so a corner that waited for
            that stayed empty over a scene that was plainly playing. The
            loading card covers this while there is really nothing yet. */}
        {cost && (
          <StudioStageReading
            cost={cost}
            percent={percent ?? 100}
            readingRef={readingRef}
          />
        )}
        <SceneViewReset
          interaction={interaction}
          className="studio-stage__reset"
          // With the grid over the scene, inside its ruled plot: the scales'
          // labels run along the bottom and the right edge of the stage.
          style={
            paper
              ? {
                  right: paper.margins.right + paper.padding.right + 8,
                  bottom: paper.margins.bottom + paper.padding.bottom + 8,
                }
              : undefined
          }
        />
        {waiting && <StudioStageLoading name={pack.names.en} />}
        {/* On screen whenever the screen is full, whichever of the two
            believes it: a way out that depends on the app's own idea of the
            size is a way out that can go missing. */}
        {(size === 'full' || isFullscreen) && (
          <button
            type="button"
            className="button small subtle studio-stage__exit"
            onClick={leaveFullscreen}
          >
            {t('studio.size.exit')}
          </button>
        )}
      </div>
    </div>
  );
}
