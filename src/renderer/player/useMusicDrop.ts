/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { DragEvent } from 'react';
import { droppedFilePath } from '../library/libraryWorkspacePrefs';
import { reportError } from '../utils/logger';
import { clearDropNotice, showDropNotice } from './dropNotice';
import { useLibraryDeck } from './libraryDeck';
import { usePlayerQueuePage } from './playerLayout';

/**
 * MUSIC DROPPED ANYWHERE ON THE AMP goes on the end of the queue (Ivan,
 * 2026-10-25: "we also need to fix the drag and drop, still not working").
 * Only the queue's own page took a drop, and in the one amp that is the
 * last stretch of the column, under the picture, the transport and the
 * sound: a file let go anywhere else did nothing at all. Now the whole amp
 * says it will take it and does, and turns the queue to Up next, where it
 * lands.
 *
 * `webUtils.getPathForFile` is the only source of a dropped file's path —
 * `File.path` was removed from Electron — and what comes back is handed
 * across. A folder arrives as a File as well, with no media extension; main
 * decides which paths are folders and which files the Library takes, and a
 * folder is read by the Library's own scan, whose card floats over the queue
 * while it runs.
 *
 * Only a drag that carries files: a song being moved inside Up next carries
 * a type of its own (`QueueDeck`) and a drag of selected text should not
 * light the amp up.
 */
const useMusicDrop = () => {
  const library = useLibraryDeck();
  const { setQueuePage } = usePlayerQueuePage();
  const [isOver, setIsOver] = useState(false);

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return;
    }
    // Without this the browser refuses the drop outright.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsOver(true);
  };

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    // The pointer crossing onto something inside the amp is not leaving it.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsOver(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    setIsOver(false);
    const paths = Array.from(event.dataTransfer.files)
      .map(droppedFilePath)
      .filter((path) => path.length > 0);
    if (!library) {
      return;
    }
    // A new drop is the next thing: whatever the last one said is done.
    clearDropNotice();
    setQueuePage('next');
    if (paths.length === 0) {
      showDropNotice('empty');
      return;
    }
    // A DROP THAT PUTS NOTHING ON UP NEXT SAYS WHY (`dropNotice.ts`): not
    // music, all of it already coming, or a failure — which goes into the
    // log file as well, so the next bug report carries it (`reportError`;
    // a bare console line reaches no file).
    library
      .addFiles(paths)
      .then((outcome) => {
        if (outcome !== 'added') {
          showDropNotice(outcome);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        reportError(
          `Could not put ${paths.length} dropped item(s) on Up next`,
          error,
        );
        showDropNotice('failed');
      });
  };

  return { isOver, onDragOver, onDragLeave, onDrop };
};

export default useMusicDrop;
