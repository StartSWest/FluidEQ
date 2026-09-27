/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import useIsGraphChromeIdle from './graphChromeIdle';

/**
 * The EQ head's shade over a Plus scene (`head-over-scene` in
 * `SceneCover.scss`, which is also what shows it), there while the graph's
 * options are and gone with them (Ivan, 2026-09-27: "the top drop shadow
 * only appears when graph options is shown and disappears when hidden, so we
 * see full plus viz to the top").
 *
 * An element of its own rather than a class on the head, so the idle clock
 * redraws this and not the whole shell every time it turns.
 */
const HeadSceneShade = () => {
  const isChromeIdle = useIsGraphChromeIdle();
  return (
    <div
      className={`center-head__shade${isChromeIdle ? ' is-idle' : ''}`}
      aria-hidden="true"
    />
  );
};

export default HeadSceneShade;
