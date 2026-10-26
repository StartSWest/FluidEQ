/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useCallback, useEffect } from 'react';
import { setPlayerWidthNeed, type TWidthNeed } from './playerLayout';
import useRowFit from './useRowFit';

/**
 * A row of the amp's controls that never breaks onto a second line (Ivan,
 * 2026-10-25: "make sure all controls never break line, they will just push
 * the app min width so they all fit on any res"): it gives up what words it
 * can as room runs out (`useRowFit`, `steps`), and the width it needs with
 * those gone — its content, and the amp's room round it — is part of what
 * the amp's one width rises to (`setPlayerWidthNeed`). Withdrawn when the
 * row goes, and not said while the row is not drawn at all (the picture on
 * the whole screen), where there is nothing to measure.
 */
const useRowNeed = (
  ref: RefObject<HTMLElement | null>,
  part: TWidthNeed,
  steps = 0,
) => {
  const onNeed = useCallback(
    (contentWidth: number) => {
      const row = ref.current;
      const amp = row?.closest('.mini-player');
      if (!row || !amp || row.getClientRects().length === 0) {
        return;
      }
      const around =
        amp.getBoundingClientRect().width - row.getBoundingClientRect().width;
      setPlayerWidthNeed(part, contentWidth + around);
    },
    [part, ref],
  );
  useRowFit(ref, steps, onNeed);
  useEffect(() => () => setPlayerWidthNeed(part, undefined), [part]);
};

export default useRowNeed;
