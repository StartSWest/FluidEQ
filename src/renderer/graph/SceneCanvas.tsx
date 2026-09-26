import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { sceneMakerOf } from 'common/sceneMaker';
import type { IScenePack } from 'common/scenePacks';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import { reportOwnParams, useListenerParams } from '../utils/sceneParamStore';
import {
  reportOwnResponse,
  useListenerResponse,
} from '../utils/sceneResponseStore';
import {
  blockScene,
  loadScenePack,
  reportSceneFailure,
  type IUsableScene,
} from '../utils/scenePacks';
import {
  blockMemberScene,
  loadMemberScene,
  reportMemberSceneFailure,
  type IUsableMemberScene,
} from '../utils/memberScenes';
import { useWatchedSceneWave } from '../utils/sceneWaveStore';
import useMovableContainer from '../utils/useMovableContainer';
import { studioSpectrumRect } from '../studio/studioWave';
import type { ISceneFrame } from './sceneGl';
import type { ISceneDrawReport } from './sceneRunnerTypes';
import { forgetSceneDraw, reportSceneDraw } from '../utils/sceneDrawStats';
import { reportScenePlayed } from './sceneUpdateStore';
import useSceneRunner, { type ISceneSource } from './useSceneRunner';
import { reportSceneBeat, reportSceneLeft } from '../utils/scenePulse';
import { useHoldGraphAutoCycle } from '../utils/graphAutoCycle';
import { createSceneInteraction } from './sceneInteraction';
import { FULL_VIEW, sceneViewOf, type TSceneView } from './sceneView';
import { publishGraphSceneRun, type IScenePlot } from './graphScenePlace';

export type TDrawableScene = IUsableScene | IUsableMemberScene;

interface ISceneCanvasProps {
  scene: TDrawableScene;
  /**
   * Where the canvas stands (`graphScenePlace`): the plot's own slot, or a
   * layer of the window — the Backdrop, the EQ column's — the size of that
   * layer, with the plot still its frame (`sceneView.ts`). A new one moves
   * the canvas there; it never makes another.
   */
  target: HTMLElement;
  /**
   * The graph's plot, while it is on screen and draws this scene. Absent,
   * the scene carries on as the plot last framed it.
   */
  plot: IScenePlot | undefined;
}

/** The canvas the scene is drawn on and where its panel stands on it. */
interface ICoverFrame {
  width: number;
  height: number;
  view: TSceneView;
}

// A hundredth of a pixel on a wide window: a resize observer's fractional
// boxes change by less than that without anything having moved.
const VIEW_EPSILON = 1e-5;

const isSameCover = (a: ICoverFrame | undefined, b: ICoverFrame): boolean =>
  a !== undefined &&
  a.width === b.width &&
  a.height === b.height &&
  a.view.every(
    (value, index) => Math.abs(value - b.view[index]) < VIEW_EPSILON,
  );

const isMemberScene = (scene: TDrawableScene): scene is IUsableMemberScene =>
  'kind' in scene && scene.kind === 'member';

/** What a scene is drawn as: a new one starts the clock and the fade again. */
export const sceneIdentityOf = (scene: TDrawableScene): string =>
  isMemberScene(scene) ? scene.lookId : scene.id;

/**
 * The graph's Plus look, or a member's scene, drawn on the GPU — one renderer
 * for it, above the pages (`GraphScene`), wherever it is drawn.
 *
 * Drawn INSTEAD of the plot's 2D trace, never alongside: two canvases
 * painting the same region is double the fill for a picture that is worse.
 * The loop itself is `useSceneRunner`; what this decides is where the scene
 * comes from, what failing means for it, and where its canvas stands.
 *
 * EVERY FAILURE PATH IS THE SAME PATH. A shader that will not compile, a GPU
 * context lost, a machine too slow at the ladder's floor — each reports the
 * scene unusable to its store, `useSceneLook` answers null, and the chart
 * mounts the 2D canvas with the scene's own fallback form. Nothing here draws
 * an error; the fallback form is the error state, and it is a working
 * visualizer.
 *
 * How it is run — its size ladder, the brightness limiter, whether it is
 * compiled ahead — follows from who made it (`sceneRules.ts`), exactly as it
 * does on the desktop, in the Library's player and on the Studio's stage.
 */
export default function SceneCanvas({
  scene,
  target,
  plot,
}: ISceneCanvasProps) {
  const member = isMemberScene(scene);
  // A scene this listener made is one they have watched: the source says so
  // below, and the runner alone decides what follows (`sceneRules.ts`).
  const madeBy = sceneMakerOf({ member, own: member && scene.own });
  const key = sceneIdentityOf(scene);
  const version = scene.revision ?? String(scene.version);
  const name = scene.names.en;
  const source = useMemo<ISceneSource>(
    () =>
      member
        ? {
            identity: key,
            version: String(version),
            name,
            load: () => loadMemberScene(key),
            block: () => blockMemberScene(key),
            reportFailure: (reason) => {
              reportMemberSceneFailure(key, reason).catch(() => undefined);
            },
            tooSlow: () => blockMemberScene(key),
            madeBy,
          }
        : {
            identity: key,
            version: String(version),
            name,
            load: () => loadScenePack(key),
            block: () => blockScene(key),
            reportFailure: (reason) => {
              reportSceneFailure(key, reason).catch(() => undefined);
            },
            // A slow session is a fact about the machine right now, not about
            // the pack: fall back until the next launch, write nothing down.
            tooSlow: () => blockScene(key),
            madeBy,
          },
    [member, madeBy, key, version, name],
  );

  // The music it answers, held open here as well as by the plot: off the
  // graph's page, in the Backdrop, nothing else may be listening.
  useLiveAudioCapture(true);

  // Which scene has drawn its first frame. Kept by identity, because the
  // next look is handed to this same canvas and starts from nothing again; a
  // new version of the same scene is swapped in place and stays settled.
  const [drawnIdentity, setDrawnIdentity] = useState<string>();
  const drawnRef = useRef<string | undefined>(undefined);
  // The automatic switching counts a look's time from its first frame, not
  // from the moment it was chosen (`graphAutoCycle.ts`).
  useHoldGraphAutoCycle(drawnIdentity !== key);
  // Where the window's pulse starts from: the plot's panel while there is
  // one, the middle of the window while the scene is only the Backdrop.
  const panel = plot?.panel;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const onDrawn = useCallback(
    (
      frame: ISceneFrame,
      _scale: number,
      _accent: number,
      _heard: ISceneFrame,
      report: ISceneDrawReport,
    ) => {
      if (frame.fade > 0 && drawnRef.current !== key) {
        drawnRef.current = key;
        setDrawnIdentity(key);
      }
      // The window beats on the beats this scene is drawing, when the
      // graph's mode asks it to (`ScenePulse.tsx`).
      reportSceneBeat('graph', frame, panelRef.current);
      // And the Processes dialog says what it is costing.
      reportSceneDraw('graph', name, report);
    },
    [key, name],
  );
  // The window's light goes with the graph's scene when it stops being drawn
  // anywhere. Not when the look changes: the next scene is drawn in this same
  // place and carries the light on.
  useEffect(
    () => () => {
      reportSceneLeft('graph');
      forgetSceneDraw('graph');
    },
    [],
  );

  // The listener's own attack and release for this visualizer, from the
  // graph's menu, over the timing its pack came with.
  const { lookId } = scene;
  const chosen = useListenerResponse(lookId);
  // And the visualizer's own controls, from the same menu.
  const chosenParams = useListenerParams(lookId);
  const tuning = useMemo(
    () =>
      chosen || chosenParams
        ? {
            ...(chosen ? { response: chosen } : {}),
            ...(chosenParams ? { params: chosenParams } : {}),
          }
        : undefined,
    [chosen, chosenParams],
  );
  const authorId = isMemberScene(scene) ? scene.authorId : undefined;
  const onLoaded = useCallback(
    (pack: IScenePack) => {
      reportOwnResponse(lookId, pack.response);
      // What the menu draws a row from: the controls this pack declares.
      reportOwnParams(lookId, pack.params);
      // Every version that becomes the drawn one, an update swapped in place
      // included: the picker's "new" marks and the graph's one notice.
      reportScenePlayed({
        lookId,
        version: pack.version,
        names: pack.names,
        ...(authorId ? { authorId } : {}),
      }).catch(() => undefined);
    },
    [lookId, authorId],
  );

  // The viewer's hands on the scene: a camera to turn where the scene has
  // one, the pointer and taps where it answers them. One for the life of the
  // renderer, so a camera turned on the plot is still turned when the plot
  // comes back.
  const interaction = useMemo(createSceneInteraction, []);
  const dragTurnsRef = useRef(plot?.dragTurns === true);
  dragTurnsRef.current = plot?.dragTurns === true;

  // The plot's loading and its reset read this (`ScenePlot`).
  useLayoutEffect(() => {
    publishGraphSceneRun({
      interaction,
      ...(drawnIdentity === undefined ? {} : { drawnIdentity }),
    });
  }, [interaction, drawnIdentity]);
  useLayoutEffect(() => () => publishGraphSceneRun(undefined), []);

  // The root marked with the layer the scene is drawn on while it is there
  // (`data-scene-layer`, `sceneCover.ts`): `is-scene-backdrop` veils the
  // panes' surfaces (`SceneCover.scss`), and the drawings that read their
  // colours from the root (`readSurface`, the level meter's wells) are told
  // by its class, which is what their cache of those colours watches;
  // `is-scene-column` lifts the EQ head over the picture.
  const layerName = target.dataset.sceneLayer;
  useLayoutEffect(() => {
    if (!layerName) {
      return undefined;
    }
    const mark = `is-scene-${layerName}`;
    const root = document.documentElement;
    root.classList.add(mark);
    return () => root.classList.remove(mark);
  }, [layerName]);

  // On a layer, the layer's size and where the plot's panel stands on it.
  // Measured whenever either box changes: the graph moving down the column
  // changes its size with it, as a fraction of the window's grid. With no
  // plot the panel stays where it last stood, so leaving the graph's page
  // under the Backdrop leaves the picture as it was; never framed at all
  // (a launch onto a page without the graph), the panel is the window.
  const layer = layerName ? target : undefined;
  const viewRef = useRef<TSceneView>(FULL_VIEW);
  const [cover, setCover] = useState<ICoverFrame>();
  useLayoutEffect(() => {
    if (!layer || typeof ResizeObserver === 'undefined') {
      setCover(undefined);
      return undefined;
    }
    const measure = () => {
      const canvas = layer.getBoundingClientRect();
      if (panel) {
        viewRef.current = sceneViewOf(panel.getBoundingClientRect(), canvas);
      }
      const next: ICoverFrame = {
        width: Math.round(canvas.width),
        height: Math.round(canvas.height),
        view: viewRef.current,
      };
      setCover((previous) => (isSameCover(previous, next) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (panel) {
      observer.observe(panel);
    }
    observer.observe(layer);
    return () => observer.disconnect();
  }, [layer, panel]);
  // Only the layer's own: the render that moves the canvas onto the plot
  // still holds the last layer's box until the effect above clears it.
  const frame = layer ? cover : undefined;

  // The wave as the plot last drew it, carried on with the picture off the
  // graph; before any plot, the wave it is watched with where there is no
  // grid (`useWatchedSceneWave`).
  const { spectrumRange } = scene;
  const watchedWave = useWatchedSceneWave(lookId, scene.wave);
  const watchedSpectrum = useMemo(
    () => studioSpectrumRect({ spectrumRange }, watchedWave),
    [spectrumRange, watchedWave],
  );
  const plotted = plot?.spectrumRect;
  const [lastPlotted, setLastPlotted] = useState(plotted);
  useLayoutEffect(() => {
    if (plotted) {
      setLastPlotted(plotted);
    }
  }, [plotted]);
  const spectrumRect = plotted ?? lastPlotted ?? watchedSpectrum;

  const width = frame?.width ?? plot?.width ?? 0;
  const height = frame?.height ?? plot?.height ?? 0;
  const sceneRef = useSceneRunner({
    source,
    width,
    height,
    spectrumRect,
    ...(frame ? { view: frame.view } : {}),
    tuning,
    onDrawn,
    onLoaded,
    interaction,
    placement: target,
  });

  // On the plot, not on the scene's own layer, which takes no pointer: the
  // drawing and its handles lie over it. Heard before them, in the capture,
  // and every press that is not the scene's goes on to them untouched.
  useEffect(() => {
    const plotElement = panel?.closest<HTMLElement>('.graph-plot');
    if (!panel || !plotElement) {
      return undefined;
    }
    return interaction.attach(plotElement, {
      frame: () => panel.getBoundingClientRect(),
      turns: (event) =>
        event.button === 1 ||
        event.button === 2 ||
        (event.button === 0 && dragTurnsRef.current),
      grabs: () => dragTurnsRef.current,
      owns: (element) =>
        Boolean(
          element.closest('.graph-edit-point, .chart-limit, .chart-presence'),
        ),
    });
  }, [interaction, panel]);

  // The worker's canvas goes in one container that is moved from place to
  // place, so the canvas, its worker and its compiled program are the same
  // ones wherever the scene is drawn.
  const container = useMovableContainer(target);
  return createPortal(
    <div
      ref={sceneRef}
      className="chart-scene-canvas"
      aria-hidden="true"
      style={{ width, height }}
    />,
    container,
  );
}
