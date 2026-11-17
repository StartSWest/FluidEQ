/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode } from 'react';
import '../styles/ViewBar.scss';

interface IViewBarProps {
  /** The view's own class, which places the bar and lays out its row. */
  className: string;
  /** Away with the rest of the chrome (`useIsChromeIdle`). */
  isIdle: boolean;
  /** What the row is, for the toolbar's name. */
  label: string;
  /** The view's own controls, ending with `FullScreenToggles`. */
  children: ReactNode;
}

/**
 * THE ONE OPTIONS ROW EVERY PAGE STANDS ON (Ivan, 2026-11-16: "the same base
 * bar for all the screens ... the same container bar with the few icons, and
 * then each view puts its own stuff in that container"): the graph's strip,
 * the Karaoke stage's row, and the full-screen rows over a Library film and
 * an Online Media page.
 *
 * What it brings is what they have in common: the flat band under the row
 * that holds its words off the picture, the fade with the rest of the chrome
 * when the pointer rests, and the place the idle store looks to keep it up
 * while it is being used and to find it again when it has gone
 * (`idleChrome.ts`, `.view-bar`). Where it stands and how its row is laid
 * out stay the view's own class.
 */
const ViewBar = ({ className, isIdle, label, children }: IViewBarProps) => (
  <div
    className={`view-bar ${className}${isIdle ? ' is-idle' : ''}`}
    role="toolbar"
    aria-label={label}
  >
    {children}
  </div>
);

export default ViewBar;
