/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Dispatch, type SetStateAction, useEffect } from 'react';
import type { ILibraryQueue } from '../../../common/library/queue';

/**
 * A song the tag editor renamed is known by a new id (its path's), and the
 * queue follows it: the same place, the same order, and still marked as
 * added by hand where it was. Without it the queue would hold an id the
 * Library no longer has, and the song would be skipped as missing.
 */
const useQueueFollowsMoves = ({
  setQueue,
  setAddedIds,
}: {
  setQueue: Dispatch<SetStateAction<ILibraryQueue | undefined>>;
  setAddedIds: Dispatch<SetStateAction<ReadonlySet<string>>>;
}): void => {
  useEffect(
    () =>
      window.electron.ipcRenderer.onLibraryTracksMoved((moves) => {
        const renamed = new Map(moves.map((move) => [move.from, move.to]));
        setQueue((current) =>
          current === undefined ||
          !current.trackIds.some((id) => renamed.has(id))
            ? current
            : {
                ...current,
                trackIds: current.trackIds.map((id) => renamed.get(id) ?? id),
              },
        );
        setAddedIds((current) =>
          [...current].some((id) => renamed.has(id))
            ? new Set([...current].map((id) => renamed.get(id) ?? id))
            : current,
        );
      }),
    [setQueue, setAddedIds],
  );
};

export default useQueueFollowsMoves;
