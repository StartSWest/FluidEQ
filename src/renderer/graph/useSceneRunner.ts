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
import useSmoothFrames from 'renderer/utils/useSmoothFrames';
import {
  useLiveAudioControl,
  useLiveAudioFrame,
} from '../audio/LiveAudioContext';
import { NO_POINTS, NO_WAVEFORM } from './liveSpectrumFrames';
import type { ISceneFrame } from './sceneGl';
import type { ICostLadder } from './sceneHealth';
import { createSceneTuner } from './sceneTuner';
import { sameSceneProgramInputs } from './sceneProgramInputs';
import type { ISceneRunnerOptions } from './sceneRunnerTypes';
import {
  createSceneWorkerClient,
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
}: ISceneRunnerOptions): RefObject<HTMLDivElement | null> {
  const { points, waveform } = useLiveAudioFrame();
  const { isPaused, readFrame } = useLiveAudioControl();
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
            sourceRef.current.tooSlow();
            return;
          }
          drawnRef.current?.(frame, scale, accent, shaped);
        },
      );
      return true;
    },
    [dropProgram],
  );

  const kick = useSmoothFrames(onFrame, { isEnabled: true });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    let intersects = true;
    const measure = () => {
      const box = host.getBoundingClientRect();
      const left = Math.max(0, -box.left);
      const top = Math.max(0, -box.top);
      const right = Math.min(box.width, window.innerWidth - box.left);
      const bottom = Math.min(box.height, window.innerHeight - box.top);
      visibleRef.current =
        intersects && !document.hidden && right > left && bottom > top;
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
    const intersection = new IntersectionObserver((entries) => {
      intersects = entries.some((entry) => entry.isIntersecting);
      measure();
    });
    const resize = new ResizeObserver(measure);
    intersection.observe(host);
    resize.observe(host);
    document.addEventListener('visibilitychange', measure);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      intersection.disconnect();
      resize.disconnect();
      document.removeEventListener('visibilitychange', measure);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [width, height, kick]);

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
          if (reason === 'context-lost') {
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
      sourceRef.current.block();
    }
    return rendererRef.current;
  }, [dropProgram, kick]);

  /** A worker prepares the next scene while the interface remains available. */
  const build = useCallback(
    async (pack: IScenePack) => {
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
        sourceRef.current.block();
      } else if (result.kind === 'compile') {
        console.error(
          `Scene "${pack.names.en}" (${pack.id} v${pack.version}) failed to compile:\n${result.log}`,
        );
        sourceRef.current.reportFailure('compile', result.log);
      } else if (result.kind === 'ready') {
        packRef.current = pack;
        paramsRef.current = Object.fromEntries(
          pack.params.map((param) => [param.id, param.value]),
        );
        if (result.rebuilt) {
          ladderRef.current = sourceRef.current.createLadder();
        }
        loadedRef.current?.(pack);
        kick();
      }
    },
    [kick, startRenderer, dropProgram],
  );

  // A fresh worker, on a fresh canvas of its own, on every mount/project,
  // including React's development remount — see `createSceneWorkerClient`.
  useEffect(() => {
    startRenderer();
    return () => {
      generationRef.current += 1;
      dropProgram();
      packRef.current = null;
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
          // Entitlement lapsed between the list and the load, or the pack was
          // quarantined meanwhile. Session-only; nothing is written down.
          sourceRef.current.block();
          return undefined;
        }
        return build(pack);
      })
      .catch(() => {
        // The bridge failed, not the shader. Session-only.
        if (!cancelled) {
          sourceRef.current.block();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source.identity, source.version, build]);

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
