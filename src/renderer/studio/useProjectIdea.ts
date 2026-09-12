import { useCallback, useEffect, useRef, useState } from 'react';
import type { IStudioProject } from 'main/ipc/memberScenes';
import { promptWithIdea } from './aiPrompt';
import { setStudioIdea, useStudioIdea } from './studioIdea';

/** Project notes travel with the folder; the unassigned draft stays separate. */
export default function useProjectIdea(project?: IStudioProject) {
  const draft = useStudioIdea();
  const [idea, setIdea] = useState(project ? '' : draft);
  const [savedPrompt, setSavedPrompt] = useState('');
  const [loading, setLoading] = useState(!!project);
  const [failed, setFailed] = useState(false);
  const pending = useRef<{ description: string; prompt: string } | undefined>(
    undefined,
  );
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
          if (!disposed && !pending.current) {
            setIdea(notes?.description ?? '');
            setSavedPrompt(notes?.prompt ?? '');
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
    setSavedPrompt('');
    if (!project) {
      setStudioIdea(text);
    } else {
      pending.current = { description: text, prompt: promptWithIdea(text) };
    }
  };
  return {
    idea,
    update,
    save,
    loading,
    failed,
    prompt: savedPrompt || promptWithIdea(idea),
  };
}
