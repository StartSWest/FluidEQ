/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useState } from 'react';

/**
 * A place in one part of a component's tree that a child somewhere else in
 * it renders into (`createPortal`), there from the child's first render.
 *
 * The usual slot — a state set from the host element's ref — exists only
 * after the commit that mounts the host, so the child's first render has
 * nowhere to go, and whatever it portals arrives one render late: after the
 * effects of the commit that opened it, a dialog's first focus among them.
 * This one is an element made once, up front, and moved into the host when
 * the host mounts (in the commit, before any effect runs). The host must be
 * an element React gives no children of its own, or React would be placing
 * nodes beside one it does not know.
 */
export default function usePortalSlot(className: string) {
  const [target] = useState(() => {
    const element = document.createElement('div');
    element.className = className;
    return element;
  });
  const attach = useCallback(
    (host: HTMLElement | null) => {
      if (host) {
        host.appendChild(target);
      } else {
        target.remove();
      }
    },
    [target],
  );
  return { target, attach };
}
