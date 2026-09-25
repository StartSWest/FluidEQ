import { useCallback, useEffect, useRef, useState } from 'react';
import type { IStudioProject } from 'main/ipc/memberScenes';
import type { IStudioNotes } from 'common/studioNotes';
import { promptWithIdea } from './aiPrompt';
import { setStudioIdea, useStudioIdea } from './studioIdea';

/**
 * Project notes travel with the folder; the unassigned draft stays separate.
 *
 * The prompt handed over is always this app's, with the idea the member can
 * see in the field after it (`StudioMaker` builds it). A project folder can
 * come from anywhere, and the prompt its notes saved went to the member's AI
 * - which works with the member's files - from a collapsed panel nobody
 * reads: a folder shared on a forum could have told that AI to do anything.
 * The prompt kept in the notes never carries the door's connection: a folder
 * is synced and shared, and its key is the member's own.
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
  // The folder FluidEQ made and is watching, named in the prompt so the
  // member's AI writes into it rather than guessing at one of its own.
  const folder = project?.path;
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
            // The prompt in the notes is Studio's, not the member's: rewrite
            // it with today's brief every time the scene opens, so an
            // assistant working in the folder never follows a brief that has
            // since been revised. Only notes that were read — a file that
            // could not be read (missing, or half-written by an AI) is left
            // alone rather than replaced, which would lose the description.
            // Unchanged notes are not rewritten: the file already says it.
            if (notes) {
              const fresh = promptWithIdea(notes.description, folder);
              if (fresh !== notes.prompt) {
                pending.current = {
                  description: notes.description,
                  prompt: fresh,
                  ...(notes.whatsNew ? { whatsNew: notes.whatsNew } : {}),
                };
                save();
              }
            }
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
  }, [projectId, folder, save]);
  const update = (text: string) => {
    setIdea(text);
    if (!project) {
      setStudioIdea(text);
    } else {
      pending.current = {
        description: text,
        prompt: promptWithIdea(text, folder),
        ...(written.current ? { whatsNew: written.current } : {}),
      };
    }
  };
  return { idea, update, save, loading, failed };
}
