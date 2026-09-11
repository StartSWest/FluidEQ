import { useEffect, useId, useState } from 'react';
import type { TStudioPictures } from 'main/ipc/studioPictures';
import type { IArtworkRegion } from 'main/memberScenes/artworkRegions';
import type { TPictureCopyOutcome } from 'main/ipc/studioPictureCopy';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { decodePicture } from './scenePicture';

type TAtlas = Extract<TStudioPictures, { kind: 'atlas' }>;

/** Lossless copy of one atlas region, including undoing packing rotation. */
export const copyRegion = async (image: Uint8Array, region: IArtworkRegion) => {
  const bitmap = await decodePicture(image);
  if (!bitmap) {
    return undefined;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = region.rotated ? region.height : region.width;
    canvas.height = region.rotated ? region.width : region.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }
    if (region.rotated) {
      context.translate(0, canvas.height);
      context.rotate(-Math.PI / 2);
    }
    context.drawImage(
      bitmap,
      region.x,
      region.y,
      region.width,
      region.height,
      0,
      0,
      region.width,
      region.height,
    );
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
  } finally {
    bitmap.close();
  }
};

export default function StudioPictureDownloads({ atlas }: { atlas: TAtlas }) {
  const { t } = useTranslation();
  const clipId = useId();
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<TPictureCopyOutcome>();
  const [preview, setPreview] = useState<{ image: Uint8Array; url: string }>();
  useEffect(() => {
    if (!atlas.image) {
      setPreview(undefined);
      return undefined;
    }
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(atlas.image)], { type: 'image/webp' }),
    );
    setPreview({ image: atlas.image, url });
    setNotice(undefined);
    return () => URL.revokeObjectURL(url);
  }, [atlas.image]);
  const url = preview?.image === atlas.image ? preview?.url : undefined;
  const save = async (region?: IArtworkRegion) => {
    if (!atlas.image || busy) {
      return;
    }
    setBusy(region?.id ?? 'atlas');
    setNotice(undefined);
    try {
      const bytes = region
        ? await copyRegion(atlas.image, region)
        : atlas.image;
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
  };
  return (
    <div className="studio-picture-downloads">
      <button
        type="button"
        className="button small subtle"
        disabled={!atlas.image || busy !== undefined}
        onClick={() => save()}
      >
        <Glyph name="download" />
        {t('studio.picture.download')}
      </button>
      {notice && notice !== 'cancelled' && (
        <span role="status">
          {t(
            notice === 'saved'
              ? 'studio.picture.downloaded'
              : 'studio.picture.downloadFailed',
          )}
        </span>
      )}
      {!!atlas.regions?.length && (
        <details className="studio-picture-regions">
          <summary>
            {t('studio.picture.separate', { count: atlas.regions.length })}
          </summary>
          <p className="studio-pictures__lead">
            {t('studio.picture.separateHint')}
          </p>
          <ul className="studio-pictures__list">
            {atlas.regions.map((region) => (
              <li className="studio-picture" key={region.id}>
                <span className="studio-picture__frame">
                  {url && (
                    <svg
                      viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`}
                      aria-hidden="true"
                    >
                      <defs>
                        <clipPath id={`${clipId}-${region.id}`}>
                          <rect
                            x={region.x}
                            y={region.y}
                            width={region.width}
                            height={region.height}
                          />
                        </clipPath>
                      </defs>
                      <image
                        href={url}
                        width={atlas.width}
                        height={atlas.height}
                        clipPath={`url(#${clipId}-${region.id})`}
                      />
                    </svg>
                  )}
                </span>
                <span className="studio-picture__name">{region.id}</span>
                <button
                  type="button"
                  className="button small subtle"
                  disabled={!atlas.image || busy !== undefined}
                  aria-label={`${t('studio.picture.download')} ${region.id}`}
                  onClick={() => save(region)}
                >
                  <Glyph name="download" />
                  {t('studio.picture.download')}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
