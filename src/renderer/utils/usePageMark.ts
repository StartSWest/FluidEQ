/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect } from 'react';
import type { TWorkspaceTab } from '../workspaceTabs';

/** The attribute the stylesheets read the open page from, on `<html>`. */
export const PAGE_ATTRIBUTE = 'data-page';

/**
 * Publish which page the window is on, on the document element, for a style
 * that belongs to one page but reaches past it: the Backdrop's floating glass
 * is the EQ page's for now (Ivan, 2026-09-27: "lets test in main EQ first"),
 * and it lays glass under the titlebar, beside the root, and under the
 * transport bar, portalled to the body.
 *
 * An attribute on `<html>` for the reasons `useAppFullMark` gives: a selector
 * that asked `#root:has(...)` or `body:has(...)` made those answer for their
 * children after every change, and `readSurface` (`theme.ts`) forgets every
 * colour it holds whenever the root's class changes. In a layout effect, so
 * the mark lands in the frame the page does.
 */
const usePageMark = (page: TWorkspaceTab) => {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute(PAGE_ATTRIBUTE, page);
    return () => {
      root.removeAttribute(PAGE_ATTRIBUTE);
    };
  }, [page]);
};

export default usePageMark;
