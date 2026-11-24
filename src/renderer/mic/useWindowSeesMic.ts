/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether the window itself sees a microphone, asked of Windows through the
 * browser's own device list and asked again at each `devicechange`.
 *
 * The Mic tab's list comes from the engine's setup helper, which answers for
 * the moment it runs. When it lists none while the window sees one, the
 * helper's answer is the old one — read while Windows was still rebuilding
 * its devices after a restart of Windows audio — and the tab says Windows is
 * bringing the microphones back rather than "No microphone found" (Ivan,
 * 2026-11-24). Device kinds are listed without the mic permission; only the
 * names need it, and nothing here reads one.
 */

import { useEffect, useState } from 'react';
import { reportError } from '../utils/logger';

const useWindowSeesMic = (): boolean | undefined => {
  const [sees, setSees] = useState<boolean>();

  useEffect(() => {
    const devices = navigator.mediaDevices;
    if (!devices?.enumerateDevices) {
      return undefined;
    }
    let alive = true;
    const read = () => {
      devices
        .enumerateDevices()
        .then((list) => {
          if (alive) {
            setSees(list.some((each) => each.kind === 'audioinput'));
          }
          return undefined;
        })
        .catch((error: unknown) =>
          reportError('listing the window’s microphones', error),
        );
    };
    read();
    devices.addEventListener('devicechange', read);
    return () => {
      alive = false;
      devices.removeEventListener('devicechange', read);
    };
  }, []);

  return sees;
};

export default useWindowSeesMic;
