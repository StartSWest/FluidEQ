/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useState } from 'react';

/**
 * A container for a portal that stays the same element wherever it is put,
 * moved into `target` and never made again.
 *
 * A portal into another container is a new subtree to React — everything in
 * it unmounted and mounted again — and a canvas whose drawing was handed to
 * a worker (`transferControlToOffscreen`) is gone with the subtree: a scene
 * moved from one layer of the window to another was a new worker and a
 * compile. The DOM moves an element without that, so React portals into
 * this one container and the container is what moves.
 *
 * `display: contents`: it lays nothing out itself, so what is portalled into
 * it is placed, sized and stacked as if it stood where the container does.
 *
 * Moved in a layout effect, before the effects of what is inside run, so
 * those always find it where it now stands; taken out of the page when the
 * caller unmounts.
 */
export default function useMovableContainer(target: Element): HTMLElement {
  const [container] = useState(() => {
    const element = document.createElement('div');
    element.style.display = 'contents';
    return element;
  });

  useLayoutEffect(() => {
    if (container.parentNode === target) {
      return;
    }
    // `moveBefore` keeps the element connected the whole way — nothing
    // watching it sees it leave the page, and nothing it holds is reset.
    // It has to be a move within one document; a container still detached,
    // or left behind in a subtree that has just been removed, is inserted.
    if ('moveBefore' in target && target.isConnected && container.isConnected) {
      target.moveBefore(container, null);
    } else {
      target.appendChild(container);
    }
  }, [target, container]);

  useLayoutEffect(() => () => container.remove(), [container]);

  return container;
}
