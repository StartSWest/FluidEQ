/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAX_GAIN } from 'common/constants';
import {
  AMBIENT_CEILING,
  ambientElementsAt,
  type IAmbientElement,
} from 'common/sceneAmbient';
import type { IScenePack } from 'common/scenePacks';
import { getEaseFactor } from 'common/smoothing';
import { advanceEnergy, createEnergyState } from 'common/spectrumEnergy';
import { useLiveAudioControl } from '../audio/LiveAudioContext';
import type { TDrawableScene } from '../graph/SceneCanvas';
import { NO_POINTS } from '../graph/liveSpectrumFrames';
import { useSceneLook } from '../utils/graphStyle';
import {
  loadMemberScene,
  type IUsableMemberScene,
} from '../utils/memberScenes';
import { loadScenePack } from '../utils/scenePacks';
import {
  useSceneTintMode,
  useStudioTintMode,
  useStudioTintSource,
} from '../utils/sceneTintStore';
import {
  createAmbientField,
  resizeAmbientField,
  stepAmbientField,
  updateAmbientElements,
  type IAmbientField,
  type IAmbientMusicLevels,
} from './ambientField';
import { paintAmbient } from './ambientPaint';
import { cutAmbientPictures, type TAmbientPictures } from './ambientPictures';
import { useStudioAmbientValues } from './ambientStore';
import { visualizerBoxes } from './visualizerSurfaces';
import '../styles/SceneAmbient.scss';

type TAmbientSource = 'graph' | 'studio';

const NO_PICTURES: TAmbientPictures = new Map();
const FADE_IN_MS = 700;
const FADE_OUT_MS = 350;
const RISE_MS = 90;
const FALL_MS = 520;

const isMemberScene = (scene: TDrawableScene): scene is IUsableMemberScene =>
  'kind' in scene && scene.kind === 'member';

const loadDrawable = (scene: TDrawableScene) =>
  isMemberScene(scene)
    ? loadMemberScene(scene.lookId)
    : loadScenePack(scene.id);

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A visualizer's own elements in the window around it, while the window takes
 * that visualizer's Ambient mode: Alpine's birds crossing the app, Floración's
 * petals wandering behind the panes, a city's stars.
 *
 * What to draw is the scene's (`sceneAmbient.ts`), as data and never as code;
 * how it is drawn is this engine's, and held to a ceiling a scene cannot lift:
 * a few dozen small shapes, screened over the window at a fraction of their
 * colour so they lift the dark panes a little and cover no word, easing up
 * and down with the music rather than flashing, kept off every visualizer in
 * the window — the scene already draws its world in its own box, and a bird
 * over the graph or a scene's picture is on top of what somebody came to see
 * (`visualizerSurfaces.ts`) — and gone for anyone who asked the app for
 * reduced motion.
 *
 * One canvas over the window, drawn by animation frames, which the browser
 * stops for a hidden window: nothing counts time here. Each shape is copied
 * from a small picture made once (`ambientSprites.ts`).
 *
 * The same precedence as the window's colour and light: the Studio's project
 * while it owns the window, the graph's look otherwise.
 */
export default function SceneAmbient() {
  const graphMode = useSceneTintMode();
  const studioMode = useStudioTintMode();
  const studio = useStudioTintSource();
  const scene = useSceneLook();
  const studioValues = useStudioAmbientValues();
  const { readFrame, isPaused } = useLiveAudioControl();
  const [reduced, setReduced] = useState(prefersReducedMotion);

  let source: TAmbientSource | undefined;
  if (studio) {
    source = studioMode === 'pulse' ? 'studio' : undefined;
  } else if (graphMode === 'pulse' && scene) {
    source = 'graph';
  }

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);

  // The graph's pack, loaded for its ambient layer alone: the graph may be on
  // another tab and have loaded nothing.
  const identity =
    source === 'graph' && scene
      ? `${isMemberScene(scene) ? scene.lookId : scene.id}@${
          scene.revision ?? scene.version
        }`
      : '';
  const [graphPack, setGraphPack] = useState<IScenePack>();
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  useEffect(() => {
    const drawable = sceneRef.current;
    if (!identity || !drawable) {
      setGraphPack(undefined);
      return undefined;
    }
    let cancelled = false;
    loadDrawable(drawable)
      .then((pack) => {
        if (!cancelled) {
          setGraphPack(pack);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) {
          setGraphPack(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [identity]);

  const pack = source === 'studio' ? studio?.playing?.pack : graphPack;
  const ambient = source && !reduced ? pack?.ambient : undefined;
  const elements = useMemo(
    () =>
      ambient
        ? ambientElementsAt(
            ambient,
            source === 'studio' ? studioValues : undefined,
          )
        : undefined,
    [ambient, source, studioValues],
  );

  // The poses of its pictures, cut from the scene's artwork when what they
  // are cut from changes — not when a control changes how many fly, and not
  // when a Studio save hands over the same pack again. Until they are cut the
  // pictures are simply not drawn; when the scene goes, the last ones stay
  // for the fade.
  const pictureFrames = useMemo(
    () =>
      JSON.stringify(
        (ambient?.elements ?? [])
          .filter((element) => element.shape === 'picture')
          .map((element) => [element.id, element.frames]),
      ),
    [ambient],
  );
  const artworkData = ambient ? pack?.artwork?.data : undefined;
  const cutFromRef = useRef({ ambient, artwork: pack?.artwork });
  cutFromRef.current = { ambient, artwork: pack?.artwork };
  const picturesRef = useRef<TAmbientPictures>(NO_PICTURES);
  useEffect(() => {
    const { ambient: cutting, artwork } = cutFromRef.current;
    if (!cutting) {
      return undefined;
    }
    picturesRef.current = NO_PICTURES;
    const controller = new AbortController();
    cutAmbientPictures(artwork, cutting.elements, controller.signal)
      .then((cut) => {
        picturesRef.current = cut;
        return undefined;
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          // eslint-disable-next-line no-console -- the only trace of pictures that could not be cut; the layer plays on without them
          console.error('Could not cut the scene ambient pictures', error);
        }
      });
    return () => {
      controller.abort();
    };
  }, [pictureFrames, artworkData]);

  // What is still on screen while it fades out after its scene has gone.
  const [lingering, setLingering] = useState<IAmbientElement[]>();
  useEffect(() => {
    if (elements) {
      setLingering(elements);
    }
  }, [elements]);
  const shown = elements ?? lingering;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wantedRef = useRef(elements);
  wantedRef.current = elements;
  const readFrameRef = useRef(readFrame);
  readFrameRef.current = readFrame;
  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;

  const running = Boolean(shown);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!running || !canvas || !context) {
      return undefined;
    }
    let ratio = 1;
    let width = 0;
    let height = 0;
    const fit = () => {
      ratio = Math.min(1.5, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
    };
    fit();

    let field: IAmbientField | undefined;
    let playing: IAmbientElement[] | undefined;
    let fade = 0;
    let last: number | undefined;
    const energy = createEnergyState();
    const levels: IAmbientMusicLevels = {
      level: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      beat: 0,
    };

    const onResize = () => {
      fit();
      if (field) {
        field = resizeAmbientField(field, width, height);
      }
    };
    window.addEventListener('resize', onResize);

    let animation = 0;
    const draw = (now: number) => {
      const elapsed = last === undefined ? 16 : now - last;
      last = now;
      const wanted = wantedRef.current;
      fade +=
        ((wanted ? 1 : 0) - fade) *
        getEaseFactor(elapsed, wanted ? FADE_IN_MS / 3 : FADE_OUT_MS / 3);
      if (!wanted && fade < 0.01) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        setLingering(undefined);
        return;
      }
      if (wanted && wanted !== playing) {
        field = field
          ? updateAmbientElements(field, wanted)
          : createAmbientField(wanted, width, height);
        playing = wanted;
      }
      if (!field) {
        animation = requestAnimationFrame(draw);
        return;
      }

      // The music as it is now; nothing while paused or sent from elsewhere.
      const heard = pausedRef.current ? undefined : readFrameRef.current();
      const points = heard?.points ?? NO_POINTS;
      // The window's own reading of the music, the one every drawing in it
      // reads (`liveSound.ts`); without it, measured here from the points.
      const bands = heard?.sound
        ? heard.sound.music()
        : advanceEnergy(energy, points, MAX_GAIN, elapsed, points.length > 0);
      (Object.keys(levels) as (keyof IAmbientMusicLevels)[]).forEach((key) => {
        const target = bands[key];
        levels[key] +=
          (target - levels[key]) *
          getEaseFactor(elapsed, target > levels[key] ? RISE_MS : FALL_MS);
      });

      const placed = stepAmbientField(field, elapsed, levels);

      paintAmbient({
        context,
        elements: field.elements,
        placed,
        pictures: picturesRef.current,
        ratio,
        width,
        height,
        fade,
        boxes: visualizerBoxes(width, height),
      });
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener('resize', onResize);
    };
  }, [running]);

  if (!shown) {
    return null;
  }
  return createPortal(
    // The ceiling lives HERE, on the whole layer, and not on each shape. The
    // shapes are drawn into this one canvas before it is screened over the
    // window, so a per-shape limit never bounded what two of them on the same
    // spot were worth — see `MAX_ALPHA` in `ambientField.ts` for the measured
    // numbers. Capping the canvas makes any number of shapes worth no more
    // than a solid one at the ceiling, and leaves a single shape exactly
    // where it was.
    //
    // Inline rather than in the stylesheet because the number is
    // `AMBIENT_CEILING`, which the rules, the checker and the maker's AI all
    // read from one place; a copy in SCSS is a copy that drifts.
    <canvas
      ref={canvasRef}
      className="scene-ambient"
      style={{ opacity: AMBIENT_CEILING }}
      aria-hidden="true"
    />,
    document.body,
  );
}
