/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';

/**
 * Tools of one job, under a small caption that says what the job is (Ivan,
 * 2026-11-17, "B1, grouped by job": BANDS over the band count, Add and
 * Clear; VIEW over the curves and the EQ mode). The caption is what a
 * screen reader hears for the group, and takes the room above the tools that
 * a boxed button's edge used to.
 */
const EqToolGroup = ({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) => (
  <div className="eq-tool-group" role="group" aria-label={caption}>
    <span className="eq-tool-group__caption" aria-hidden="true">
      {caption}
    </span>
    <div className="eq-tool-group__tools">{children}</div>
  </div>
);

export default EqToolGroup;
