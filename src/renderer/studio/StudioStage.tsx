import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IScenePack } from 'common/scenePacks';
import type { TWallpaperMotion } from 'common/wallpaper';
import type { IWorldReport } from 'common/worldNotes';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import { useSceneAudio } from '../audio/SceneAudioContext';
import type { ISceneFrame } from '../graph/sceneGl';
import { createSceneInteraction } from '../graph/sceneInteraction';
import ScenePointerLayer from '../graph/ScenePointerLayer';
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
import StudioStageMotion from './StudioStageMotion';
import { useStageCalm } from './stageMotion';
import { studioPaper } from './studioPaper';
import { studioSpectrumRect, type IStudioWave } from './studioWave';
import {
  createStudioSignalBuffers,
  shapeStudioFrame,
  type TStudioSignal,
} from './studioSignals';
import {
  PLAYER_PANEL_VIEW,
  stageScreen,
  type TStagePreview,
} from './studioStageScreen';
import captureVisibleStage from './stageVisibleCapture';
import StudioStagePlayer from './StudioStagePlayer';
import StudioStageZoom from './StudioStageZoom';
import useStageBox from './useStageBox';
import useStageFullscreen from './useStageFullscreen';
import useStageZoom from './useStageZoom';

export type TStudioSize = 'graph' | 'full';

export type TStageTrouble =
  | { kind: 'compile'; log: string }
  /**
   * What became of the 3D world: not built, so the stage shows its shader
   * instead, or built with parts of it left out.
   */
  | { kind: 'world'; report: IWorldReport }
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
  /** Nothing is playing and the scene moves to the demo song (`StudioStageSound`). */
  demo: boolean;
  /**
   * What the scene hears: the music, or Calm as a desktop set to it plays,
   * switched by the plate's first button (`StudioStageMotion`).
   */
  motion: TWallpaperMotion;
  onToggleMotion: () => void;
  size: TStudioSize;
  /**
   * What the scene is shown as, inside either size: the stage itself, the
   * EQ graph of an ultra-wide window, or the Compact player's column
   * (`studioStageScreen.ts`). The last two are where a scene is seen keeping
   * its important part in view (`common/sceneFraming.ts`).
   */
  preview: TStagePreview;
  /**
   * The player's own parts — its song, controls and frosted panels — laid
   * over the scene while the Compact player is shown; without them, the
   * scene alone in the player's frame.
   */
  hasPlayerParts?: boolean;
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
  /**
   * The stage's own controls (`StudioStageControls`), on the plate in its top
   * right corner beside the reading.
   */
  controls?: ReactNode;
  /** Over the picture itself: the starter's parts named (`StudioStarterLabels`). */
  labels?: ReactNode;
  /**
   * Filled with a picture of exactly what the stage shows — zoomed, moved
   * and turned as it is — for the chat's "Attach the stage"; emptied when the
   * stage goes.
   */
  captureRef?: MutableRefObject<
    (() => Promise<Uint8Array | undefined>) | undefined
  >;
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
  demo,
  motion,
  onToggleMotion,
  size,
  preview,
  hasPlayerParts = false,
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
  controls,
  labels,
  captureRef,
}: IStudioStageProps) {
  const { t } = useTranslation();
  const wellRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const { box, plate } = useStageBox(frameRef, barRef);
  const isPlayer = preview === 'player';
  // A preview stands as a window on the stage, which becomes its desk.
  const isWindowed = preview !== 'stage';
  // Answered by the runner, which alone knows when the picture went: a first
  // frame seen once said "settled" for good, so a stage built again after the
  // window had been covered sat black, with no loading, for its whole compile.
  const [waiting, setWaiting] = useState(true);
  // A new version on its way beside the picture: no cover, a word on the plate.
  const [updating, setUpdating] = useState(false);
  useLiveAudioCapture(true);

  // Real full screen, and always a way out of it (`useStageFullscreen.ts`).
  const { isFullscreen, leaveFullscreen } = useStageFullscreen(
    frameRef,
    size,
    onExitFullscreen,
  );

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
      // The last save that compiled plays on, and the author is told why the
      // newest did not: the one place where the driver's words are for
      // somebody who can act on them.
      versionFailed: (log) => troubleRef.current({ kind: 'compile', log }),
      tooSlow: () => troubleRef.current({ kind: 'heavy' }),
      reportWorld: (report) => {
        if (!report.drawn || report.notes.length > 0) {
          troubleRef.current({ kind: 'world', report });
        }
      },
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
  // While the Compact player is shown the scene is framed to the player's
  // top panel, as the player's window frames it, and runs on down the rest
  // of the column (`PLAYER_PANEL_VIEW`).
  const isPlayerRef = useRef(isPlayer);
  isPlayerRef.current = isPlayer;
  // Calm takes the place of whatever the stage hears — the music, the demo
  // song or a test signal — as it takes the music's place on a desktop.
  const calm = useStageCalm(motion);
  const shapeFrame = useMemo(
    () => (frame: ISceneFrame) => {
      const shaped = calm(
        shapeStudioFrame(frame, signalRef.current, buffers, {
          sound: readFrameRef.current()?.sound,
        }),
      );
      return isPlayerRef.current
        ? { ...shaped, view: PLAYER_PANEL_VIEW }
        : shaped;
    },
    [buffers, calm],
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

  const screen = useMemo(
    () => stageScreen(box, preview, plate),
    [box, preview, plate],
  );
  // A closer look, drawn at the size it is zoomed to (`useStageZoom.ts`).
  const zoom = useStageZoom(wellRef, screenRef, screen.width, screen.height);
  const { view } = zoom;
  const { spectrumRange } = pack;
  // The graph's grid on the stage and on the ultra-wide graph; the Compact
  // player draws none behind a scene (`PlayerHero`), so none is laid over it.
  const isPapered = isGridShown && !isPlayer;
  const paper = useMemo(
    () =>
      isPapered
        ? studioPaper(screen.width, screen.height, { spectrumRange }, wave)
        : undefined,
    [isPapered, screen.width, screen.height, spectrumRange, wave],
  );
  // The plate and the reset stand inside the grid's ruled plot when the grid
  // covers the stage; round a preview's window they stand at the stage's own
  // corners, off the window.
  const plot = isWindowed ? undefined : paper;
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
    width: screen.width * view.scale,
    height: screen.height * view.scale,
    // A pan moves the picture without resizing it: the runner measures the
    // part on screen again, or what the pan brought in is never drawn.
    moved: `${view.x},${view.y}`,
    spectrumRect: paper?.spectrumRect ?? gridless,
    shapeFrame,
    ...(tuning ? { tuning } : {}),
    onHeard,
    onDrawn: onFrame,
    onWaiting: setWaiting,
    onUpdating: setUpdating,
    interaction,
  });
  hostRef.current = sceneRef;
  // What "Attach the stage" takes: the picture as it stands on screen now.
  useEffect(() => {
    if (!captureRef) {
      return undefined;
    }
    captureRef.current = () =>
      captureVisibleStage(sceneRef.current, view, screen.width, screen.height);
    return () => {
      captureRef.current = undefined;
    };
  }, [captureRef, sceneRef, view, screen.width, screen.height]);

  // Ctrl and a drag turn the scene (`sceneInteraction.ts`); a plain double
  // click is the stage's full screen, and two taps the scene hears.
  useEffect(() => {
    const frame = frameRef.current;
    const host = sceneRef.current;
    if (!frame || !host) {
      return undefined;
    }
    return interaction.attach(frame, {
      frame: () => host.getBoundingClientRect(),
    });
  }, [interaction, sceneRef]);

  return (
    <div
      ref={wellRef}
      className={`studio-stage__well${zoom.panning ? ' is-panning' : ''}${zoom.dragging ? ' is-dragging' : ''}`}
    >
      <div
        ref={frameRef}
        className={`studio-stage studio-stage--${size}${isWindowed ? ' studio-stage--windowed' : ''}`}
        data-testid="studio-stage"
        aria-busy={waiting}
        // The graph's gesture for the same thing, and the same full screen as
        // the stage's own button. Not on the exit button, whose
        // first click has already brought the stage back.
        onDoubleClick={({ target }) => {
          if (!(target instanceof Element && target.closest('button'))) {
            onToggleFullscreen();
          }
        }}
      >
        <div
          ref={screenRef}
          className={`studio-stage__screen${isWindowed ? ' studio-stage__screen--window' : ''}${zoom.zoomed ? ' is-zoomed' : ''}`}
          style={
            isWindowed
              ? {
                  left: screen.left,
                  top: screen.top,
                  width: screen.width,
                  height: screen.height,
                }
              : undefined
          }
        >
          <div
            ref={sceneRef}
            className="studio-stage__canvas"
            role="img"
            aria-label={t('studio.stage.label', { name: pack.names.en })}
            style={{
              width: screen.width * view.scale,
              height: screen.height * view.scale,
              ...(zoom.zoomed
                ? { transform: `translate(${view.x}px, ${view.y}px)` }
                : {}),
            }}
          />
          {/* The grid and the starter's labels are drawn for the whole
              picture: on a closer look they would stand on the wrong part. */}
          {paper && screen.width > 0 && !zoom.zoomed && (
            <StudioGraphPaper paper={paper} />
          )}
          {/* What the scene throws from the hand, over it: never gated here,
              where trying the hands is the point. */}
          <ScenePointerLayer
            gestures={interaction.onGesture}
            pointer={pack.pointer}
            ambient={pack.ambient}
            artwork={pack.artwork}
          />
          {/* The player's parts over the scene when asked for, moved and
              magnified by a closer look as the scene under them is. */}
          {isPlayer && hasPlayerParts && screen.height > 0 && (
            <StudioStagePlayer
              width={screen.width * view.scale}
              height={screen.height * view.scale}
              style={
                zoom.zoomed
                  ? { transform: `translate(${view.x}px, ${view.y}px)` }
                  : undefined
              }
            />
          )}
          {/* The starter's labels name parts of the whole picture, which the
              player's panel shows only a slice of. */}
          {!zoom.zoomed && !isPlayer && labels}
        </div>
        {/* One plate in the top right corner (Ivan, 2026-09-27: "join all
            into one with runs smoothly and put it on the right top"): how the
            scene is keeping up, the sizes, the grid and, full screen, the way
            out. With the grid over the scene it stands inside the ruled plot,
            clear of the scales' labels, as the reset below does.
            The reading is NOT gated on the stage having settled: frames
            arrive — and are timed — while the runner still says it is
            waiting, so a reading that waited for that stayed empty over a
            scene that was plainly playing. The loading card covers the plate
            while there is really nothing yet. */}
        <div
          ref={barRef}
          className="studio-stage__bar"
          style={
            plot
              ? {
                  top: plot.margins.top + plot.padding.top + 8,
                  right: plot.margins.right + plot.padding.right + 8,
                }
              : undefined
          }
        >
          {/* What the scene hears — the music, the demo song unheard while
              nothing plays, or Calm — and the press that swaps them. */}
          <StudioStageMotion
            motion={motion}
            demo={demo}
            onToggle={onToggleMotion}
          />
          {/* A save's new version building beside the picture, which plays
              on meanwhile and is swapped for it the moment it is ready. */}
          {updating && (
            <span className="studio-stage__updating" role="status">
              <span
                className="studio-stage__updating-ring"
                aria-hidden="true"
              />
              {t('studio.stage.updating')}
            </span>
          )}
          {cost && (
            <StudioStageReading
              cost={cost}
              percent={percent ?? 100}
              readingRef={readingRef}
            />
          )}
          {/* The closer look shares the controls' row: as a row of its own it
              pushed full screen, the player and the grid past the bottom of a
              small stage, which shows the plate in no more than two rows. */}
          <div className="studio-stage__tools">
            <StudioStageZoom zoom={zoom} />
            {controls}
          </div>
          {/* On screen whenever the screen is full, whichever of the two
              believes it: a way out that depends on the app's own idea of the
              size is a way out that can go missing. */}
          {(size === 'full' || isFullscreen) && (
            <button
              type="button"
              className="studio-stage__exit"
              onClick={leaveFullscreen}
            >
              {t('studio.size.exit')}
            </button>
          )}
        </div>
        <SceneViewReset
          interaction={interaction}
          className="studio-stage__reset"
          // With the grid over the scene, inside its ruled plot: the scales'
          // labels run along the bottom and the right edge of the stage.
          style={
            plot
              ? {
                  right: plot.margins.right + plot.padding.right + 8,
                  bottom: plot.margins.bottom + plot.padding.bottom + 8,
                }
              : undefined
          }
        />
        {waiting && <StudioStageLoading name={pack.names.en} />}
      </div>
    </div>
  );
}
