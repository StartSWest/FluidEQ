import { useCallback, useEffect, useRef, type RefObject } from 'react';
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
import { advanceEnergy, createEnergyState } from 'common/spectrumEnergy';
import { isOnBattery } from 'renderer/utils/batteryPower';
import observeShown from 'renderer/utils/observeShown';
import { useScenePerformance } from 'renderer/utils/scenePerformanceStore';
import useSmoothFrames from 'renderer/utils/useSmoothFrames';
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
import { sceneRulesFor } from './sceneRules';
import { createSceneTuner } from './sceneTuner';
import { sceneProgramKey } from './sceneLinkTurns';
import { sameSceneProgramInputs } from './sceneProgramInputs';
import type { ISceneDrawReport, ISceneRunnerOptions } from './sceneRunnerTypes';
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
 */
const provenScales = new Map<string, number>();

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
  shapeFrame,
  tuning,
  performance: chosenPerformance,
  asleep,
  onDrawn,
  onLoaded,
  onWaiting,
}: ISceneRunnerOptions): RefObject<HTMLDivElement | null> {
  const { points, waveform, isPaused, readFrame } = useSceneAudio();
  // The listener's frame rate and resolution, from this window's store unless
  // the page was handed main's copy (the desktop).
  const storedPerformance = useScenePerformance();
  const performance = chosenPerformance ?? storedPerformance;
  const performanceRef = useRef(performance);
  performanceRef.current = performance;
  // How often frames are actually being drawn: the budget a frame's GPU
  // cost is judged against.
  const cadenceRef = useRef(createFrameCadence());
  // What the scene is drawn inside: each worker puts a canvas of its own here.
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ISceneWorkerClient | undefined>(undefined);
  const packRef = useRef<IScenePack | null>(null);
  const drawnAtRef = useRef<number | undefined>(undefined);
  const visibleRef = useRef(true);
  const asleepRef = useRef(asleep === true);
  asleepRef.current = asleep === true;
  const clipRef = useRef<readonly [number, number, number, number]>([
    0, 0, 1, 1,
  ]);
  const generationRef = useRef(0);
  const buildingRef = useRef(false);

  const energyRef = useRef(createEnergyState());
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
  const fadeRef = useRef(0);
  const accentRef = useRef(parseAccent(''));
  const paramsRef = useRef<Record<string, number>>({});

  // Refs rather than closure captures, so the frame loop reads the newest
  // measurement without being torn down and rebuilt twenty-two times a second.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const shapeRef = useRef(shapeFrame);
  shapeRef.current = shapeFrame;
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  const tunerRef = useRef(createSceneTuner());
  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;
  const waitingCallbackRef = useRef(onWaiting);
  waitingCallbackRef.current = onWaiting;
  const waitingRef = useRef<boolean | undefined>(undefined);
  /**
   * The build whose program the worker holds ready to draw. Frames are
   * tagged with it when they are sent, so the last frame of the version being
   * replaced, answered after its replacement was asked for, does not end the
   * wait for the new one.
   */
  const readyGenerationRef = useRef<number | undefined>(undefined);
  /**
   * The program (`sceneProgramKey`) the size ladder has been climbing with.
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
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const spectrumRectRef = useRef(spectrumRect);
  spectrumRectRef.current = spectrumRect;
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

  const dropProgram = useCallback(() => {
    rendererRef.current?.dispose();
    rendererRef.current = undefined;
  }, []);

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
      const output = {
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
        fsr: upscaler === 'fsr' && !ladderRef.current.cheapFinish(),
        fxaa: smoothing !== 'off' && !supersampled,
      };

      const energy = advanceEnergy(
        energyRef.current,
        currentPoints,
        MIN_GAIN,
        MAX_GAIN,
        deltaMs,
        isPlaying,
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
      clockRef.current =
        (clockRef.current + Math.min(100, deltaMs) / 1000) % SCENE_TIME_WRAP_S;
      // The scene fades in over its first quarter second rather than popping,
      // and the same ramp is what a later crossfade will drive.
      fadeRef.current += (1 - fadeRef.current) * getEaseFactor(deltaMs, 80);

      const heard: ISceneFrame = {
        timeSeconds: clockRef.current,
        deltaMs,
        level: energy.level,
        beat: energy.beat,
        bands: [energy.bass, energy.mid, energy.treble],
        musicAccent: [energy.accent, energy.accentSerial],
        musicRun: [energy.run, energy.runSpeed],
        accent: accentRef.current,
        fade: fadeRef.current,
        playing: isPlaying && !isSilentWaveform(currentWaveform),
        spectrum: spectrumRef.current,
        spectrumRect: spectrumRectRef.current,
        waveform: waveformRef.current,
        params: paramsRef.current,
      };
      const shaped = shapeRef.current ? shapeRef.current(heard) : heard;
      // Every scene rests the same way, wherever it plays, judged on what it
      // is played once its place has had its say — the Studio's made-up music
      // is played, a desktop's calm motion is not — and before the pace is
      // read below, so the first frame with sound in it is drawn at full rate.
      restRef.current.frame(now, !shaped.playing);
      const frame = tunerRef.current.apply(
        shaped,
        deltaMs,
        packRef.current,
        paramsRef.current,
        tuningRef.current,
      );
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
            // Too slow even at the floor. The source decides what that means:
            // the graph falls back FOR THIS SESSION — a slow session is a fact
            // about the machine right now, not about the pack — and the
            // Studio says so.
            console.error(
              `Scene "${sourceRef.current.name}" ran too slowly even at its smallest size; it stops until the next launch.`,
            );
            dropProgram();
            setWaiting(false);
            sourceRef.current.tooSlow();
            return;
          }
          // Nothing reached the canvas: the GPU still held two frames.
          if (result.skipped) {
            return;
          }
          // A size held for a run of frames is one this program draws: the
          // next ladder made for it starts there, not from the bottom.
          if (scale === heldScaleRef.current) {
            heldFramesRef.current += 1;
          } else {
            heldScaleRef.current = scale;
            heldFramesRef.current = 1;
          }
          const key = ladderProgramRef.current;
          if (key !== undefined && heldFramesRef.current >= PROVEN_FRAMES) {
            provenScales.set(key, Math.max(provenScales.get(key) ?? 0, scale));
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
            drawnWidth: drawn.width,
            drawnHeight: drawn.height,
            outputWidth: output.width,
            outputHeight: output.height,
            fsr: finish.fsr,
            fxaa: finish.fxaa,
          };
          drawnRef.current?.(frame, scale, result.accent, shaped, report);
        },
      );
      return true;
    },
    [dropProgram, setWaiting],
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
  const shownRef = useRef(true);
  const buildRef = useRef<(pack: IScenePack) => Promise<void>>(() =>
    Promise.resolve(),
  );

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
      visibleRef.current = shownRef.current && right > left && bottom > top;
      if (visibleRef.current) {
        clipRef.current = [
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
     * A scene nobody can see gives its worker back, GPU context and all.
     *
     * Stopping the frame loop alone was what hiding used to do, and the worker,
     * its WebGL context, the compiled program and every texture stayed held for
     * as long as the component stayed mounted — under the expanded graph,
     * behind the Studio's full stage, scrolled out of a gallery, with the
     * window minimised. The pack is kept, so coming back into view compiles
     * it again beside nothing and fades it in.
     */
    const stopObserving = observeShown(host, (shown) => {
      shownRef.current = shown;
      if (!shown && rendererRef.current) {
        shelvedRef.current = wantedRef.current ?? packRef.current;
        generationRef.current += 1;
        buildingRef.current = false;
        dropProgram();
        packRef.current = null;
        // The canvas went with the worker; the next picture is a whole build
        // away. Windows calls FluidEQ hidden whenever another window covers
        // it, so this is where the Studio stage is while the member's AI saves
        // from the window in front — and it sat black, saying nothing.
        if (shelvedRef.current) {
          setWaiting(true);
        }
      } else if (shown && shelvedRef.current) {
        const pack = shelvedRef.current;
        shelvedRef.current = null;
        fadeRef.current = 0;
        buildRef.current(pack).catch(() => undefined);
      }
      measure();
    });
    const resize = new ResizeObserver(measure);
    resize.observe(host);
    // The frame loop stops itself when the window hides, without a last
    // frame to say so; the worker is told here, or it would keep drawing
    // frames of its own into a window nobody can see.
    const hidden = () => {
      if (document.hidden) {
        rendererRef.current?.idle();
      }
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      stopObserving();
      resize.disconnect();
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [width, height, kick, dropProgram, setWaiting]);

  const startRenderer = useCallback(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    try {
      rendererRef.current = createSceneWorkerClient(
        host,
        (reason, log) => {
          if (log) {
            console.error(
              `Scene "${sourceRef.current.name}" renderer failed: ${log}`,
            );
          }
          dropProgram();
          setWaiting(false);
          if (reason === 'context-lost' || reason === 'gpu-reset') {
            sourceRef.current.reportFailure(reason);
          } else {
            sourceRef.current.block();
          }
        },
        () => {
          drawnAtRef.current = undefined;
          ladderRef.current = sceneRulesFor(
            sourceRef.current.madeBy,
          ).createLadder(ladderTopRef.current, ladderFloorRef.current);
          const proved =
            ladderProgramRef.current === undefined
              ? undefined
              : provenScales.get(ladderProgramRef.current);
          if (proved !== undefined) {
            ladderRef.current.resume(proved);
          }
          kick();
        },
      );
    } catch (error) {
      console.error('Scene worker could not start:', error);
    }
    if (!rendererRef.current) {
      setWaiting(false);
      sourceRef.current.block();
    }
    return rendererRef.current;
  }, [dropProgram, kick, setWaiting]);

  /** A worker prepares the next scene while the interface remains available. */
  const build = useCallback(
    async (pack: IScenePack) => {
      const rules = sceneRulesFor(sourceRef.current.madeBy);
      // Unseen, it waits to be seen before it costs a worker.
      if (!shownRef.current) {
        shelvedRef.current = pack;
        setWaiting(true);
        if (rules.warmWhenUnseen) {
          warmSceneProgram(pack, rules.limited);
        }
        return;
      }
      wantedRef.current = pack;
      // A settings save comes back as a new pack. Keep the running program,
      // textures, clock and limiter; do not even copy its artwork to a worker.
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
        loadedRef.current?.(pack);
        kick();
        return;
      }
      const renderer = rendererRef.current ?? startRenderer();
      if (!renderer) {
        return;
      }
      generationRef.current += 1;
      const generation = generationRef.current;
      buildingRef.current = true;
      // Beside a running picture too: that picture stops moving until the
      // new one is built, which in a busy window is seconds.
      setWaiting(true);
      let result;
      try {
        result = await renderer.load(pack, rules.limited);
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
      drawnAtRef.current = undefined;
      if (result.kind === 'unavailable') {
        dropProgram();
        setWaiting(false);
        sourceRef.current.block();
      } else if (result.kind === 'compile') {
        console.error(
          `Scene "${pack.names.en}" (${pack.id} v${pack.version}) failed to compile:\n${result.log}`,
        );
        // The last version that compiled, if there is one, carries on — and is
        // the one built again should the scene be put away and seen again,
        // rather than the broken one, which left nothing on the stage.
        if (packRef.current) {
          wantedRef.current = packRef.current;
        }
        setWaiting(false);
        sourceRef.current.reportFailure('compile', result.log);
      } else if (result.kind === 'ready') {
        packRef.current = pack;
        readyGenerationRef.current = generation;
        paramsRef.current = Object.fromEntries(
          pack.params.map((param) => [param.id, param.value]),
        );
        const program = `${sourceRef.current.identity}\n${sceneProgramKey(pack)}`;
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
        loadedRef.current?.(pack);
        kick();
      }
    },
    [kick, startRenderer, dropProgram, setWaiting],
  );
  buildRef.current = build;

  // A fresh worker, on a fresh canvas of its own, on every mount/project,
  // including React's development remount — see `createSceneWorkerClient`.
  // Not for a scene mounted where nobody can see it: its first build starts
  // one when it is shown.
  useEffect(() => {
    if (shownRef.current) {
      startRenderer();
    }
    return () => {
      generationRef.current += 1;
      dropProgram();
      packRef.current = null;
      shelvedRef.current = null;
      wantedRef.current = null;
    };
  }, [source.identity, startRenderer, dropProgram]);

  // A different scene starts from the beginning: clock, fade, energy, and a
  // limiter only if who made it calls for one.
  useEffect(() => {
    fadeRef.current = 0;
    clockRef.current = 0;
    energyRef.current = createEnergyState();
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
    sourceRef.current
      .load()
      .then((pack) => {
        if (cancelled) {
          return undefined;
        }
        if (!pack) {
          // Entitlement lapsed between the list and the load, or the scene
          // was removed meanwhile. Session-only; nothing is written down.
          setWaiting(false);
          sourceRef.current.block();
          return undefined;
        }
        return build(pack);
      })
      .catch(() => {
        // The bridge failed, not the shader. Session-only.
        if (!cancelled) {
          setWaiting(false);
          sourceRef.current.block();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source.identity, source.version, build, setWaiting]);

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

  // Redraw the backing buffer when the panel's geometry changes.
  useEffect(() => {
    kick();
  }, [width, height, spectrumRect, kick]);

  return hostRef;
}
