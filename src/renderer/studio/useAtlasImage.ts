import { useCallback, useEffect, useState } from 'react';
import type { IArtworkRegion } from 'main/memberScenes/artworkRegions';
import type { TPictureCopyOutcome } from 'main/ipc/studioPictureCopy';
import { copyRegion } from './StudioPictureDownloads';

/**
 * The scene's whole image on the Pictures card: one object URL every tile and
 * the viewer draw from, and saving it — whole, or one piece of it — to a file
 * the member picks.
 *
 * One of these for the card, not one per surface. The viewer's Save and the
 * card's are the same action, so they share one `busy`: a second save cannot
 * start while the system's save dialog for the first is still open.
 */
export default function useAtlasImage(image: Uint8Array | undefined) {
  /** Which save is running, by the key its caller gave it. */
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<TPictureCopyOutcome>();
  const [shown, setShown] = useState<{ image: Uint8Array; url: string }>();

  useEffect(() => {
    if (!image) {
      setShown(undefined);
      return undefined;
    }
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(image)], { type: 'image/webp' }),
    );
    setShown({ image, url });
    setNotice(undefined);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  // For the render between a new image arriving and the effect above: the
  // URL still held was made for the old image and has just been revoked.
  const url = shown?.image === image ? shown?.url : undefined;

  /** Saves `region` of the image, or with none the image itself, unchanged. */
  const save = useCallback(
    async (key: string, region?: IArtworkRegion) => {
      if (!image || busy) {
        return;
      }
      setBusy(key);
      setNotice(undefined);
      try {
        const bytes = region ? await copyRegion(image, region) : image;
        setNotice(
          bytes
            ? ((await window.electron?.ipcRenderer?.copyStudioPicture?.(
                bytes,
                region?.id ?? 'scene-artwork',
              )) ?? 'failed')
            : 'failed',
        );
      } catch {
        setNotice('failed');
      } finally {
        setBusy(undefined);
      }
    },
    [image, busy],
  );

  return { url, busy, notice, save };
}
