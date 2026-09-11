import { useId } from 'react';
import type { LocaleCode, Translate, TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import type { IStudioPicture, TStudioPictures } from 'main/ipc/studioPictures';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import type { IPicturePreview } from './useScenePictures';
import '../styles/Gallery.scss';
import '../styles/StudioPictures.scss';

interface IStudioPicturesProps {
  pictures: TStudioPictures | undefined;
  previews: Record<string, IPicturePreview>;
  /** The picture being opened or saved now. */
  busy?: string;
  onOpen: (picture: IStudioPicture) => void;
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

/**
 * Every picture the open scene asks for, by the name the scene gives it,
 * with what is in it now and the one button that changes it — on the bench,
 * under the stage, where the scene they go into is playing. Nothing when the
 * scene uses no pictures.
 *
 * An empty picture wears the loud button, because filling it is the next
 * thing to do; a filled one the quiet one — "Frame…" when its photo is kept
 * to frame again, "Change…" when there is only the image to replace.
 */
export default function StudioPictures({
  pictures,
  previews,
  busy,
  onOpen,
}: IStudioPicturesProps) {
  const { t, locale } = useTranslation();
  const titleId = useId();

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

      {pictures.kind === 'atlas' && (
        <ul className="studio-pictures__list">
          {pictures.pictures.map((slot, index) => {
            const preview = previews[slot.id];
            const filled = preview?.filled ?? false;
            const running = busy === slot.id;
            const name = pictureName(slot, index, locale, t);
            let action: TranslationKey = 'studio.picture.pick';
            if (filled) {
              action = slot.hasPhoto
                ? 'studio.picture.adjust'
                : 'studio.picture.replace';
            }
            return (
              <li key={slot.id} className="studio-picture">
                <span
                  className={`studio-picture__frame${filled ? '' : ' is-empty'}`}
                >
                  {preview?.url ? (
                    <img src={preview.url} alt="" />
                  ) : (
                    <span className="studio-picture__empty">
                      <Glyph name="camera" />
                      {t('studio.picture.empty')}
                    </span>
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
                  className={`button small${filled ? ' subtle' : ''}${running ? ' is-running' : ''}`}
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
    </section>
  );
}
