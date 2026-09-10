import { useCallback, useEffect, useRef } from 'react';
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
  blockScene,
  loadScenePack,
  reportSceneFailure,
  type IUsableScene,
} from '../utils/scenePacks';
import {
  compileScene,
  createSceneContext,
  type ISceneProgram,
} from './sceneGl';
import { createCostLadder } from './sceneHealth';
import { decodeSceneArtwork } from './sceneArtwork';
import {
  createSpectrumTexels,
  createWaveformTexels,
  fillSpectrumTexels,
  fillWaveformTexels,
  parseAccent,
} from './sceneUniforms';

interface ISceneCanvasProps {
  scene: IUsableScene;
  /** The full panel, including the toolbar and axis gutters. */
  width: number;
  height: number;
  spectrumRect: readonly [number, number, number, number];
}

/**
 * A premium look, drawn on the GPU.
 *
 * A sibling of `LiveTraceCanvas` and mounted INSTEAD of it, never alongside:
 * two canvases painting the same region is double the fill for a picture that
 * is worse, and the 2D trace's glow and accent logic mean nothing inside a
 * shader. It copies the 2D canvas's contract exactly — it subscribes to the
 * live frame itself and draws outside React, so nothing above it re-renders at
 * frame rate.
 *
 * EVERY FAILURE PATH IS THE SAME PATH. A shader that will not compile, a GPU
 * context lost, a machine too slow at half resolution — each reports the scene
 * unusable to the pack store, `useSceneLook` answers null, and the chart mounts
 * the 2D canvas with the look it already holds. Nothing here draws an error;
 * the fallback form is the error state, and it is a working visualizer.
 *
 * NOTHING COUNTS DOWN. Recovery from a lost context hangs off the
 * `webglcontextrestored` event and nothing else. Ambient motion continues in
 * silence; hiding or minimizing the window stops the frame loop entirely.
 */
export default function SceneCanvas({
  scene,
  width,
  height,
  spectrumRect,
}: ISceneCanvasProps) {
  const { points, waveform } = useLiveAudioFrame();
  const { isPaused } = useLiveAudioControl();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const programRef = useRef<ISceneProgram | null>(null);
  const packRef = useRef<IScenePack | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const lostRef = useRef(false);
  const lossesRef = useRef(0);
  const visibleRef = useRef(true);
  const clipRef = useRef<readonly [number, number, number, number]>([
    0, 0, 1, 1,
  ]);

  const energyRef = useRef(createEnergyState());
  const spectrumRef = useRef(createSpectrumTexels());
  const waveformRef = useRef(createWaveformTexels());
  const ladderRef = useRef(createCostLadder());
  const clockRef = useRef(0);
  const fadeRef = useRef(0);
  const accentRef = useRef(parseAccent(''));
  const paramsRef = useRef<Record<string, number>>({});

  // Refs rather than closure captures, so the frame loop reads the newest
  // measurement without being torn down and rebuilt twenty-two times a second.
  const pointsRef = useRef(points);
  pointsRef.current = isPaused ? NO_POINTS : points;
  const waveformSamplesRef = useRef(waveform);
  waveformSamplesRef.current = isPaused ? NO_WAVEFORM : waveform;
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const spectrumRectRef = useRef(spectrumRect);
  spectrumRectRef.current = spectrumRect;

  const playing = !isPaused && points.length > 0;

  const giveUp = useCallback(
    (reason: 'compile' | 'context-lost') => {
      programRef.current?.dispose();
      programRef.current = null;
      reportSceneFailure(scene.id, reason).catch(() => undefined);
    },
    [scene.id],
  );

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
        // Too slow even at the floor. Hand over to the 2D fallback FOR THIS
        // SESSION — not to the quarantine on disk. A slow session is a fact
        // about the machine right now (a development build, a window across
        // two displays, something else hogging the GPU), not about the pack,
        // and the first version of this line quarantined every look the picker
        // visited on a slow afternoon, permanently, one by one.
        console.error(
          `Scene "${scene.names.en}" (${scene.id}) ran too slowly even at half resolution; showing its free form until the next launch.`,
        );
        programRef.current?.dispose();
        programRef.current = null;
        blockScene(scene.id);
        return false;
      }

      // Sized inside the loop, as the 2D canvas is, because the pixel ratio is
      // not only a property of the element: dragging the window onto a display
      // with a different scale changes it with nothing to observe. The old
      // 1080-row cap enlarged a smaller image on a 1440p display, blurring
      // antialiased details. Use display pixels up to a 4K pixel budget; the
      // cost ladder still lowers resolution when the measured work is slow.
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
      program.draw(
        {
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
        },
        backingWidth,
        backingHeight,
      );
      return true;
    },
    [scene.id, scene.names.en],
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

  // The pack, the context and the program — built once per scene, torn down
  // when the scene or its signed version changes, or the canvas leaves.
  // Refreshing a pack used to keep drawing its old program until the user
  // chose another look because this effect only tracked the scene id.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let cancelled = false;
    let buildGeneration = 0;
    lostRef.current = false;
    lossesRef.current = 0;
    ladderRef.current.reset();
    fadeRef.current = 0;
    clockRef.current = 0;
    energyRef.current = createEnergyState();
    accentRef.current = parseAccent(
      getComputedStyle(document.documentElement).getPropertyValue('--accent'),
    );

    const gl = createSceneContext(canvas);
    if (!gl) {
      // No context right now is the machine's condition, not the pack's fault:
      // fall back for this session and let the next launch try again.
      blockScene(scene.id);
      return undefined;
    }
    glRef.current = gl;

    const build = async (pack: IScenePack) => {
      buildGeneration += 1;
      const generation = buildGeneration;
      // A lost context compiles nothing, and that is not the shader's doing.
      // Reporting it as a compile failure would quarantine a good pack — which
      // is exactly what happened when a released context was handed back by
      // `getContext` on the very next mount.
      if (gl.isContextLost()) {
        blockScene(scene.id);
        return;
      }
      let artwork: ImageBitmap | undefined;
      try {
        artwork = await decodeSceneArtwork(pack);
        if (cancelled || lostRef.current || generation !== buildGeneration) {
          return;
        }
        const result = compileScene(gl, pack, artwork);
        if (!result.ok) {
          // The sanctioned use of console.error: context a person can act on,
          // before the failure is flattened into "shown the free form instead".
          console.error(
            `Scene "${pack.names.en}" (${pack.id} v${pack.version}) failed to compile:\n${result.log}`,
          );
          giveUp('compile');
          return;
        }
        programRef.current?.dispose();
        programRef.current = result.program;
        paramsRef.current = Object.fromEntries(
          pack.params.map((param) => [param.id, param.value]),
        );
        kick();
      } catch (error) {
        if (!cancelled && !lostRef.current && generation === buildGeneration) {
          console.error(
            `Scene "${pack.names.en}" (${pack.id} v${pack.version}) artwork failed:`,
            error,
          );
          giveUp('compile');
        }
      } finally {
        artwork?.close();
      }
    };

    const onLost = (event: Event) => {
      // Without this the restored event never fires. Not optional.
      event.preventDefault();
      lostRef.current = true;
      buildGeneration += 1;
      // The objects are already invalid; only the bookkeeping is ours.
      programRef.current = null;
      lossesRef.current += 1;
      // Twice in one session is a scene that keeps resetting the GPU, and the
      // second loss is the event that decides it is not one to keep offering.
      if (lossesRef.current >= 2) {
        giveUp('context-lost');
      }
    };
    const onRestored = () => {
      if (cancelled || lossesRef.current >= 2) {
        return;
      }
      lostRef.current = false;
      if (packRef.current) {
        build(packRef.current);
      }
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    loadScenePack(scene.id)
      .then((pack) => {
        if (cancelled) {
          return undefined;
        }
        if (!pack) {
          // Entitlement lapsed between the list and the load, or the pack was
          // quarantined meanwhile. Nothing about the pack itself is known to be
          // wrong, so this falls back for the session and writes nothing down.
          blockScene(scene.id);
          return undefined;
        }
        packRef.current = pack;
        build(pack);
        return undefined;
      })
      .catch(() => {
        // The bridge failed, not the shader. Session-only.
        if (!cancelled) {
          blockScene(scene.id);
        }
      });

    return () => {
      cancelled = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      programRef.current?.dispose();
      programRef.current = null;
      packRef.current = null;
      glRef.current = null;
      // The context is deliberately NOT released here. `getContext` on the same
      // element hands back the same context, and once one has been told to
      // lose itself it stays lost — so a remount (which React does in
      // development) got a dead context, "failed to compile", and the pack was
      // quarantined for good. The element leaves the tree with this component
      // and Chromium reclaims its context with it.
    };
  }, [scene.id, scene.version, giveUp, kick]);

  // Audio can wake a ready scene, but cannot restart hidden rendering.
  useEffect(() => {
    if (playing && visibleRef.current && !document.hidden) {
      kick();
    }
  }, [playing, kick, points]);

  // The SVG's margins left an unpainted frame on all four sides. The scene
  // owns the panel instead; redraw its backing buffer when its geometry changes.
  useEffect(() => {
    kick();
  }, [width, height, spectrumRect, kick]);

  return (
    <canvas
      ref={canvasRef}
      className="chart-scene-canvas"
      aria-hidden="true"
      style={{ width, height }}
    />
  );
}
