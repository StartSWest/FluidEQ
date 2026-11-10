/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, type ReactNode } from 'react';
import ColumnResizer from '../../components/ColumnResizer';
import { useTranslation } from '../../utils/I18nContext';
import useColumnWidth from '../useColumnWidth';

/**
 * `$studio-animator-min`, and the animation view's own least width beside
 * it (`$studio-animation-view-min`) plus the grid's gap, in
 * `StudioAnimations.scss`.
 */
const ANIMATOR_MIN = 300;
const VIEW_MIN = 440;
const GRID_GAP = 16;

/**
 * The opened animation's animator, in a column whose left edge drags it
 * wider or narrower (Ivan, 2026-11-09: "also add splitter for the chat too
 * there"), as the scene's chat column does beside the stage. The width is
 * remembered for the next visit and a double-click on the divider puts the
 * column back at its own. Stacked under the animation, where the panel is
 * too narrow for both, there is nothing to drag and the divider is not
 * drawn.
 */
export default function StudioAnimatorColumn({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const column = useRef<HTMLDivElement>(null);
  const width = useColumnWidth(column, {
    storageKey: 'fluideq.studio.animatorWidth',
    property: '--studio-animator-width',
    least: ANIMATOR_MIN,
    besideLeast: VIEW_MIN + GRID_GAP,
  });
  return (
    <div
      ref={column}
      className="studio-animation-opened__side"
      style={width.style}
    >
      <ColumnResizer
        ariaLabel={t('studio.animator.resize')}
        valuePercent={width.resizer.valuePercent}
        onStart={width.resizer.onStart}
        onDrag={width.resizer.onDrag}
        onEnd={width.resizer.onEnd}
        onReset={width.resizer.onReset}
      />
      {children}
    </div>
  );
}
