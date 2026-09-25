/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { INativeMetersBridge } from './nativeMeters';

type TSwitch = Pick<INativeMetersBridge, 'setDspHostAnalysis'>;

interface IClaims {
  count: number;
  switching: Promise<boolean>;
}

/**
 * Who wants the Library host's meters running, counted per bridge.
 *
 * The host switches its meters on for one request and off for one request,
 * and two things in the window want them: the DSP page, while it paints, and
 * Smart EQ, while it measures the Library's own input tap. Each asking the
 * host directly meant the second to finish switched the meters off under
 * the first — the DSP page's graphs would freeze on the last frame the
 * moment a measurement ended, and a measurement would lose its frames the
 * moment the DSP tab closed. So the host hears from one place: the first
 * claim switches the meters on, the last release switches them off, and
 * everything between changes nothing.
 *
 * Per bridge, because the system meters hand `createNativeMeters` a bridge
 * of their own whose switch is a no-op (`useSystemMeters`): counted together
 * with the real one, a DSP page reading the engine would have held the
 * count up and the real host would never have been switched on for Smart EQ.
 */
const claimsByBridge = new WeakMap<TSwitch, IClaims>();

const claimHostAnalysis = async (bridge: TSwitch): Promise<() => void> => {
  let claims = claimsByBridge.get(bridge);
  if (!claims) {
    claims = { count: 0, switching: Promise.resolve(false) };
    claimsByBridge.set(bridge, claims);
  }
  const current = claims;
  current.count += 1;
  if (current.count === 1) {
    current.switching = bridge.setDspHostAnalysis(true).catch(() => false);
  }
  let released = false;
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    current.count -= 1;
    if (current.count === 0) {
      current.switching = bridge.setDspHostAnalysis(false).catch(() => false);
    }
  };
  const enabled = await current.switching;
  if (!enabled) {
    release();
    throw new Error('eq.smart.error.noSource');
  }
  return release;
};

export default claimHostAnalysis;
