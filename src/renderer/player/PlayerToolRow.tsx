/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useRef } from 'react';
import '../styles/EqLayers.scss';
import useToolRowFit from '../eq/useToolRowFit';

/**
 * The sound section's bottom row: the EQ page's own tools in the EQ page's
 * own row (Ivan, 2026-11-27: "on the bottom we can have this", "same order as
 * in the full app"), in the classes that page draws them with, so they wear
 * its flat face and give up its words in its order as the amp's width runs
 * out (`useToolRowFit`): the groups' names, then Add's and Clear's words,
 * then every word. It never wraps.
 */
const PlayerToolRow = ({ children }: { children: ReactNode }) => {
  const row = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  useToolRowFit(row, slot, tools);
  return (
    <div className="eq-layer-tabs player-sound__tools" ref={row}>
      <div className="eq-layer-tabs__slot" ref={slot}>
        <div className="eq-layer-tabs__tools" ref={tools}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default PlayerToolRow;
