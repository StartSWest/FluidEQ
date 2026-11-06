import { useCallback, useEffect, useRef, useState } from 'react';
import type { TScenePublishPhase } from 'common/scenePreviewMedia';
import { reportError } from '../utils/logger';

export default function useStudioPublishProgress() {
  const [phase, setPhase] = useState<TScenePublishPhase>();
  const currentPhase = useRef<TScenePublishPhase | undefined>(undefined);
  const id = useRef<string | undefined>(undefined);
  const show = useCallback((next: TScenePublishPhase | undefined) => {
    currentPhase.current = next;
    setPhase(next);
  }, []);
  const abandon = useCallback(() => {
    const previous = id.current;
    id.current = undefined;
    show(undefined);
    if (previous) {
      window.electron?.ipcRenderer
        ?.cancelStudioPublish?.(previous)
        .catch((error) =>
          reportError('Cancelling scene preview publication', error),
        );
    }
  }, [show]);
  useEffect(() => {
    const unsubscribe = window.electron?.ipcRenderer?.onStudioPublishProgress?.(
      (next) => {
        if (next.id === id.current) {
          show(next.phase);
        }
      },
    );
    return () => {
      unsubscribe?.();
      const pending = id.current;
      id.current = undefined;
      if (pending) {
        window.electron?.ipcRenderer
          ?.cancelStudioPublish?.(pending)
          .catch((error) =>
            reportError('Closing scene preview publication', error),
          );
      }
    };
  }, [show]);
  const begin = useCallback(() => {
    const next = crypto.randomUUID();
    id.current = next;
    show('preparing');
    return next;
  }, [show]);
  const requestCancel = useCallback(async () => {
    if (currentPhase.current === 'publishing') {
      return false;
    }
    if (id.current && currentPhase.current === 'uploading') {
      return (
        (await window.electron?.ipcRenderer?.cancelStudioPublish?.(
          id.current,
        )) === true
      );
    }
    return true;
  }, []);
  return { phase, begin, abandon, requestCancel };
}
