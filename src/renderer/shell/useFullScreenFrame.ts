/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type RefObject, useEffect, useEffectEvent, useRef } from 'react';
import { setFrameShown, setFrameToggle } from '../utils/idleChrome';

/**
 * How close to the window's side the pointer has to come to bring the frame
 * up: 24px (Ivan, 2026-11-16: "it needs a bit more range", "about 20
 * pixels"). The plot's own controls start further in (its level labels take
 * the first 50px), so dragging the lowest band does not bring it up.
 */
export const EDGE_OPENS_PX = 24;

/**
 * How long the pointer has to stay at an edge before the frame comes up
 * (Ivan, 2026-11-16: "half a second ... if I'm moving the mouse to another
 * screen I don't want the panel"). The duration is the request itself, not a
 * guess at when something is ready: it is waited on as an animation of the
 * document on the page's own timeline (`Element.animate`, its `finished`),
 * cancelled the moment the pointer leaves the edge or the window.
 */
export const EDGE_DWELL_MS = 500;

/**
 * What a click must not be taken from to bring the frame up: every control,
 * the frame's own surfaces, and what they open, and the Karaoke's lyrics and
 * pitch strip, which seek where they are pressed. The graph's plot answers its
 * own clicks (`Chart`, through `toggleChromeNow`), drags apart.
 */
const NOT_THE_PICTURE = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  '[role="button"]',
  '[role="slider"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[contenteditable="true"]',
  '.window-titlebar',
  '.now-playing-bar',
  '.side-bar',
  '.right-content',
  '.drawer-backdrop',
  '.graph-plot',
  '.karaoke-lyrics__canvas',
  '.karaoke-pitch canvas',
  '.karaoke-playlist',
  '.karaoke-stage-bar',
].join(', ');

interface IFullScreenFrame {
  /** Whether the window is in the app's full screen, where this applies. */
  isActive: boolean;
  /** Whether the frame is up: the side panels open. */
  isShown: boolean;
  /** Opens both side panels, or shuts both. */
  setShown: (shown: boolean) => void;
}

interface IEdgeWait {
  wait: Animation;
}

const cancelWait = (armed: RefObject<IEdgeWait | undefined>) => {
  armed.current?.wait.cancel();
  armed.current = undefined;
};

/**
 * THE FULL-SCREEN FRAME COMES AND GOES AS ONE (Ivan, 2026-11-16: "open
 * everything at the same time ... the header, the bottom bar and the side
 * panels; if the user clicks the screen it opens them, or if they reach the
 * edge; if they click the screen again it hides them all"). Half a second at
 * either side edge, or a click on the picture, brings up both side panels
 * with the header and the transport (`setFrameShown` keeps those two on
 * screen meanwhile); a click on the picture again, which lands on the panels'
 * backdrop, puts all four away. The handles are gone (`App.scss`).
 */
const useFullScreenFrame = ({
  isActive,
  isShown,
  setShown,
}: IFullScreenFrame) => {
  const armed = useRef<IEdgeWait>(undefined);

  // The header and the transport follow the panels, however those were moved.
  useEffect(() => {
    setFrameShown(isActive && isShown);
  }, [isActive, isShown]);

  // Leaving full screen puts the frame's panels away: left open, they came
  // back as the narrow layout's drawers and left their backdrop over the page
  // (Ivan, 2026-11-16: "leaving the Library in full screen the backdrop
  // stays"). Only on the way out, never on the way in.
  const putAway = useEffectEvent(() => {
    if (isShown) {
      setShown(false);
    }
  });
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (wasActive.current && !isActive) {
      putAway();
    }
    wasActive.current = isActive;
  }, [isActive]);

  const toggle = useEffectEvent(() => setShown(!isShown));

  const arm = () => {
    if (armed.current) {
      return;
    }
    const wait = document.documentElement.animate([{}, {}], {
      duration: EDGE_DWELL_MS,
    });
    const entry: IEdgeWait = { wait };
    armed.current = entry;
    wait.finished
      .then(() => {
        if (armed.current === entry) {
          armed.current = undefined;
          setShown(true);
        }
        return undefined;
      })
      // Cancelled: the pointer left the edge, which is the answer "no".
      .catch(() => undefined);
  };

  const onMove = useEffectEvent((event: PointerEvent) => {
    const isAtEdge =
      event.pointerType !== 'touch' &&
      (event.clientX <= EDGE_OPENS_PX ||
        event.clientX >= window.innerWidth - 1 - EDGE_OPENS_PX);
    if (isAtEdge && !isShown) {
      arm();
    } else {
      cancelWait(armed);
    }
  });

  const onClick = useEffectEvent((event: MouseEvent) => {
    // The first press only: the second of a double click leaves full screen.
    if (
      isShown ||
      event.detail !== 1 ||
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      event.target.closest(NOT_THE_PICTURE)
    ) {
      return;
    }
    setShown(true);
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const move = (event: PointerEvent) => onMove(event);
    const click = (event: MouseEvent) => onClick(event);
    const stop = () => cancelWait(armed);
    const root = document.documentElement;
    // The pointer gone off the window (to another screen) sends no more
    // moves, so its leaving is what cancels the wait.
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('click', click);
    root.addEventListener('pointerleave', stop);
    window.addEventListener('blur', stop);
    setFrameToggle(() => toggle());
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('click', click);
      root.removeEventListener('pointerleave', stop);
      window.removeEventListener('blur', stop);
      setFrameToggle(undefined);
      stop();
    };
  }, [isActive]);
};

export default useFullScreenFrame;
