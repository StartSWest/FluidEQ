import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readSaveGalleryVersion,
  type TSaveGalleryVersion,
} from 'common/plusGallery';

/** A version's save that has finished, and how. */
export interface IVersionSaveResult {
  version: number;
  outcome: TSaveGalleryVersion;
}

type TBridgeCall = (...args: unknown[]) => Promise<unknown>;

/**
 * One of main's save calls, if this window's bridge has it: a window opened
 * before the bridge learned them offers no Save rather than a broken one.
 */
const bridgeCall = (name: string): TBridgeCall | undefined => {
  const bridge: unknown = window.electron?.ipcRenderer;
  if (typeof bridge !== 'object' || bridge === null) {
    return undefined;
  }
  const call: unknown = Reflect.get(bridge, name);
  return typeof call === 'function'
    ? (...args: unknown[]) => Promise.resolve(Reflect.apply(call, bridge, args))
    : undefined;
};

/**
 * Saving one of the server's versions of a scene on this computer (Ivan,
 * 2026-11-09: "a member can pick any of those 10 and save it locally, and
 * that saved version stays theirs even after it leaves the server").
 *
 * One save at a time; it shows as running from the press until main
 * answers — a pack of up to 9 MB read whole, so there is no amount to
 * count — and it can be cancelled. Main finishes a save whatever this page
 * does, so leaving the page only stops this page listening for the answer;
 * the version is then among the scene's kept ones the next time it opens.
 */
export default function useSceneVersionSave(authorId: string, sceneId: string) {
  const [saving, setSaving] = useState<number>();
  const [result, setResult] = useState<IVersionSaveResult>();
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Another scene's page in this same card: nothing of the last one carries.
  useEffect(() => {
    setSaving(undefined);
    setResult(undefined);
  }, [authorId, sceneId]);

  const available = bridgeCall('saveGalleryVersion') !== undefined;

  const save = useCallback(
    (version: number) => {
      const call = bridgeCall('saveGalleryVersion');
      if (!call) {
        return;
      }
      setSaving(version);
      setResult(undefined);
      call(authorId, sceneId, version)
        .then(
          (answer) =>
            readSaveGalleryVersion(answer) ?? {
              ok: false as const,
              reason: 'failed' as const,
            },
        )
        .catch(() => ({ ok: false as const, reason: 'failed' as const }))
        .then((outcome) => {
          if (live.current) {
            setSaving(undefined);
            setResult({ version, outcome });
          }
          return undefined;
        })
        .catch(() => undefined);
    },
    [authorId, sceneId],
  );

  const cancel = useCallback(() => {
    if (saving === undefined) {
      return;
    }
    // The save answers 'cancelled' itself, or saved if it had already landed.
    bridgeCall('cancelGallerySaveVersion')?.(authorId, sceneId, saving).catch(
      () => undefined,
    );
  }, [authorId, sceneId, saving]);

  return { available, saving, result, save, cancel };
}
