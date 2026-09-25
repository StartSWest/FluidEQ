/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useLayoutEffect } from 'react';

const PROPERTY = '--workspace-axis-shift';

/**
 * How far the workspace column's middle stands from the window's, published
 * on the document as `--workspace-axis-shift` for what spans the whole
 * window but belongs to the column: the player bar, whose play button stands
 * under the middle of the EQ rather than the window's (`NowPlayingBar.scss`).
 *
 * The column's content box is what is measured. Where the sound panel is a
 * drawer the column keeps a lane for its tab, and the EQ is centred on what
 * is left of it.
 *
 * Watched rather than worked out from the breakpoints: the rail and the
 * panel are drawers at some widths and gone in full screen, and a bar that
 * restated those rules would be one more place for them to disagree. The
 * column is a fraction of the window's grid, so anything that moves its
 * middle changes its size, which is what a ResizeObserver hears.
 */
const useWorkspaceAxis = (column: HTMLElement | null) => {
  useLayoutEffect(() => {
    if (!column || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const root = document.documentElement;
    const publish = () => {
      const box = column.getBoundingClientRect();
      const style = getComputedStyle(column);
      const left =
        box.left +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.paddingLeft);
      const right =
        box.right -
        parseFloat(style.borderRightWidth) -
        parseFloat(style.paddingRight);
      const shift = (left + right) / 2 - root.clientWidth / 2;
      root.style.setProperty(PROPERTY, `${Math.round(shift)}px`);
    };
    const observer = new ResizeObserver(publish);
    observer.observe(column);
    return () => {
      observer.disconnect();
      root.style.removeProperty(PROPERTY);
    };
  }, [column]);
};

export default useWorkspaceAxis;
