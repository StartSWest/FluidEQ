import type { TStudioPictures } from 'main/ipc/studioPictures';
import type { IArtworkRegion } from 'main/memberScenes/artworkRegions';
import type { TPictureCopyOutcome } from 'main/ipc/studioPictureCopy';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import AtlasPicture from './AtlasPicture';
import { decodePicture } from './scenePicture';
import StudioPictureViewButton from './StudioPictureViewButton';

type TAtlas = Extract<TStudioPictures, { kind: 'atlas' }>;

/** The save key of the whole image, saved as it is. */
export const WHOLE_IMAGE = 'image';

/** The save key of one separate piece. */
export const regionKey = (region: IArtworkRegion) => `region:${region.id}`;

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

interface IStudioPictureDownloadsProps {
  atlas: TAtlas;
  /** The whole image the pieces are drawn from; absent while it is made. */
  url: string | undefined;
  /** The save running now, if any. */
  busy: string | undefined;
  notice: TPictureCopyOutcome | undefined;
  onSave: (key: string, region?: IArtworkRegion) => void;
  onView: (region: IArtworkRegion) => void;
}

export default function StudioPictureDownloads({
  atlas,
  url,
  busy,
  notice,
  onSave,
  onView,
}: IStudioPictureDownloadsProps) {
  const { t } = useTranslation();
  return (
    <div className="studio-picture-downloads">
      <button
        type="button"
        className="button small subtle"
        disabled={!atlas.image || busy !== undefined}
        onClick={() => onSave(WHOLE_IMAGE)}
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
                    <>
                      <AtlasPicture
                        className="studio-picture__art"
                        url={url}
                        atlasWidth={atlas.width}
                        atlasHeight={atlas.height}
                        region={region}
                      />
                      <StudioPictureViewButton
                        label={t('studio.picture.view', { name: region.id })}
                        onClick={() => onView(region)}
                      />
                    </>
                  )}
                </span>
                <span className="studio-picture__name">{region.id}</span>
                <button
                  type="button"
                  className="button small subtle"
                  disabled={!atlas.image || busy !== undefined}
                  aria-label={`${t('studio.picture.download')} ${region.id}`}
                  onClick={() => onSave(regionKey(region), region)}
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
