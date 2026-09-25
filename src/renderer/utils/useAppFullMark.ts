/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect } from 'react';
import { claimNotice } from './noticeTurn';

/** The attribute the stylesheets read full screen from, on `<html>`. */
export const APP_FULL_ATTRIBUTE = 'data-app-full';

/**
 * Publish that the window is full screen — the graph's largest view or a
 * media surface, the same flag that puts `is-app-full` on the workspace — on
 * the document element, and to the corner notices, which give way to it.
 *
 * The stylesheets used to find it out for themselves with
 * `#root:has(> .app-workspace.is-app-full)` and
 * `body:has(> #root > .app-workspace.is-app-full)`, which made the root and
 * the body answer for their children after every change there. An attribute
 * is read by selector matching and costs nothing until it changes.
 *
 * On `<html>` rather than `#root` because the transport bar is portalled to
 * the body, beside the root, and it wears the full-screen glass too. An
 * attribute and not a class: `readSurface` (`theme.ts`) forgets every colour
 * it holds whenever the root's class changes, and full screen changes none.
 *
 * In a layout effect, so the attribute lands in the same frame as the class
 * it mirrors and the bars never show one without the other.
 */
const useAppFullMark = (isAppFull: boolean) => {
  useLayoutEffect(() => {
    if (!isAppFull) {
      return undefined;
    }
    const root = document.documentElement;
    root.setAttribute(APP_FULL_ATTRIBUTE, '');
    const release = claimNotice('appFull');
    return () => {
      root.removeAttribute(APP_FULL_ATTRIBUTE);
      release();
    };
  }, [isAppFull]);
};

export default useAppFullMark;
