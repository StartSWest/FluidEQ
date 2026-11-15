/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Cover Flow scene's life, from React: three.js loaded in a chunk of its
 * own the first time the view opens, the scene built into the stage, fed
 * what the row holds on every render, and given back — the WebGL context
 * with it — when the view goes, when the window is hidden, and when the
 * graphics card takes the context away. A hidden window builds it again
 * when it is shown; a lost context, when the browser offers it back.
 *
 * Until the scene has drawn the centre cover's own picture (`isDrawn`), the
 * stage shows the still one under the canvas, so the view is never blank
 * while three.js loads; and where WebGL cannot start at all the still
 * picture simply stays, with every input, the caption and the songs panel
 * working as before.
 */
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ICoverFlowScene, ICoverFlowSource } from './coverFlowScene';

export interface ICoverFlowSceneInput {
  hostRef: RefObject<HTMLDivElement | null>;
  source: ICoverFlowSource;
  centre: number;
  hovered: number | undefined;
  isExpanded: boolean;
  isReducedMotion: boolean;
}

/** WebGL 2 exists here at all: a test's DOM and a blocklisted GPU have
 * none, and asking a canvas for it there only logs a complaint. */
const canDrawWebGl = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.WebGL2RenderingContext !== 'undefined';

const isWindowShown = (): boolean => document.visibilityState !== 'hidden';

const useCoverFlowScene = ({
  hostRef,
  source,
  centre,
  hovered,
  isExpanded,
  isReducedMotion,
}: ICoverFlowSceneInput) => {
  const sceneRef = useRef<ICoverFlowScene | undefined>(undefined);
  /** The scene is lent to Surprise me's draw (`borrow`): the row's own
   * covers and centre wait until it is given back. */
  const isLentRef = useRef(false);
  const [isDrawn, setIsDrawn] = useState(false);
  const [isShown, setIsShown] = useState(isWindowShown);
  /** Bumped when a lost context comes back, to build the scene again. */
  const [generation, setGeneration] = useState(0);
  const latest = useRef({
    source,
    centre,
    hovered,
    isExpanded,
    isReducedMotion,
  });
  latest.current = { source, centre, hovered, isExpanded, isReducedMotion };

  useEffect(() => {
    const onVisibility = () => setIsShown(isWindowShown());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !isShown || !canDrawWebGl()) {
      return undefined;
    }
    let isCurrent = true;
    let built: ICoverFlowScene | undefined;
    import(/* webpackChunkName: "cover-flow" */ './coverFlowScene')
      .then(({ createCoverFlowScene }) => {
        if (!isCurrent) {
          return undefined;
        }
        built = createCoverFlowScene({
          host,
          onFirstFrame: () => {
            if (isCurrent) {
              setIsDrawn(true);
            }
          },
          onLost: () => {
            if (isCurrent) {
              setIsDrawn(false);
            }
          },
          onRestored: () => {
            if (isCurrent) {
              setGeneration((value) => value + 1);
            }
          },
        });
        const now = latest.current;
        built.setReducedMotion(now.isReducedMotion);
        built.setExpanded(now.isExpanded);
        built.setHovered(now.hovered);
        if (!isLentRef.current) {
          built.setSource(now.source);
          built.setCentre(now.centre);
        }
        sceneRef.current = built;
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the still cover stands in for the row
        console.error('The Cover Flow scene could not start', error);
      });
    return () => {
      isCurrent = false;
      if (built && sceneRef.current === built) {
        sceneRef.current = undefined;
      }
      built?.dispose();
      setIsDrawn(false);
    };
  }, [hostRef, isShown, generation]);

  useEffect(() => {
    if (!isLentRef.current) {
      sceneRef.current?.setSource(source);
    }
  });
  useEffect(() => {
    if (!isLentRef.current) {
      sceneRef.current?.setCentre(centre);
    }
  }, [centre]);

  /**
   * Lends the scene to Surprise me's draw, so a press over Cover Flow spins
   * this very row rather than building a second scene over it. Answers
   * undefined when there is no scene to lend (still loading, no WebGL, or
   * already lent); otherwise the function that gives it back, which puts the
   * row's own covers in again and stands it where the row is now, at once.
   */
  const borrow = useCallback((): (() => void) | undefined => {
    const scene = sceneRef.current;
    if (!scene || isLentRef.current) {
      return undefined;
    }
    isLentRef.current = true;
    return () => {
      isLentRef.current = false;
      const now = latest.current;
      const { current } = sceneRef;
      current?.setExpanded(now.isExpanded);
      current?.setSource(now.source);
      current?.jumpTo(now.centre);
    };
  }, []);
  useEffect(() => {
    sceneRef.current?.setHovered(hovered);
  }, [hovered]);
  useEffect(() => {
    sceneRef.current?.setExpanded(isExpanded);
  }, [isExpanded]);
  useEffect(() => {
    sceneRef.current?.setReducedMotion(isReducedMotion);
  }, [isReducedMotion]);

  return { sceneRef, isDrawn, borrow };
};

export default useCoverFlowScene;
