import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import type { IScenePack } from 'common/scenePacks';
import { SCENE_TIME_WRAP_S } from 'common/sceneUniformContract';
import {
  EUPHORIA_FRAME_MS,
  SMOOTH_FRAME_MS,
  getEaseFactor,
} from 'common/smoothing';
import { advanceEnergy, createEnergyState } from 'common/spectrumEnergy';
import observeShown from 'renderer/utils/observeShown';
import useSmoothFrames from 'renderer/utils/useSmoothFrames';
import { useSceneAudio } from '../audio/SceneAudioContext';
import { NO_POINTS, NO_WAVEFORM } from './liveSpectrumFrames';
import type { ISceneFrame } from './sceneGl';
import type { ICostLadder } from './sceneHealth';
import { createSceneTuner } from './sceneTuner';
import { sceneProgramKey } from './sceneLinkTurns';
import { sameSceneProgramInputs } from './sceneProgramInputs';
import type { ISceneRunnerOptions } from './sceneRunnerTypes';
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
  onDrawn,
  onLoaded,
  onWaiting,
}: ISceneRunnerOptions): RefObject<HTMLDivElement | null> {
  const { points, waveform, isPaused, readFrame } = useSceneAudio();
  // What the scene is drawn inside: each worker puts a canvas of its own here.
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ISceneWorkerClient | undefined>(undefined);
  const packRef = useRef<IScenePack | null>(null);
  const drawnAtRef = useRef<number | undefined>(undefined);
  const visibleRef = useRef(true);
  const clipRef = useRef<readonly [number, number, number, number]>([
    0, 0, 1, 1,
  ]);
  const generationRef = useRef(0);
  const buildingRef = useRef(false);

  const energyRef = useRef(createEnergyState());
  const spectrumRef = useRef(createSpectrumTexels());
  const waveformRef = useRef(createWaveformTexels());
  const ladderRef = useRef<ICostLadder>(source.createLadder());
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
        document.hidden
      ) {
        drawnAtRef.current = undefined;
        return false;
      }
      if (!renderer.canDraw()) {
        return true;
      }
      const now = performance.now();
      const deltaMs =
        drawnAtRef.current === undefined ? elapsedMs : now - drawnAtRef.current;
      drawnAtRef.current = now;
      // The music as it is at this frame, not at the pump's last tick, which
      // was 16 ms stale at the median. Paused, sent from another PC or not
      // capturing, it answers nothing and the React frame stands.
      const fresh = readFrameRef.current();
      const currentPoints = fresh ? fresh.points : pointsRef.current;
      const currentWaveform = fresh
        ? fresh.waveform
        : waveformSamplesRef.current;
      const isPlaying = currentPoints.length > 0;

      const budget = document.documentElement.classList.contains('is-euphoric')
        ? EUPHORIA_FRAME_MS
        : SMOOTH_FRAME_MS;

      // Sized inside the loop, as the 2D canvas is, because the pixel ratio is
      // not only a property of the element: dragging the window onto a display
      // with a different scale changes it with nothing to observe. Display
      // pixels up to a 4K pixel budget; the ladder lowers it when work is slow.
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const scale = ladderRef.current.scale();
      const { width: cssWidth, height: cssHeight } = sizeRef.current;
      const pixelCap = Math.min(
        1,
        Math.sqrt(
          (3840 * 2160) / Math.max(1, cssWidth * cssHeight * ratio * ratio),
        ),
      );
      const backingWidth = Math.max(
        1,
        Math.round(cssWidth * ratio * scale * pixelCap),
      );
      const backingHeight = Math.max(
        1,
        Math.round(cssHeight * ratio * scale * pixelCap),
      );

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

      // Ambient travel continues through silence. Energy and beat still
      // receive actual audio; visibility stops this clock before any work.
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
        accent: accentRef.current,
        fade: fadeRef.current,
        spectrum: spectrumRef.current,
        spectrumRect: spectrumRectRef.current,
        waveform: waveformRef.current,
        params: paramsRef.current,
      };
      const shaped = shapeRef.current ? shapeRef.current(heard) : heard;
      const frame = tunerRef.current.apply(
        shaped,
        deltaMs,
        packRef.current,
        paramsRef.current,
        tuningRef.current,
      );
      const ladder = ladderRef.current;
      const drawnGeneration = readyGenerationRef.current;
      renderer.draw(
        frame,
        backingWidth,
        backingHeight,
        clipRef.current,
        (accent, costMs) => {
          // Judged by what the frame cost the GPU, not by how long the page
          // took between frames: see the worker's draw.
          if (
            ladder === ladderRef.current &&
            ladder.frame(costMs, budget, document.hidden) === 'degraded'
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
          // Its first frame with anything in it: a fade still at zero is black.
          if (drawnGeneration === generationRef.current && frame.fade > 0) {
            setWaiting(false);
          }
          drawnRef.current?.(frame, scale, accent, shaped);
        },
      );
      return true;
    },
    [dropProgram, setWaiting],
  );

  const kick = useSmoothFrames(onFrame, { isEnabled: true });

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
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      stopObserving();
      resize.disconnect();
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
          ladderRef.current = sourceRef.current.createLadder();
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
      // Unseen, it waits to be seen before it costs a worker.
      if (!shownRef.current) {
        shelvedRef.current = pack;
        setWaiting(true);
        if (sourceRef.current.warmWhenUnseen) {
          warmSceneProgram(pack, Boolean(sourceRef.current.createGuard));
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
        result = await renderer.load(
          pack,
          Boolean(sourceRef.current.createGuard),
        );
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
          ladderRef.current = sourceRef.current.createLadder();
          ladderProgramRef.current = program;
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
  // limiter only if this one asks for it.
  useEffect(() => {
    fadeRef.current = 0;
    clockRef.current = 0;
    energyRef.current = createEnergyState();
    tunerRef.current.reset();
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
    if (playing && visibleRef.current && !document.hidden) {
      kick();
    }
  }, [playing, kick, points]);

  // Redraw the backing buffer when the panel's geometry changes.
  useEffect(() => {
    kick();
  }, [width, height, spectrumRect, kick]);

  return hostRef;
}
