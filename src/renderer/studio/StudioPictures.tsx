import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import type { LocaleCode, Translate, TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import type { IStudioPicture, TStudioPictures } from 'main/ipc/studioPictures';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import type { IPicturePreview } from './useScenePictures';
import StudioPictureDownloads, { regionKey } from './StudioPictureDownloads';
import StudioPictureLightbox, {
  type IViewedPicture,
} from './StudioPictureLightbox';
import StudioPictureViewButton from './StudioPictureViewButton';
import useAtlasImage from './useAtlasImage';
import '../styles/Gallery.scss';
import '../styles/StudioPictures.scss';

type TAtlas = Extract<TStudioPictures, { kind: 'atlas' }>;

interface IStudioPicturesProps {
  pictures: TStudioPictures | undefined;
  previews: Record<string, IPicturePreview>;
  /** The picture being opened or saved now. */
  busy?: string;
  onOpen: (picture: IStudioPicture) => void;
}

/** The set the viewer steps through, and the one it shows. */
interface IViewing {
  set: 'pieces' | 'pictures';
  key: string;
}

/** A picture's name, as the scene gives it, or its number in the row. */
export const pictureName = (
  picture: IStudioPicture,
  index: number,
  locale: LocaleCode,
  t: Translate,
) =>
  picture.names
    ? resolveSceneName({ names: picture.names }, locale)
    : t('studio.picture.unnamed', { number: index + 1 });

const pictureKey = (picture: IStudioPicture) => `picture:${picture.id}`;

/** The scene's pictures with something in them, as the viewer shows them. */
const filledPictures = (
  atlas: TAtlas,
  previews: Record<string, IPicturePreview>,
  locale: LocaleCode,
  t: Translate,
): IViewedPicture[] =>
  atlas.pictures.flatMap((picture, index) =>
    previews[picture.id]?.url
      ? [
          {
            key: pictureKey(picture),
            name: pictureName(picture, index, locale, t),
            region: {
              id: picture.id,
              x: picture.x,
              y: picture.y,
              width: picture.width,
              height: picture.height,
              rotated: false,
            },
            whole:
              picture.x === 0 &&
              picture.y === 0 &&
              picture.width === atlas.width &&
              picture.height === atlas.height,
          },
        ]
      : [],
  );

/**
 * Every picture the open scene asks for, by the name the scene gives it,
 * with what is in it now and the one button that changes it — on the bench,
 * under the stage, where the scene they go into is playing. Nothing when the
 * scene uses no pictures.
 *
 * An empty picture wears the loud button, because filling it is the next
 * thing to do; a filled one the quiet one — "Frame…" when its photo is kept
 * to frame again, "Change…" when there is only the image to replace.
 *
 * Any picture on the card, and any separate piece of the image, opens large
 * in the viewer when it is clicked, and steps through the others of its row.
 */
export default function StudioPictures({
  pictures,
  previews,
  busy,
  onOpen,
}: IStudioPicturesProps) {
  const { t, locale } = useTranslation();
  const titleId = useId();
  const atlas = pictures?.kind === 'atlas' ? pictures : undefined;
  const atlasImage = useAtlasImage(atlas?.image);
  const { save } = atlasImage;
  const [viewing, setViewing] = useState<IViewing>();

  const pieces = useMemo<IViewedPicture[]>(
    () =>
      (atlas?.regions ?? []).map((region) => ({
        key: regionKey(region),
        name: region.id,
        region,
        whole: false,
      })),
    [atlas],
  );
  const filled = useMemo(
    () => (atlas ? filledPictures(atlas, previews, locale, t) : []),
    [atlas, previews, locale, t],
  );
  const viewed = viewing?.set === 'pieces' ? pieces : filled;
  const at = viewing
    ? viewed.findIndex((picture) => picture.key === viewing.key)
    : -1;

  // A re-read that took the picture away closes the viewer, instead of
  // leaving it to open by itself if a picture of that name comes back.
  useEffect(() => {
    if (viewing && at < 0) {
      setViewing(undefined);
    }
  }, [viewing, at]);

  const close = useCallback(() => setViewing(undefined), []);
  const step = useCallback(
    (index: number) =>
      setViewing(
        (now) =>
          now && {
            set: now.set,
            key: (now.set === 'pieces' ? pieces : filled)[index].key,
          },
      ),
    [pieces, filled],
  );
  const saveViewed = useCallback(
    (picture: IViewedPicture) =>
      save(picture.key, picture.whole ? undefined : picture.region),
    [save],
  );

  if (!pictures || pictures.kind === 'none') {
    return null;
  }

  return (
    <section className="studio-card studio-pictures" aria-labelledby={titleId}>
      <div className="studio-pictures__head">
        <span className="studio-card__eyebrow" id={titleId}>
          {t('studio.picture.title')}
        </span>
        <span className="studio-pictures__lead">
          {pictures.kind === 'atlas'
            ? t('studio.picture.lead')
            : t('studio.picture.badSlot')}
        </span>
      </div>

      {atlas && (
        <StudioPictureDownloads
          atlas={atlas}
          url={atlasImage.url}
          busy={atlasImage.busy}
          // Said once, in the viewer, while it is open over the card.
          notice={viewing ? undefined : atlasImage.notice}
          onSave={save}
          onView={(region) =>
            setViewing({ set: 'pieces', key: regionKey(region) })
          }
        />
      )}

      {atlas && (
        <ul className="studio-pictures__list">
          {atlas.pictures.map((slot, index) => {
            const preview = previews[slot.id];
            const isFilled = preview?.filled ?? false;
            const running = busy === slot.id;
            const name = pictureName(slot, index, locale, t);
            let action: TranslationKey = 'studio.picture.pick';
            if (isFilled) {
              action = slot.hasPhoto
                ? 'studio.picture.adjust'
                : 'studio.picture.replace';
            }
            return (
              <li key={slot.id} className="studio-picture">
                <span
                  className={`studio-picture__frame${isFilled ? '' : ' is-empty'}`}
                >
                  {preview?.url ? (
                    <img
                      className="studio-picture__art"
                      src={preview.url}
                      alt=""
                      style={
                        {
                          '--aspect': slot.width / slot.height,
                        } as CSSProperties
                      }
                    />
                  ) : (
                    <span className="studio-picture__empty">
                      <Glyph name="camera" />
                      {t('studio.picture.empty')}
                    </span>
                  )}
                  {preview?.url && atlasImage.url && (
                    <StudioPictureViewButton
                      label={t('studio.picture.view', { name })}
                      onClick={() =>
                        setViewing({ set: 'pictures', key: pictureKey(slot) })
                      }
                    />
                  )}
                  {running && (
                    <span
                      className="studio-picture__busy"
                      role="status"
                      aria-label={t('studio.picture.saving')}
                    >
                      <span
                        className="gallery-preview__spinner"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </span>
                <span className="studio-picture__about">
                  <span className="studio-picture__name">{name}</span>
                  <span className="studio-picture__size">
                    {t('studio.picture.size', {
                      width: slot.width,
                      height: slot.height,
                    })}
                  </span>
                </span>
                <button
                  type="button"
                  className={`button small${isFilled ? ' subtle' : ''}${running ? ' is-running' : ''}`}
                  aria-busy={running}
                  aria-label={`${t(action)} ${name}`}
                  disabled={busy !== undefined && !running}
                  onClick={() => onOpen(slot)}
                >
                  <Glyph name="camera" />
                  {t(action)}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {atlas && atlasImage.url && at >= 0 && (
        <StudioPictureLightbox
          url={atlasImage.url}
          atlasWidth={atlas.width}
          atlasHeight={atlas.height}
          pictures={viewed}
          index={at}
          busy={atlasImage.busy}
          notice={atlasImage.notice}
          onStep={step}
          onSave={saveViewed}
          onClose={close}
        />
      )}
    </section>
  );
}
