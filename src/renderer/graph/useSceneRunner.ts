import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import type { IScenePack } from 'common/scenePacks';
import {
  SCENE_SUPERSAMPLE,
  scenePaceMs,
  scenePinnedScale,
  type IScenePerformance,
} from 'common/scenePerformance';
import { SCENE_TIME_WRAP_S } from 'common/sceneUniformContract';
import { getEaseFactor } from 'common/smoothing';
import {
  advanceEnergy,
  createEnergyState,
  holdEnergy,
  turnRun,
  type ISpectrumEnergy,
} from 'common/spectrumEnergy';
import textDigest from 'common/textDigest';
import { isOnBattery } from 'renderer/utils/batteryPower';
import observeShown from 'renderer/utils/observeShown';
import { useScenePerformance } from 'renderer/utils/scenePerformanceStore';
import useSmoothFrames from 'renderer/utils/useSmoothFrames';
import type { TSceneFailureReason } from 'common/sceneFailureLog';
import { useSceneMotionSpeed } from './sceneMotionSpeed';
import { useSceneAudio } from '../audio/SceneAudioContext';
import { createFrameCadence, judgedIntervalMs } from './frameCadence';
import { NO_POINTS, NO_WAVEFORM } from './liveSpectrumFrames';
import type { ISceneFrame } from './sceneGl';
import {
  SCENE_SLOW_FRAMES_TO_STEP,
  SCENE_SLOW_PACE_MS,
  type ICostLadder,
} from './sceneHealth';
import {
  createRestWatch,
  isSilentWaveform,
  SCENE_REST_PACE_MS,
  type IRestWatch,
} from './sceneRest';
import { musicFrameOf } from './sceneMusicFrame';
import { sceneRulesFor } from './sceneRules';
import { createDaylightFollower, pageDaylight } from './sceneDaylight';
import { createSceneTuner } from './sceneTuner';
import { sceneProgramKey } from './sceneLinkTurns';
import sameSceneProgramInputs from './sceneProgramInputs';
import { logSceneFailure } from '../utils/sceneFailureLog';
import type {
  ISceneDrawReport,
  ISceneRendererHandlers,
  ISceneRunnerOptions,
} from './sceneRunnerTypes';
import type { TSceneBuildResult } from './sceneWorkerMessages';
import { createStereoFollower } from './stereoImage';
import { noteGraphFrame } from './graphLabelInk';
import {
  createSceneWorkerClient,
  warmSceneProgram,
  type ISceneWorkerClient,
} from './sceneWorkerClient';
import {
  createSpectrumTexels,
  createWaveformTexels,
  fillSpectrumTexels,
  fillWaveformTexels,
  parseAccent,
} from './sceneUniforms';
import { blurredScale } from './sceneBlurScale';

export type { ISceneRunnerOptions, ISceneSource } from './sceneRunnerTypes';
export type { ISceneTuning } from './sceneTuner';

/**
 * The least time to leave between frames: the listener's choice — every
 * frame in euphoria, sixty on battery — unless the ladder's slow rung or a
 * rest in silence holds frames to thirty, because the machine cannot keep
 * up or nobody is listening.
 */
const paceMsOf = (
  performance: IScenePerformance,
  ladder: ICostLadder,
  rest: IRestWatch,
): number =>
  Math.max(
    document.documentElement.classList.contains('is-euphoric')
      ? 0
      : scenePaceMs(performance.frameRate, isOnBattery()),
    ladder.slowed() ? SCENE_SLOW_PACE_MS : 0,
    rest.resting() ? SCENE_REST_PACE_MS : 0,
  );

/**
 * The largest size each program (`ladderProgramRef`'s key) has held for a
 * run of frames this session, by every runner in the window. A scene built
 * again — full screen and back, a look put away and taken out, a lost
 * context restored — starts its ladder there rather than from the bottom.
 *
 * Keyed by a digest of the program, never by its text. The key used to carry
 * the whole shader source, and nothing leaves this map: every Studio save
 * that ran long enough to prove a size kept its own copy of the source — up
 * to `MAX_MEMBER_SOURCE_BYTES`, 256 KB — for the rest of the session. A
 * digest is a few bytes, so one entry per program ever proved costs nothing
 * worth evicting.
 */
const provenScales = new Map<string, number>();

/** `provenScales`'s key: the runner, and what makes two builds one program. */
const ladderProgramOf = (identity: string, pack: IScenePack): string =>
  `${identity}\n${textDigest(sceneProgramKey(pack))}`;

/** Frames a size has to be held for before it counts as proved. */
const PROVEN_FRAMES = SCENE_SLOW_FRAMES_TO_STEP;

/**
 * The GPU loop behind every scene: context, program, frame, recovery.
 *
 * Draws outside React, from refs, so nothing above re-renders at frame rate.
 * NOTHING COUNTS DOWN: recovery from a lost context hangs off the
 * `webglcontextrestored` event, frames come from animation frames, and hiding
 * the window stops the loop entirely.
 *
 * A new version of the scene being drawn is compiled BESIDE the running one
 * and swapped in only if it compiles: a Studio save with a typo in it leaves
 * the last working version on the stage instead of an empty panel.
 */
export default function useSceneRunner({
  source,
  width,
  height,
  spectrumRect,
  view,
  placement,
  moved,
  shapeFrame,
  tuning,
  daylight,
  performance: chosenPerformance,
  blurPx,
  asleep,
  held,
  captureFrames = false,
  captureSize,
  arrival = 'fade',
  onHeard,
  onDrawn,
  onLoaded,
  onWaiting,
  onUpdating,
  interaction,
  probe,
  adopt,
}: ISceneRunnerOptions): RefObject<HTMLDivElement | null> {
  const { points, waveform, isPaused, readFrame } = useSceneAudio();
  // The listener's frame rate and resolution, from this window's store unless
  // the page was handed main's copy (the desktop).
  const storedPerformance = useScenePerformance();
  const performance = chosenPerformance ?? storedPerformance;
  const performanceRef = useRef(performance);
  performanceRef.current = performance;
  // Read every frame: a blur dragged up draws fewer pixels at once.
  const blurPxRef = useRef(blurPx ?? 0);
  blurPxRef.current = blurPx ?? 0;
  // How often frames are actually being drawn: the budget a frame's GPU
  // cost is judged against.
  const cadenceRef = useRef(createFrameCadence());
  // What the scene is drawn inside: each worker puts a canvas of its own here.
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ISceneWorkerClient | undefined>(undefined);
  const packRef = useRef<IScenePack | null>(null);
  const drawnAtRef = useRef<number | undefined>(undefined);
  /**
   * When the music was last read, on the real clock. Not forgotten when the
   * loop stops, as `drawnAtRef` is: the music plays on while the window is
   * covered, and the beat clock has to be told how long it went unheard.
   */
  const heardAtRef = useRef<number | undefined>(undefined);
  const visibleRef = useRef(true);
  const asleepRef = useRef(asleep === true);
  asleepRef.current = asleep === true;
  const heldRef = useRef(held === true);
  heldRef.current = held === true;
  const clipRef = useRef<readonly [number, number, number, number]>([
    0, 0, 1, 1,
  ]);
  const generationRef = useRef(0);
  const buildingRef = useRef(false);

  // The music measured here, for music that arrives as points alone (sent
  // from another computer, relayed to a desktop background); the window's
  // own is read once for every drawing (`liveSound.ts`).
  const energyRef = useRef(createEnergyState());
  /** The last reading, held while nothing is measured. */
  const lastEnergyRef = useRef<ISpectrumEnergy | undefined>(undefined);
  /** The flywheel's angle, turned in the scene's own time. */
  const runRef = useRef(0);
  const spectrumRef = useRef(createSpectrumTexels());
  const waveformRef = useRef(createWaveformTexels());
  const ladderRef = useRef<ICostLadder>(
    sceneRulesFor(source.madeBy).createLadder(1, performance.autoFloor),
  );
  /** The largest scale the ladder was made for: 1, or the supersampled size. */
  const ladderTopRef = useRef(1);
  /** The smallest it was made for: the listener's floor at the time. */
  const ladderFloorRef = useRef<number>(performance.autoFloor);
  /** Whether nothing has played for a while (`sceneRest.ts`). */
  const restRef = useRef<IRestWatch>(createRestWatch());
  /** The size the last frames were drawn at, and for how many in a row. */
  const heldScaleRef = useRef<number | undefined>(undefined);
  const heldFramesRef = useRef(0);
  const clockRef = useRef(0);
  /** `musicSeconds`: the same clock at the music's own, unslowed pace. */
  const musicClockRef = useRef(0);
  /** Where the fade starts for each new build (`arrival`). */
  const arrivalFadeRef = useRef(0);
  arrivalFadeRef.current = arrival === 'at-once' ? 1 : 0;
  const fadeRef = useRef(arrivalFadeRef.current);
  const accentRef = useRef(parseAccent(''));
  const paramsRef = useRef<Record<string, number>>({});

  // Refs rather than closure captures, so the frame loop reads the newest
  // measurement without being torn down and rebuilt twenty-two times a second.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  // Every way this scene ends up not playing, one line in the app's log
  // (`common/sceneFailureLog.ts`): what failed, where, and the driver's or
  // reader's own words, once per cause.
  const logFailure = useCallback(
    (reason: TSceneFailureReason, detail?: string) => {
      const {
        identity,
        lookId,
        version,
        surface,
        logFailure: send,
      } = sourceRef.current;
      logSceneFailure(
        {
          lookId: lookId ?? identity,
          version,
          surface,
          reason,
          ...(detail ? { detail } : {}),
        },
        send,
      );
    },
    [],
  );
  const shapeRef = useRef(shapeFrame);
  shapeRef.current = shapeFrame;
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  const tunerRef = useRef(createSceneTuner());
  const readDaylightRef = useRef(daylight);
  readDaylightRef.current = daylight;
  const daylightRef = useRef(
    createDaylightFollower(() => (readDaylightRef.current ?? pageDaylight)()),
  );
  const heardRef = useRef(onHeard);
  heardRef.current = onHeard;
  /** The musical accent's envelope as the scene last drew it. */
  const drawnAccentRef = useRef(0);
  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;
  const probeRef = useRef(probe);
  probeRef.current = probe;
  const waitingCallbackRef = useRef(onWaiting);
  waitingCallbackRef.current = onWaiting;
  const waitingRef = useRef<boolean | undefined>(undefined);
  const updatingCallbackRef = useRef(onUpdating);
  updatingCallbackRef.current = onUpdating;
  const updatingRef = useRef(false);
  /**
   * The build whose program the worker holds ready to draw. Frames are
   * tagged with it when they are sent, so the last frame of the version being
   * replaced, answered after its replacement was asked for, does not end the
   * wait for the new one.
   */
  const readyGenerationRef = useRef<number | undefined>(undefined);
  /**
   * The program (`ladderProgramOf`) the size ladder has been climbing with.
   * The same program built again — in a fresh worker, once the scene is seen
   * again after being put away — keeps the size it had already proved it can
   * draw; the warm-up started from an eighth again on every return to the
   * window, for a scene that had been running whole seconds before.
   */
  const ladderProgramRef = useRef<string | undefined>(undefined);
  const pointsRef = useRef(points);
  pointsRef.current = isPaused ? NO_POINTS : points;
  const waveformSamplesRef = useRef(waveform);
  waveformSamplesRef.current = isPaused ? NO_WAVEFORM : waveform;
  const readFrameRef = useRef(readFrame);
  readFrameRef.current = readFrame;
  const interactionRef = useRef(interaction);
  interactionRef.current = interaction;
  /** Where the music stands between the speakers, eased (`uStereo`). */
  const stereoRef = useRef(createStereoFollower());
  const sizeRef = useRef({ width, height, captureSize });
  sizeRef.current = { width, height, captureSize };
  const spectrumRectRef = useRef(spectrumRect);
  spectrumRectRef.current = spectrumRect;
  const viewRef = useRef(view);
  viewRef.current = view;
  // How fast the scene's own time runs: one for a listener who wants motion,
  // `REDUCED_MOTION_SPEED` for one who has asked Windows for less of it. Read
  // in the frame loop through a ref, and kept current by an effect, because
  // the setting can change while a scene is playing.
  const motionRef = useRef(1);
  motionRef.current = useSceneMotionSpeed();

  const playing = !isPaused && points.length > 0;

  const setWaiting = useCallback((waiting: boolean) => {
    if (waitingRef.current !== waiting) {
      waitingRef.current = waiting;
      waitingCallbackRef.current?.(waiting);
    }
  }, []);

  const setUpdating = useCallback((updating: boolean) => {
    if (updatingRef.current !== updating) {
      updatingRef.current = updating;
      updatingCallbackRef.current?.(updating);
    }
  }, []);

  // The worker goes with whatever it was building beside the picture.
  const dropProgram = useCallback(() => {
    rendererRef.current?.dispose();
    rendererRef.current = undefined;
    setUpdating(false);
  }, [setUpdating]);

  const onFrame = useCallback(
    (elapsedMs: number): boolean => {
      const host = hostRef.current;
      const renderer = rendererRef.current;
      if (
        !host ||
        !renderer ||
        !packRef.current ||
        !visibleRef.current ||
        asleepRef.current ||
        document.hidden
      ) {
        drawnAtRef.current = undefined;
        // The loop is stopping: the worker draws nothing of its own either.
        renderer?.idle();
        return false;
      }
      if (!renderer.canDraw()) {
        return true;
      }
      const now = window.performance.now();
      const realDeltaMs =
        drawnAtRef.current === undefined ? elapsedMs : now - drawnAtRef.current;
      drawnAtRef.current = now;
      // Measured on the real clock, always: this is how fast frames are
      // actually arriving, and the cost ladder and the worker's pacing are
      // judged against it.
      cadenceRef.current.note(realDeltaMs);
      // What the SCENE's own time advances by, which is where reduced motion
      // lands. A listener who asks Windows for less motion gets a scene whose
      // drifting, sweeping, spinning and flying run at a quarter speed, while
      // it still answers the music — the level, the beat and the bands are
      // read from the sound and are not touched here.
      //
      // Not switched off, which is what the ambient layer does. That layer is
      // decoration over the app and its absence costs nothing; a visualizer
      // held still is the feature turned off, and "reduce" is not "remove".
      // Slowing the clock is the one lever that reaches every scene: a member
      // writes whatever shader they like and the only thing all of them agree
      // on is that they are handed a time and an elapsed.
      const deltaMs = realDeltaMs * motionRef.current;
      const intervalMs = cadenceRef.current.intervalMs();
      // The music as it is at this frame, not at the pump's last tick, which
      // was 16 ms stale at the median. Paused, sent from another PC or not
      // capturing, it answers nothing and the React frame stands.
      const fresh = readFrameRef.current();
      const currentPoints = fresh ? fresh.points : pointsRef.current;
      const currentWaveform = fresh
        ? fresh.waveform
        : waveformSamplesRef.current;
      const isPlaying = currentPoints.length > 0;
      // The viewer's hand, read on the real clock: a drag glides and a tap
      // ages at the speed the hand moved, not at a reduced-motion quarter.
      const scenePack = packRef.current;
      const hands = interactionRef.current;
      hands?.setLimits(scenePack.camera);
      const handed = hands?.read(realDeltaMs);

      // Sized inside the loop, as the 2D canvas is, because the pixel ratio is
      // not only a property of the element: dragging the window onto a display
      // with a different scale changes it with nothing to observe. Display
      // pixels up to a 4K pixel budget are the panel's own; the ladder draws
      // the scene at a fraction of them when the GPU cannot keep up, and the
      // worker brings that picture back up to the panel's pixels. A listener
      // who chose full resolution or a preset is never drawn by the ladder —
      // it still watches, so a scene too slow even for that is handed over.
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const { resolution, smoothing, upscaler } = performanceRef.current;
      const { width: cssWidth, height: cssHeight } = sizeRef.current;
      const pixelCap = Math.min(
        1,
        Math.sqrt(
          (3840 * 2160) / Math.max(1, cssWidth * cssHeight * ratio * ratio),
        ),
      );
      const output = sizeRef.current.captureSize ?? {
        width: Math.max(1, Math.round(cssWidth * ratio * pixelCap)),
        height: Math.max(1, Math.round(cssHeight * ratio * pixelCap)),
      };
      // `best` smoothing draws larger than the panel and averages down, within
      // the same pixel budget: twice each way at 1080p, what fits at 1440p,
      // nothing at 4K, where FXAA alone is left to do the smoothing.
      const supersample =
        smoothing === 'best'
          ? Math.min(
              SCENE_SUPERSAMPLE,
              Math.sqrt((3840 * 2160) / (output.width * output.height)),
            )
          : 1;
      const top = supersample > 1.05 ? supersample : 1;
      const { autoFloor } = performanceRef.current;
      if (top !== ladderTopRef.current) {
        ladderTopRef.current = top;
        ladderFloorRef.current = autoFloor;
        ladderRef.current = sceneRulesFor(
          sourceRef.current.madeBy,
        ).createLadder(top, autoFloor);
        const proved =
          ladderProgramRef.current === undefined
            ? undefined
            : provenScales.get(ladderProgramRef.current);
        if (proved !== undefined) {
          ladderRef.current.resume(proved);
        }
      } else if (autoFloor !== ladderFloorRef.current) {
        // A new floor moves the rungs under the picture, never the picture.
        ladderFloorRef.current = autoFloor;
        ladderRef.current.refloor(autoFloor);
      }
      const pinned = scenePinnedScale(resolution);
      let scale = ladderRef.current.scale();
      if (pinned !== undefined) {
        scale = resolution === 'native' ? top : pinned;
      }
      // A recorded frame must be genuinely rendered at its delivered size.
      // Keep the overload checks, but never encode an upscaled low rung.
      if (sizeRef.current.captureSize) {
        scale = Math.max(1, scale);
      }
      // Under a blur, no more pixels than survive it (`sceneBlurScale.ts`).
      // What the ladder chose stays its own: the held and proven sizes below
      // are the ladder's, never a size the blur asked for.
      const ladderScale = scale;
      const blurCap = sizeRef.current.captureSize
        ? 1
        : blurredScale(blurPxRef.current, ratio * pixelCap);
      const isBlurred = blurCap < 1;
      scale = Math.min(scale, blurCap);
      const drawn = {
        width: Math.max(1, Math.round(output.width * scale)),
        height: Math.max(1, Math.round(output.height * scale)),
      };
      // A picture drawn at the full supersample is four samples a pixel,
      // averaged: its edges are already resolved, and FXAA over it only
      // softens what is there — measured on Crystal at 1460x567, a third of
      // a millisecond for a picture no cleaner. FXAA stays wherever the
      // supersample is partial or absent, which is most panels at 4K.
      const supersampled = scale >= SCENE_SUPERSAMPLE - 0.05;
      const finish = {
        // The plain scaler for good once the FSR passes have proved too dear
        // for this GPU at this size (`SCENE_FINISH_SHARE`).
        // Neither under a blur: it takes away the edges both work on.
        fsr:
          !isBlurred && upscaler === 'fsr' && !ladderRef.current.cheapFinish(),
        fxaa: !isBlurred && smoothing !== 'off' && !supersampled,
      };

      const heardGapMs =
        heardAtRef.current === undefined
          ? realDeltaMs
          : now - heardAtRef.current;
      heardAtRef.current = now;
      // The music as this window hears it, read once for every drawing in it;
      // music sent from elsewhere, as points, measured here - in the music's
      // own time, never slowed time, and across any stretch nothing was
      // drawn; and with nothing measured at all (paused) the last reading
      // held, as a paused song holds its picture.
      let energy: ISpectrumEnergy;
      if (fresh?.sound) {
        energy = fresh.sound.music();
      } else if (isPlaying) {
        energy = advanceEnergy(
          energyRef.current,
          currentPoints,
          MAX_GAIN,
          heardGapMs,
          true,
        );
      } else {
        energy = holdEnergy(
          lastEnergyRef.current ??
            advanceEnergy(
              energyRef.current,
              currentPoints,
              MAX_GAIN,
              heardGapMs,
              false,
            ),
        );
      }
      lastEnergyRef.current = energy;
      // The wheel turns in the scene's own time, which reduced motion slows.
      runRef.current = turnRun(runRef.current, energy.runSpeed, deltaMs);
      const stereo = stereoRef.current(
        isPlaying ? fresh?.stereo : undefined,
        realDeltaMs,
      );
      fillSpectrumTexels(
        currentPoints,
        spectrumRef.current,
        MIN_GAIN,
        MAX_GAIN,
      );
      fillWaveformTexels(currentWaveform, waveformRef.current);

      // The page's own clock, for what the page derives from a frame — the
      // Studio's signals, a taste's ten seconds, a recorded moment. The clock
      // the scene is drawn on is the worker's, which keeps running through a
      // stall of this thread that this one clamps away. Ambient travel
      // continues through silence; visibility stops it before any work.
      musicClockRef.current =
        (musicClockRef.current + Math.min(100, realDeltaMs) / 1000) %
        SCENE_TIME_WRAP_S;
      clockRef.current =
        (clockRef.current + Math.min(100, deltaMs) / 1000) % SCENE_TIME_WRAP_S;
      // The scene fades in over its first quarter second rather than popping,
      // and the same ramp is what a later crossfade will drive.
      fadeRef.current += (1 - fadeRef.current) * getEaseFactor(deltaMs, 80);

      const heard: ISceneFrame = {
        timeSeconds: clockRef.current,
        musicSeconds: musicClockRef.current,
        deltaMs,
        ...musicFrameOf(energy, runRef.current),
        accent: accentRef.current,
        fade: fadeRef.current,
        playing: isPlaying && !isSilentWaveform(currentWaveform),
        spectrum: spectrumRef.current,
        spectrumRect: spectrumRectRef.current,
        ...(viewRef.current ? { view: viewRef.current } : {}),
        waveform: waveformRef.current,
        params: paramsRef.current,
        stereo,
        ...(handed
          ? {
              pointer: handed.pointer,
              tap: handed.tap,
              camera: handed.camera,
            }
          : {}),
      };
      const shaped = shapeRef.current ? shapeRef.current(heard) : heard;
      // Every scene rests the same way, wherever it plays, judged on what it
      // is played once its place has had its say — the Studio's made-up music
      // is played, a desktop's calm motion is not — and before the pace is
      // read below, so the first frame with sound in it is drawn at full rate.
      // A scene somebody is turning or pointing at never rests, or the camera
      // would move at half the rate of the hand moving it.
      restRef.current.frame(now, !shaped.playing && !handed?.busy);
      const frame = tunerRef.current.apply(
        shaped,
        deltaMs,
        packRef.current,
        paramsRef.current,
        tuningRef.current,
        daylightRef.current.next(deltaMs),
      );
      heardRef.current?.(frame, shaped, drawnAccentRef.current);
      const ladder = ladderRef.current;
      const drawnGeneration = readyGenerationRef.current;
      // The pace this loop is keeping, so the worker can tell a page that
      // has fallen behind from one drawing every other frame on purpose.
      const paceMs = paceMsOf(performanceRef.current, ladder, restRef.current);
      renderer.draw(
        frame,
        drawn,
        output,
        finish,
        clipRef.current,
        paceMs,
        (result) => {
          // Judged by what frames cost the GPU, against the interval they are
          // drawn at — the worker's own, on the display's beat, not how long
          // the page took between frames: see the worker's draw.
          //
          // The TIGHTER of the two, which is the whole of it. The worker's
          // number is the gap between frames it actually drew, and when the
          // GPU is the bottleneck the worker skips ticks, so that gap IS the
          // frame's own cost. Taken alone it made the budget the thing being
          // measured: cost over budget came out at one however heavy the
          // scene, so `slow` (three times) could never fire, `hopeless` (ten
          // times) could never fire, and `smooth` (a quarter over) always
          // did — a member's scene climbed the warm-up ladder to full size on
          // twelve "smooth" frames of any cost at all, to a frame big enough
          // to reset the display driver for every program on the machine.
          // `judgedIntervalMs` is that rule, and its comment is where this is
          // written down.
          const drawnIntervalMs = judgedIntervalMs(
            intervalMs,
            result.intervalMs,
          );
          if (
            ladder === ladderRef.current &&
            ladder.frame(result.cost, drawnIntervalMs, document.hidden) ===
              'degraded'
          ) {
            // A scene nobody here has watched held the GPU even at an eighth
            // of the panel and the slow rate, after being warmed again there
            // (`sceneWarmup.ts`): long enough to freeze the window. Never for
            // being slow: a slow scene rests on its smallest size and stays.
            // The source says so in the scene's place, never a standard look.
            console.error(
              `Scene "${sourceRef.current.name}" held the GPU too long even at its smallest size; it stops until the next launch.`,
            );
            logFailure('stalled-gpu');
            dropProgram();
            setWaiting(false);
            sourceRef.current.tooSlow();
            return;
          }
          // Nothing reached the canvas: the GPU still held two frames.
          if (result.skipped) {
            return;
          }
          drawnAccentRef.current = result.accent;
          // A size held for a run of frames is one this program draws: the
          // next ladder made for it starts there, not from the bottom.
          if (ladderScale === heldScaleRef.current) {
            heldFramesRef.current += 1;
          } else {
            heldScaleRef.current = ladderScale;
            heldFramesRef.current = 1;
          }
          const key = ladderProgramRef.current;
          if (key !== undefined && heldFramesRef.current >= PROVEN_FRAMES) {
            provenScales.set(
              key,
              Math.max(provenScales.get(key) ?? 0, ladderScale),
            );
          }
          // Its first frame with anything in it: a fade still at zero is black.
          if (drawnGeneration === generationRef.current && frame.fade > 0) {
            setWaiting(false);
          }
          const report: ISceneDrawReport = {
            scale,
            costMs: result.cost.costMs,
            postMs: result.cost.postMs,
            intervalMs: drawnIntervalMs,
            shown: result.shown,
            drawnWidth: drawn.width,
            drawnHeight: drawn.height,
            outputWidth: output.width,
            outputHeight: output.height,
            fsr: finish.fsr,
            fxaa: finish.fxaa,
            ...(result.edit ? { edit: result.edit } : {}),
          };
          drawnRef.current?.(frame, scale, result.accent, shaped, report);
          // A scene or an engine look behind the graph's scale labels.
          noteGraphFrame();
        },
      );
      return true;
    },
    [dropProgram, setWaiting, logFailure],
  );

  // Every frame the display offers, or the cap the listener chose — sixty on
  // battery; euphoria has always asked for every frame and still does — or
  // thirty where the ladder or a rest in silence says so (`paceMsOf`).
  const scenePace = useCallback(
    () => paceMsOf(performanceRef.current, ladderRef.current, restRef.current),
    [],
  );
  const kick = useSmoothFrames(onFrame, {
    isEnabled: true,
    minFrameMs: scenePace,
  });

  /**
   * The pack a scene put away while nobody could see it, to build again when
   * somebody can. See the `shown` report below.
   */
  const shelvedRef = useRef<IScenePack | null>(null);
  // The newest pack asked for, which is not yet `packRef` while it compiles:
  // hiding a scene mid-compile has to shelve this one, not nothing.
  const wantedRef = useRef<IScenePack | null>(null);
  // The earlier build being put up in place of a first version that would
  // not compile: drawn, but not the version the source names.
  const standInRef = useRef<IScenePack | null>(null);
  /**
   * A build the GPU context was lost under (a GPU process crash, a driver
   * reset): built again the moment the worker says the context is back.
   */
  const lostBuildRef = useRef<IScenePack | null>(null);
  const shownRef = useRef(true);
  const buildRef = useRef<(pack: IScenePack) => Promise<void>>(() =>
    Promise.resolve(),
  );

  // The part of the host on screen, measured again: kept here for a move,
  // which nothing the effect below listens to says.
  const measureRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    const measure = () => {
      const box = host.getBoundingClientRect();
      const left = Math.max(0, -box.left);
      const top = Math.max(0, -box.top);
      const right = Math.min(box.width, window.innerWidth - box.left);
      const bottom = Math.min(box.height, window.innerHeight - box.top);
      const capturing = captureFrames && !document.hidden;
      visibleRef.current =
        capturing || (shownRef.current && right > left && bottom > top);
      if (visibleRef.current) {
        clipRef.current = capturing
          ? [0, 0, 1, 1]
          : [
              left / box.width,
              top / box.height,
              right / box.width,
              bottom / box.height,
            ];
        kick();
      } else {
        drawnAtRef.current = undefined;
      }
    };
    /**
     * A scene nobody can see in the page gives its worker back, GPU context
     * and all.
     *
     * Stopping the frame loop alone was what hiding used to do, and the worker,
     * its WebGL context, the compiled program and every texture stayed held for
     * as long as the component stayed mounted — under the expanded graph,
     * behind the Studio's full stage, scrolled out of a gallery. The pack is
     * kept, so coming back into view compiles it again beside nothing and
     * fades it in.
     */
    const shelve = () => {
      // A pack that arrived while the scene was unseen is already waiting
      // here (`build`), and it is newer than the one drawn.
      shelvedRef.current =
        shelvedRef.current ?? wantedRef.current ?? packRef.current;
      generationRef.current += 1;
      buildingRef.current = false;
      dropProgram();
      packRef.current = null;
      // The canvas went with the worker; the next picture is a whole build
      // away, and the stage says it is loading rather than sitting black.
      if (shelvedRef.current) {
        setWaiting(true);
      }
    };
    /**
     * A hidden WINDOW keeps its scene: idle, its last picture on the canvas.
     *
     * Minimised, covered by another window (Windows calls FluidEQ hidden
     * then too) or on another desktop, the page paints no frame, so the last
     * frame it painted is the one Windows shows again the moment the window
     * comes back — before the page has run a line. That frame holds the
     * canvas, and the canvas's picture lives in the worker: a scene shelved
     * while hidden had ended its worker, and every restore showed the graph
     * solid white until the page's first new frame replaced it, then the
     * loading backdrop, then a whole compile and a fade (Ivan, 2026-11-17:
     * "the white bg that shows in the graph's canvas when I restore the
     * app"). Kept, the restore shows the scene as it was left and the loop
     * picks it up on its next frame. What the next frame can make again is
     * still given back while hidden (`idle` below: the scene's passes and
     * the finishing chain), so what is held is the program and the context.
     */
    let keptThroughHide = false;
    const stopObserving = observeShown(host, (shown) => {
      const active = shown || (captureFrames && !document.hidden);
      shownRef.current = active;
      keptThroughHide = !active && document.hidden && !!rendererRef.current;
      if (!active && rendererRef.current && !document.hidden) {
        shelve();
      } else if (active && shelvedRef.current) {
        const pack = shelvedRef.current;
        shelvedRef.current = null;
        fadeRef.current = arrivalFadeRef.current;
        buildRef.current(pack).catch(() => undefined);
      }
      measure();
    });
    const resize = new ResizeObserver(measure);
    resize.observe(host);
    // The frame loop stops itself when the window hides, without a last
    // frame to say so; the worker is told here, or it would keep drawing
    // frames of its own into a window nobody can see.
    //
    // A window coming back into a page that hides the scene some other way
    // (the expanded graph over it, say) is not reported by `observeShown`,
    // whose answer was "not shown" before and still is: the scene kept
    // through the hide is shelved here, now that the page paints again and
    // the canvas can leave the screen before its worker goes. Registered
    // after `observeShown`'s own listener, so `shownRef` is already current.
    const hidden = () => {
      if (document.hidden) {
        rendererRef.current?.idle();
      } else if (keptThroughHide) {
        keptThroughHide = false;
        if (!shownRef.current && rendererRef.current) {
          shelve();
          measure();
        }
      }
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    measureRef.current = measure;
    return () => {
      measureRef.current = undefined;
      stopObserving();
      resize.disconnect();
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [width, height, placement, kick, dropProgram, setWaiting, captureFrames]);
  // A host moved without a resize: the part now on screen is the one drawn.
  useEffect(() => {
    measureRef.current?.();
  }, [moved]);

  // What a worker's failure and its context's return mean, the same for a
  // worker started here and one taken ready-built (`adopt`).
  const rendererFailed = useCallback(
    (reason: 'unavailable' | 'context-lost' | 'gpu-reset', log?: string) => {
      if (log) {
        console.error(
          `Scene "${sourceRef.current.name}" renderer failed: ${log}`,
        );
      }
      dropProgram();
      setWaiting(false);
      logFailure(
        reason === 'context-lost' || reason === 'gpu-reset'
          ? reason
          : 'unavailable',
        log,
      );
      if (reason === 'context-lost' || reason === 'gpu-reset') {
        sourceRef.current.reportFailure(reason);
      } else {
        sourceRef.current.block();
      }
    },
    [dropProgram, setWaiting, logFailure],
  );
  const rendererRecovered = useCallback(() => {
    drawnAtRef.current = undefined;
    ladderRef.current = sceneRulesFor(sourceRef.current.madeBy).createLadder(
      ladderTopRef.current,
      ladderFloorRef.current,
    );
    const proved =
      ladderProgramRef.current === undefined
        ? undefined
        : provenScales.get(ladderProgramRef.current);
    if (proved !== undefined) {
      ladderRef.current.resume(proved);
    }
    kick();
    const lostBuild = lostBuildRef.current;
    lostBuildRef.current = null;
    if (lostBuild && lostBuild === wantedRef.current) {
      buildRef.current(lostBuild).catch(() => undefined);
    }
  }, [kick]);

  /**
   * The two above for one worker, heard only while it is the one drawing:
   * the picture kept on screen through a crossfade is a worker too, and its
   * failure is not the scene now being drawn.
   */
  const handlersFor = useCallback(
    (
      renderer: () => ISceneWorkerClient | undefined,
    ): ISceneRendererHandlers => {
      const isCurrent = () =>
        renderer() !== undefined && renderer() === rendererRef.current;
      return {
        failed: (reason, log) => {
          if (isCurrent()) {
            rendererFailed(reason, log);
          }
        },
        recovered: () => {
          if (isCurrent()) {
            rendererRecovered();
          }
        },
      };
    },
    [rendererFailed, rendererRecovered],
  );

  /** The renderer drawn with from now on, told what the page already holds. */
  const installRenderer = useCallback((renderer: ISceneWorkerClient) => {
    rendererRef.current = renderer;
    renderer.holdPicture(heldRef.current);
    if (probeRef.current) {
      renderer.probe(probeRef.current.rects, probeRef.current.heard);
    }
  }, []);

  const startRenderer = useCallback(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    let started: ISceneWorkerClient | undefined;
    const handlers = handlersFor(() => started);
    try {
      started = createSceneWorkerClient(
        host,
        handlers.failed,
        handlers.recovered,
        arrivalFadeRef.current === 1 ? 'at-once' : 'fade',
      );
    } catch (error) {
      console.error('Scene worker could not start:', error);
      logFailure('no-worker', String(error));
    }
    if (!started) {
      rendererRef.current = undefined;
      setWaiting(false);
      sourceRef.current.block();
      return undefined;
    }
    installRenderer(started);
    return started;
  }, [handlersFor, installRenderer, setWaiting, logFailure]);

  /**
   * The picture drawn before a scene that was taken ready-built: idle, left
   * on screen under the new canvas until that one's first picture has faded
   * in over it, then given back (`adopt`). Never drawn to meanwhile.
   */
  const outgoingRef = useRef<ISceneWorkerClient | undefined>(undefined);
  const letOutgoingGo = useCallback(() => {
    outgoingRef.current?.dispose();
    outgoingRef.current = undefined;
  }, []);
  /** A ready build taken with its worker, for the load below to put up. */
  const adoptedRef = useRef<
    | {
        identity: string;
        renderer: ISceneWorkerClient;
        pack: IScenePack;
        result: TSceneBuildResult;
      }
    | undefined
  >(undefined);
  /** Whether the scene just taken comes in over a picture still on screen. */
  const crossingRef = useRef(false);
  const adoptRef = useRef(adopt);
  adoptRef.current = adopt;

  /** A worker prepares the next scene while the interface remains available. */
  const build = useCallback(
    async (
      pack: IScenePack,
      /**
       * What a worker taken ready-built answered when it built this pack
       * (`adopt`): used, rather than asked again, while that worker is the
       * one drawing.
       */
      built?: { renderer: ISceneWorkerClient; result: TSceneBuildResult },
    ) => {
      const rules = sceneRulesFor(sourceRef.current.madeBy);
      // Unseen, it waits to be seen before it costs a worker.
      if (!shownRef.current) {
        shelvedRef.current = pack;
        setWaiting(true);
        if (rules.warmWhenUnseen) {
          warmSceneProgram(pack, rules.unwatched);
        }
        return;
      }
      wantedRef.current = pack;
      // A settings save comes back as a new pack. Keep the running program,
      // textures and clock; do not even copy its artwork to a worker.
      if (
        rendererRef.current &&
        packRef.current &&
        !buildingRef.current &&
        sameSceneProgramInputs(packRef.current, pack)
      ) {
        packRef.current = pack;
        paramsRef.current = Object.fromEntries(
          pack.params.map((param) => [param.id, param.value]),
        );
        // The same program as the one drawn, so this version has built too.
        if (pack !== standInRef.current) {
          standInRef.current = null;
          sourceRef.current.built?.();
        }
        loadedRef.current?.(pack);
        kick();
        return;
      }
      // A picture of this scene on the canvas, drawing: the worker builds the
      // new version beside it and goes on drawing the old one, so the canvas
      // is not waiting, only updating. It used to say it waited, and the
      // Studio covered its stage with "Loading" on every save the member's AI
      // made, until the new version's first frame.
      const beside =
        rendererRef.current !== undefined &&
        packRef.current !== null &&
        waitingRef.current === false;
      const renderer = rendererRef.current ?? startRenderer();
      if (!renderer) {
        return;
      }
      generationRef.current += 1;
      const generation = generationRef.current;
      buildingRef.current = true;
      if (beside) {
        setUpdating(true);
      } else {
        setWaiting(true);
      }
      let result: TSceneBuildResult;
      try {
        result =
          built?.renderer === renderer
            ? built.result
            : await renderer.load(pack, rules.unwatched);
      } finally {
        if (generation === generationRef.current) {
          buildingRef.current = false;
        }
      }
      if (
        generation !== generationRef.current ||
        renderer !== rendererRef.current
      ) {
        return;
      }
      setUpdating(false);
      drawnAtRef.current = undefined;
      if (result.kind === 'lost') {
        // Not the scene's failure, and nothing to give up on: the canvas
        // shows the ground under it until the context is back, and the
        // build runs again then (`lostBuildRef`). Reported as unavailable,
        // a GPU process crash during a build put the look off for the rest
        // of the session.
        lostBuildRef.current = pack;
      } else if (result.kind === 'unavailable') {
        logFailure('unavailable');
        dropProgram();
        setWaiting(false);
        sourceRef.current.block();
      } else if (result.kind === 'compile') {
        console.error(
          `Scene "${pack.names.en}" (${pack.id} v${pack.version}) failed to compile:\n${result.log}`,
        );
        // The last version that compiled, if there is one, carries on — and is
        // the one built again should the scene be put away and seen again,
        // rather than the broken one, which left nothing on the stage. That is
        // not a failure of the scene: it used to be reported as one, and every
        // place but the Studio then put the plain look over a scene still
        // drawing (Ivan, 2026-11-09: "I dont want fallbacks like that").
        if (packRef.current) {
          logFailure('version-compile', result.log);
          wantedRef.current = packRef.current;
          setWaiting(false);
          sourceRef.current.versionFailed?.(result.log);
          return;
        }
        // Nothing of it drawn yet: the last version that built here, if one
        // was kept and it is another program, stands in for it.
        let earlier: IScenePack | undefined;
        try {
          earlier = await sourceRef.current.lastBuilt?.();
        } catch {
          earlier = undefined;
        }
        if (
          generation !== generationRef.current ||
          renderer !== rendererRef.current
        ) {
          return;
        }
        if (earlier && !sameSceneProgramInputs(earlier, pack)) {
          logFailure('compile', result.log);
          logFailure('stood-in', `version ${earlier.version}`);
          sourceRef.current.versionFailed?.(result.log);
          standInRef.current = earlier;
          // Should it not compile either, it is the one `lastBuilt` answers
          // again, the same program, and this ends in `reportFailure`.
          await buildRef.current(earlier);
          return;
        }
        logFailure('compile', result.log);
        setWaiting(false);
        sourceRef.current.reportFailure('compile', result.log);
      } else if (result.kind === 'ready') {
        packRef.current = pack;
        readyGenerationRef.current = generation;
        paramsRef.current = Object.fromEntries(
          pack.params.map((param) => [param.id, param.value]),
        );
        const program = ladderProgramOf(sourceRef.current.identity, pack);
        if (result.rebuilt && program !== ladderProgramRef.current) {
          ladderRef.current = rules.createLadder(
            ladderTopRef.current,
            ladderFloorRef.current,
          );
          ladderProgramRef.current = program;
          const proved = provenScales.get(program);
          if (proved !== undefined) {
            ladderRef.current.resume(proved);
          }
        }
        if (result.world) {
          // A world drawn as its shader, or with parts left out, is a way it
          // did not play as made: the notes' codes are the reader's words.
          if (!result.world.drawn || result.world.notes.length > 0) {
            logFailure(
              'world-refused',
              `${result.world.drawn ? 'drawn without' : 'shader instead'}: ${result.world.notes
                .map((note) =>
                  'detail' in note
                    ? `${note.code} (${note.detail})`
                    : note.code,
                )
                .join(', ')}`,
            );
          }
          sourceRef.current.reportWorld?.(result.world);
        }
        if (pack !== standInRef.current) {
          standInRef.current = null;
          sourceRef.current.built?.();
        }
        loadedRef.current?.(pack);
        kick();
      }
    },
    [kick, startRenderer, dropProgram, setWaiting, setUpdating, logFailure],
  );
  buildRef.current = build;

  // A fresh worker, on a fresh canvas of its own, on every mount/project,
  // including React's development remount — see `createSceneWorkerClient`.
  // Not for a scene mounted where nobody can see it: its first build starts
  // one when it is shown.
  useEffect(() => {
    crossingRef.current = false;
    const { identity, version } = sourceRef.current;
    const host = hostRef.current;
    // Built ahead (`adopt`): the worker taken as it stands, its canvas moved
    // here, and its build put up by the load below without asking again.
    const prepared =
      shownRef.current && host
        ? adoptRef.current?.(identity, version)
        : undefined;
    if (prepared && host) {
      prepared.client.rehost(host);
      prepared.bind(handlersFor(() => prepared.client));
      installRenderer(prepared.client);
      adoptedRef.current = {
        identity,
        renderer: prepared.client,
        pack: prepared.pack,
        result: prepared.result,
      };
      // The picture before it stays up, idle, until this one's first
      // picture has faded in over it: a crossfade, never the loading ring
      // or a frame of nothing between them.
      const outgoing = outgoingRef.current;
      crossingRef.current = outgoing !== undefined;
      if (outgoing) {
        prepared.client
          .whenShown()
          .then(() => {
            if (outgoingRef.current === outgoing) {
              letOutgoingGo();
            }
            return undefined;
          })
          .catch(() => undefined);
      }
    } else {
      letOutgoingGo();
      if (shownRef.current) {
        startRenderer();
      }
    }
    return () => {
      generationRef.current += 1;
      adoptedRef.current = undefined;
      // A runner that may take its next scene ready-built keeps the picture
      // it was drawing on screen until it knows: the setup above lets it go
      // at once unless what comes next was built ahead. Idle meanwhile, so
      // its worker draws nothing more.
      const renderer = rendererRef.current;
      if (
        adoptRef.current &&
        renderer &&
        packRef.current &&
        waitingRef.current === false
      ) {
        letOutgoingGo();
        renderer.idle();
        outgoingRef.current = renderer;
        rendererRef.current = undefined;
        setUpdating(false);
      } else {
        dropProgram();
      }
      packRef.current = null;
      shelvedRef.current = null;
      wantedRef.current = null;
      standInRef.current = null;
    };
  }, [
    source.identity,
    startRenderer,
    dropProgram,
    installRenderer,
    letOutgoingGo,
    handlersFor,
    setUpdating,
  ]);
  // Unmounted mid-crossfade: the picture kept for it goes too. After the
  // effect above, whose cleanup is what may hand it the last one.
  useEffect(() => () => letOutgoingGo(), [letOutgoingGo]);

  // A different scene starts from the beginning: clock, fade and energy. Not
  // the music's time, which is
  // the music's: a new look dances from its first frame instead of listening
  // for the tempo all over again.
  useEffect(() => {
    // Over a picture still on screen the canvas's own fade is the crossfade;
    // a scene fading up from black inside it as well would dip through dark.
    fadeRef.current = crossingRef.current ? 1 : arrivalFadeRef.current;
    clockRef.current = 0;
    musicClockRef.current = 0;
    energyRef.current = {
      ...createEnergyState(),
      rhythm: energyRef.current.rhythm,
    };
    runRef.current = 0;
    // And from its author's view, whatever the last one was turned to.
    interactionRef.current?.home();
    tunerRef.current.reset();
    cadenceRef.current.reset();
    restRef.current.reset();
    accentRef.current = parseAccent(
      getComputedStyle(document.documentElement).getPropertyValue('--accent'),
    );
    packRef.current = null;
    drawnAtRef.current = undefined;
  }, [source.identity, dropProgram]);

  // Every version of it — the first included — is loaded and built beside the
  // running one. A refreshed pack used to keep drawing its old program until
  // another look was chosen, because only the id was tracked.
  useEffect(() => {
    let cancelled = false;
    // Taken ready-built (`adopt`): nothing to load or compile, its first
    // frame is the next one.
    const adopted = adoptedRef.current;
    if (
      adopted?.identity === sourceRef.current.identity &&
      adopted.renderer === rendererRef.current
    ) {
      adoptedRef.current = undefined;
      build(adopted.pack, adopted).catch(() => undefined);
      return undefined;
    }
    sourceRef.current
      .load()
      .then((pack) => {
        if (cancelled) {
          return undefined;
        }
        if (!pack) {
          // Entitlement lapsed between the list and the load, or the scene
          // was removed meanwhile. Session-only; nothing is written down.
          logFailure('not-listed');
          setWaiting(false);
          sourceRef.current.block();
          return undefined;
        }
        return build(pack);
      })
      .catch((error: unknown) => {
        // The bridge failed, not the shader. Session-only.
        if (!cancelled) {
          logFailure('load-failed', String(error));
          setWaiting(false);
          sourceRef.current.block();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source.identity, source.version, build, setWaiting, logFailure]);

  // Audio can wake a ready scene, but cannot restart hidden rendering.
  useEffect(() => {
    if (
      playing &&
      visibleRef.current &&
      !asleepRef.current &&
      !document.hidden
    ) {
      kick();
    }
  }, [playing, kick, points]);

  // Woken: the loop stopped itself on the frame that found the scene asleep,
  // and nothing else will start it again.
  useEffect(() => {
    if (asleep !== true) {
      kick();
    }
  }, [asleep, kick]);

  // Held and let go on the renderer there is; a renderer started while held
  // is told by `startRenderer`. Before the paint, so the layout the hold is
  // for is never shown with the picture on it; and kicked on the way back,
  // so the frame that brings the picture back is drawn even where the loop
  // had stopped.
  useLayoutEffect(() => {
    rendererRef.current?.holdPicture(held === true);
    if (held !== true) {
      kick();
    }
  }, [held, kick]);

  // The places read on the renderer there is; a renderer started later is
  // told by `startRenderer`.
  useEffect(() => {
    rendererRef.current?.probe(probe?.rects ?? [], probe?.heard);
  }, [probe]);

  // Redraw the backing buffer when the panel's geometry changes.
  useEffect(() => {
    kick();
  }, [width, height, spectrumRect, view, kick]);

  return hostRef;
}
