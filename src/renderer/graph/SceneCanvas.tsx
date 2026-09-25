import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { sceneMakerOf } from 'common/sceneMaker';
import type { IScenePack } from 'common/scenePacks';
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
import type { ISceneFrame } from './sceneGl';
import type { ISceneDrawReport } from './sceneRunnerTypes';
import { forgetSceneDraw, reportSceneDraw } from '../utils/sceneDrawStats';
import SceneLoading from './SceneLoading';
import { reportScenePlayed } from './sceneUpdateStore';
import useSceneRunner, { type ISceneSource } from './useSceneRunner';
import { reportSceneBeat, reportSceneLeft } from '../utils/scenePulse';
import { useHoldGraphAutoCycle } from '../utils/graphAutoCycle';
import { useIsChromeIdle } from '../utils/idleChrome';
import { createSceneInteraction } from './sceneInteraction';
import SceneViewReset from './SceneViewReset';
import { sceneViewOf, type TSceneView } from './sceneView';

export type TDrawableScene = IUsableScene | IUsableMemberScene;

interface ISceneCanvasProps {
  scene: TDrawableScene;
  /** The full panel, including the toolbar and axis gutters. */
  width: number;
  height: number;
  spectrumRect: readonly [number, number, number, number];
  /**
   * Whether a plain drag on the plot turns a scene that can be turned: only
   * while it is not the band marquee. A right or middle drag turns it
   * whichever it is.
   */
  dragTurns: boolean;
  /** How far in from the panel's right and bottom the ruled plot stands. */
  inset: { right: number; bottom: number };
  /**
   * The Backdrop: the layer at the back of the window the scene is drawn on
   * instead, the size of the window, with this panel still its frame
   * (`SceneCover.tsx`, `sceneView.ts`). Its loading, its reset and the
   * pointer stay here on the panel.
   */
  coverHost?: HTMLElement | null;
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

/**
 * A Plus look, or a member's scene, drawn on the GPU.
 *
 * A sibling of `LiveTraceCanvas` and mounted INSTEAD of it, never alongside:
 * two canvases painting the same region is double the fill for a picture that
 * is worse. The loop itself is `useSceneRunner`; what this decides is where
 * the scene comes from and what failing means for it.
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
  width,
  height,
  spectrumRect,
  dragTurns,
  inset,
  coverHost,
}: ISceneCanvasProps) {
  const member = isMemberScene(scene);
  // A scene this listener made is one they have watched: the source says so
  // below, and the runner alone decides what follows (`sceneRules.ts`).
  const madeBy = sceneMakerOf({ member, own: member && scene.own });
  const key = member ? scene.lookId : scene.id;
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

  // Which scene has drawn its first frame. Kept by identity, because the
  // chart hands this same canvas the next scene when the look changes, and
  // that one starts from nothing again; a new version of the same scene is
  // swapped in place and stays settled.
  const [drawnIdentity, setDrawnIdentity] = useState<string>();
  const drawnRef = useRef<string | undefined>(undefined);
  // The automatic switching counts a look's time from its first frame, not
  // from the moment it was chosen (`graphAutoCycle.ts`).
  useHoldGraphAutoCycle(drawnIdentity !== key);
  // The element the scene draws in, once the runner has made it: where the
  // window's pulse starts from.
  const hostRef = useRef<RefObject<Element | null>>(undefined);
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
      reportSceneBeat('graph', frame, hostRef.current?.current);
      // And the Processes dialog says what it is costing.
      reportSceneDraw('graph', name, report);
    },
    [key, name],
  );
  // The window's light goes with the graph's scene when the graph leaves the
  // screen with its tab. Not when the look changes: the next scene is drawn
  // in this same place and carries the light on.
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
  // one, the pointer and taps where it answers them.
  const interaction = useMemo(createSceneInteraction, []);
  const dragTurnsRef = useRef(dragTurns);
  dragTurnsRef.current = dragTurns;

  // The panel itself, always on the plot: where the scene is framed, what
  // the pointer is measured against, and where the window's pulse starts,
  // whether the scene is drawn here or on the window behind.
  const panelRef = useRef<HTMLDivElement>(null);
  hostRef.current = panelRef;

  // The root marked with the layer the scene is drawn on while it is there
  // (`data-scene-layer`, `sceneCover.ts`): `is-scene-backdrop` veils the
  // panes' surfaces (`SceneCover.scss`), and the drawings that read their
  // colours from the root (`readSurface`, the level meter's wells) are told
  // by its class, which is what their cache of those colours watches;
  // `is-scene-column` lifts the EQ head over the picture.
  useLayoutEffect(() => {
    const layer = coverHost?.dataset.sceneLayer;
    if (!layer) {
      return undefined;
    }
    const mark = `is-scene-${layer}`;
    const root = document.documentElement;
    root.classList.add(mark);
    return () => root.classList.remove(mark);
  }, [coverHost]);

  // Under the Backdrop, the window's layer and where this panel stands on
  // it. Measured whenever either box changes: the graph moving down the
  // column changes its size with it, as a fraction of the window's grid.
  const [cover, setCover] = useState<ICoverFrame>();
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!coverHost || !panel || typeof ResizeObserver === 'undefined') {
      setCover(undefined);
      return undefined;
    }
    const measure = () => {
      const canvas = coverHost.getBoundingClientRect();
      const next: ICoverFrame = {
        width: Math.round(canvas.width),
        height: Math.round(canvas.height),
        view: sceneViewOf(panel.getBoundingClientRect(), canvas),
      };
      setCover((previous) => (isSameCover(previous, next) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(coverHost);
    return () => observer.disconnect();
  }, [coverHost]);

  const sceneRef = useSceneRunner({
    source,
    width: cover?.width ?? width,
    height: cover?.height ?? height,
    spectrumRect,
    ...(cover ? { view: cover.view } : {}),
    tuning,
    onDrawn,
    onLoaded,
    interaction,
  });

  // On the plot, not on the scene's own layer, which takes no pointer: the
  // drawing and its handles lie over it. Heard before them, in the capture,
  // and every press that is not the scene's goes on to them untouched.
  useEffect(() => {
    const panel = panelRef.current;
    const plot = panel?.closest<HTMLElement>('.graph-plot');
    if (!panel || !plot) {
      return undefined;
    }
    return interaction.attach(plot, {
      frame: () => panel.getBoundingClientRect(),
      turns: (event) =>
        event.button === 1 ||
        event.button === 2 ||
        (event.button === 0 && dragTurnsRef.current),
      grabs: () => dragTurnsRef.current,
      owns: (target) =>
        Boolean(
          target.closest('.graph-edit-point, .chart-limit, .chart-presence'),
        ),
    });
  }, [interaction]);
  const isChromeIdle = useIsChromeIdle();

  // The worker's canvas goes here: on the plot, or on the window's layer
  // behind everything under the Backdrop. The chart keys this component on
  // which, because a canvas handed to its worker cannot be moved.
  const drawn = (
    <div
      ref={sceneRef}
      className="chart-scene-canvas"
      aria-hidden="true"
      style={
        cover ? { width: cover.width, height: cover.height } : { width, height }
      }
    />
  );

  return (
    <>
      <SceneLoading
        lookId={lookId}
        swatch={scene.swatch}
        settled={drawnIdentity === key}
        width={width}
        height={height}
      />
      <div
        ref={panelRef}
        className="chart-scene-panel"
        aria-hidden="true"
        style={{ width, height }}
      />
      {coverHost ? createPortal(drawn, coverHost) : drawn}
      <SceneViewReset
        interaction={interaction}
        className={isChromeIdle ? 'is-idle' : ''}
        // In the drawing's own corner, clear of the axes' labels.
        style={{ right: inset.right + 8, bottom: inset.bottom + 8 }}
      />
    </>
  );
}
