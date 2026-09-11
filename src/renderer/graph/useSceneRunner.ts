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
import {
  compileScene,
  createSceneContext,
  type ISceneFrame,
  type ISceneProgram,
} from './sceneGl';
import type { IFlashGuard } from './sceneFlashGuard';
import type { ICostLadder } from './sceneHealth';
import { createSceneTuner } from './sceneTuner';
import type { ISceneRunnerOptions } from './sceneRunnerTypes';
import { decodeSceneArtwork } from './sceneArtwork';
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
}: ISceneRunnerOptions): RefObject<HTMLCanvasElement | null> {
  const { points, waveform } = useLiveAudioFrame();
  const { isPaused } = useLiveAudioControl();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const programRef = useRef<ISceneProgram | null>(null);
  const guardRef = useRef<IFlashGuard | null>(null);
  const packRef = useRef<IScenePack | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const lostRef = useRef(false);
  const lossesRef = useRef(0);
  const visibleRef = useRef(true);
  const clipRef = useRef<readonly [number, number, number, number]>([
    0, 0, 1, 1,
  ]);
  const generationRef = useRef(0);

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
  const pointsRef = useRef(points);
  pointsRef.current = isPaused ? NO_POINTS : points;
  const waveformSamplesRef = useRef(waveform);
  waveformSamplesRef.current = isPaused ? NO_WAVEFORM : waveform;
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const spectrumRectRef = useRef(spectrumRect);
  spectrumRectRef.current = spectrumRect;

  const playing = !isPaused && points.length > 0;

  const dropProgram = useCallback(() => {
    programRef.current?.dispose();
    programRef.current = null;
  }, []);

  const onFrame = useCallback(
    (deltaMs: number): boolean => {
      const canvas = canvasRef.current;
      const gl = glRef.current;
      const program = programRef.current;
      if (
        !canvas ||
        !gl ||
        !program ||
        lostRef.current ||
        !visibleRef.current ||
        document.hidden
      ) {
        return false;
      }
      const currentPoints = pointsRef.current;
      const isPlaying = currentPoints.length > 0;

      const budget = document.documentElement.classList.contains('is-euphoric')
        ? EUPHORIA_FRAME_MS
        : SMOOTH_FRAME_MS;
      if (
        ladderRef.current.frame(deltaMs, budget, document.hidden) === 'degraded'
      ) {
        // Too slow even at the floor. The source decides what that means: the
        // graph falls back FOR THIS SESSION — a slow session is a fact about
        // the machine right now, not about the pack — and the Studio says so.
        console.error(
          `Scene "${sourceRef.current.name}" ran too slowly even at its smallest size; it stops until the next launch.`,
        );
        dropProgram();
        sourceRef.current.tooSlow();
        return false;
      }

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
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

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
      fillWaveformTexels(waveformSamplesRef.current, waveformRef.current);

      // Ambient travel continues through silence. Energy and beat still
      // receive actual audio; visibility stops this clock before any work.
      clockRef.current =
        (clockRef.current + Math.min(100, deltaMs) / 1000) % SCENE_TIME_WRAP_S;
      // The scene fades in over its first quarter second rather than popping,
      // and the same ramp is what a later crossfade will drive.
      fadeRef.current += (1 - fadeRef.current) * getEaseFactor(deltaMs, 80);

      // Keep full-scene coordinates while the GPU shades only the portion
      // inside the window. Cropping the backing buffer would distort the art.
      const [left, top, right, bottom] = clipRef.current;
      const clipX = Math.floor(left * backingWidth);
      const clipTop = Math.floor(top * backingHeight);
      const clipRight = Math.ceil(right * backingWidth);
      const clipBottom = Math.ceil(bottom * backingHeight);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        clipX,
        backingHeight - clipBottom,
        clipRight - clipX,
        clipBottom - clipTop,
      );

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
      const guard = guardRef.current;
      guard?.begin(backingWidth, backingHeight);
      program.draw(frame, backingWidth, backingHeight);
      guard?.end(deltaMs);
      drawnRef.current?.(frame, scale, program.musicAccent(), shaped);
      return true;
    },
    [dropProgram],
  );

  const kick = useSmoothFrames(onFrame, { isEnabled: true });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let intersects = true;
    const measure = () => {
      const box = canvas.getBoundingClientRect();
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
      }
    };
    const intersection = new IntersectionObserver((entries) => {
      intersects = entries.some((entry) => entry.isIntersecting);
      measure();
    });
    const resize = new ResizeObserver(measure);
    intersection.observe(canvas);
    resize.observe(canvas);
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

  /**
   * Compile `pack` beside whatever is running and swap it in if it compiles.
   * The ladder starts again from its own beginning for every new program: a
   * new version is untested at any size until it has been drawn.
   */
  const build = useCallback(
    async (pack: IScenePack) => {
      const gl = glRef.current;
      if (!gl) {
        return;
      }
      generationRef.current += 1;
      const generation = generationRef.current;
      // A lost context compiles nothing, and that is not the shader's doing.
      // Reporting it as a compile failure would quarantine a good pack.
      if (gl.isContextLost()) {
        sourceRef.current.block();
        return;
      }
      const { createGuard } = sourceRef.current;
      if (createGuard && !guardRef.current) {
        guardRef.current = createGuard(gl);
        if (!guardRef.current) {
          // Without the limiter a member's scene must not run at all.
          sourceRef.current.block();
          return;
        }
      }
      let artwork: ImageBitmap | undefined;
      try {
        artwork = await decodeSceneArtwork(pack);
        if (lostRef.current || generation !== generationRef.current) {
          return;
        }
        const result = compileScene(gl, pack, artwork);
        if (!result.ok) {
          // The sanctioned use of console.error: context a person can act on,
          // before the failure is flattened for the picker.
          console.error(
            `Scene "${pack.names.en}" (${pack.id} v${pack.version}) failed to compile:\n${result.log}`,
          );
          sourceRef.current.reportFailure('compile', result.log);
          return;
        }
        programRef.current?.dispose();
        programRef.current = result.program;
        packRef.current = pack;
        paramsRef.current = Object.fromEntries(
          pack.params.map((param) => [param.id, param.value]),
        );
        ladderRef.current = sourceRef.current.createLadder();
        kick();
      } catch (error) {
        if (!lostRef.current && generation === generationRef.current) {
          console.error(
            `Scene "${pack.names.en}" (${pack.id} v${pack.version}) artwork failed:`,
            error,
          );
          sourceRef.current.reportFailure('compile', String(error));
        }
      } finally {
        artwork?.close();
      }
    },
    [kick],
  );

  // The context: made once per canvas, and never released — `getContext` on
  // the same element hands back the same context, and one told to lose itself
  // stays lost, so a remount (which React does in development) got a dead
  // context, "failed to compile", and a good pack was quarantined for good.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const gl = createSceneContext(canvas);
    if (!gl) {
      // No context right now is the machine's condition, not the pack's fault.
      sourceRef.current.block();
      return undefined;
    }
    glRef.current = gl;
    lostRef.current = false;
    lossesRef.current = 0;

    const onLost = (event: Event) => {
      // Without this the restored event never fires. Not optional.
      event.preventDefault();
      lostRef.current = true;
      generationRef.current += 1;
      // The objects are already invalid; only the bookkeeping is ours.
      programRef.current = null;
      guardRef.current = null;
      lossesRef.current += 1;
      // Twice in one session is a scene that keeps resetting the GPU.
      if (lossesRef.current >= 2) {
        sourceRef.current.reportFailure('context-lost');
      }
    };
    const onRestored = () => {
      if (lossesRef.current >= 2) {
        return;
      }
      lostRef.current = false;
      if (packRef.current) {
        build(packRef.current);
      }
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      dropProgram();
      guardRef.current?.dispose();
      guardRef.current = null;
      packRef.current = null;
      glRef.current = null;
    };
  }, [build, dropProgram]);

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
    dropProgram();
    packRef.current = null;
    guardRef.current?.dispose();
    guardRef.current = null;
    lossesRef.current = 0;
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

  return canvasRef;
}
