import { useCallback, useEffect, useRef, useState } from 'react';
import type { IStudioProject } from 'main/ipc/memberScenes';
import type { IStudioNotes } from 'common/studioNotes';
import { setStudioIdea, useStudioIdea } from './studioIdea';

/**
 * Project notes travel with the folder; the unassigned draft stays separate.
 *
 * Only the member's own goes into the notes: their idea, and the line their
 * AI wrote. FluidEQ's brief is never written there (Ivan, 2026-11-09): the
 * prompt handed over is built from the running FluidEQ when it is copied,
 * with the idea the member can see in the field after it (`StudioMaker`),
 * and the chat's from the same source when it starts. A brief kept in a
 * folder is one an update never reaches - and a folder can come from
 * anywhere, so a brief read from one could have told the member's AI
 * anything. Notes an earlier FluidEQ wrote with a brief lose it when main
 * reads them (`stripStoredBrief`).
 */
export default function useProjectIdea(project?: IStudioProject) {
  const draft = useStudioIdea();
  const [idea, setIdea] = useState(project ? '' : draft);
  const [loading, setLoading] = useState(!!project);
  const [failed, setFailed] = useState(false);
  const pending = useRef<IStudioNotes | undefined>(undefined);
  // What the member's AI last wrote about its own change, carried through
  // every save of this file. Rebuilding the notes from the two fields this
  // hook owns dropped it, which is the same defect as a pack rebuilt field by
  // field: the line was written, and saving the idea threw it away.
  const written = useRef<string | undefined>(undefined);
  const projectId = project?.id;
  const save = useCallback(() => {
    if (!projectId || !pending.current) {
      return;
    }
    const notes = pending.current;
    window.electron?.ipcRenderer
      ?.saveStudioNotes?.(projectId, notes)
      .then((ok) => {
        if (pending.current === notes && ok) {
          pending.current = undefined;
        }
        setFailed(!ok);
        return undefined;
      })
      .catch(() => setFailed(true));
  }, [projectId]);
  useEffect(() => {
    let disposed = false;
    if (projectId) {
      window.electron?.ipcRenderer
        ?.readStudioNotes?.(projectId)
        .then((notes) => {
          if (!disposed) {
            written.current = notes?.whatsNew;
          }
          if (!disposed && !pending.current) {
            setIdea(notes?.description ?? '');
            setLoading(false);
          }
          return undefined;
        })
        .catch(() => {
          if (!disposed) {
            setLoading(false);
            setFailed(true);
          }
        });
      if (!window.electron?.ipcRenderer?.readStudioNotes) {
        setLoading(false);
      }
    }
    return () => {
      disposed = true;
      save();
    };
  }, [projectId, save]);
  const update = (text: string) => {
    setIdea(text);
    if (!project) {
      setStudioIdea(text);
    } else {
      pending.current = {
        description: text,
        ...(written.current ? { whatsNew: written.current } : {}),
      };
    }
  };
  return { idea, update, save, loading, failed };
}
