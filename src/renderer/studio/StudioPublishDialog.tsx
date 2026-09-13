import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLUS_CATEGORIES, type TPlusCategory } from 'common/plusGallery';
import type { IScenePack } from 'common/scenePacks';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph from '../community/Glyph';
import type { ISceneFrame } from '../graph/sceneGl';
import type { ISceneTuning } from '../graph/useSceneRunner';
import { categoryKey } from '../plus/GalleryParts';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import StudioPublishCamera from './StudioPublishCamera';
import StudioPublishCovers from './StudioPublishCovers';
import type { IPublishDraft } from './useStudioPublish';
import '../styles/Gallery.scss';
import '../styles/StudioPublish.scss';

interface IStudioPublishDialogProps {
  /** The project, so the dialog's stage is its own. */
  identity: string;
  pack: IScenePack;
  name: string;
  draft: IPublishDraft;
  running: boolean;
  /** The Studio's settings, so the scene plays here as it does on the stage. */
  tuning: ISceneTuning;
  onCapture: (frames: ISceneFrame[]) => void;
  onChoose: (id: number) => void;
  /** The first category, the one a card names, and an optional second. */
  onPublish: (category: TPlusCategory, category2?: TPlusCategory) => void;
  onCancel: () => void;
}

/**
 * Publishing a scene to the gallery: the scene itself, playing, to catch its
 * cover from — a picture the dialog opens with is there already, and every
 * capture joins it to choose between — then a category from the fixed list
 * and the three sentences that matter about what publishing means.
 *
 * The categories are chosen, never typed: nothing reaches the gallery that a
 * member wrote except the scene's own name, which the app already checked.
 * Up to two, because one made a maker choose between what a scene shows and
 * what it is — a skyline on a lake is Cities and Water. The first picked is
 * the one its card names, and the chips number themselves once there are two.
 * A third pick takes the second's place, so the first stays put. Publish is
 * disabled until one is picked; an update starts on the ones the scene has.
 */
export default function StudioPublishDialog({
  identity,
  pack,
  name,
  draft,
  running,
  tuning,
  onCapture,
  onChoose,
  onPublish,
  onCancel,
}: IStudioPublishDialogProps) {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const [categories, setCategories] = useState<TPlusCategory[]>(() =>
    [draft.published?.category, draft.published?.category2].flatMap((entry) =>
      entry ? [entry] : [],
    ),
  );
  const [category, category2] = categories;
  const pick = (entry: TPlusCategory) =>
    setCategories((current) => {
      if (current.includes(entry)) {
        return current.filter((chosen) => chosen !== entry);
      }
      return current.length < 2 ? [...current, entry] : [current[0], entry];
    });
  const cancel = useCallback(() => onCancel(), [onCancel]);
  useModalKeys(surfaceRef, firstRef, { busy: running, onCancel: cancel });

  const update = draft.published !== undefined;
  let go = update ? t('studio.publish.goUpdate') : t('studio.publish.go');
  if (!draft.agreed) {
    go = t('studio.publish.agree');
  }

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !running) {
          cancel();
        }
      }}
    >
      <div
        ref={surfaceRef}
        className="gallery-dialog studio-publish"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-publish-title"
        aria-busy={running}
      >
        <div className="gallery-dialog__head">
          <span className="gallery-dialog__mark" aria-hidden="true">
            <Glyph name="upload" />
          </span>
          <span className="studio-publish__heading">
            <h2 id="studio-publish-title" className="gallery-dialog__title">
              {update
                ? t('studio.publish.titleUpdate', { name })
                : t('studio.publish.title', { name })}
            </h2>
            <span className="studio-publish__version">
              {t('studio.publish.version', { version: String(pack.version) })}
            </span>
          </span>
        </div>

        <div className="studio-publish__body">
          <StudioPublishCamera
            identity={identity}
            pack={pack}
            name={name}
            locked={running}
            tuning={tuning}
            onCapture={onCapture}
          />

          <StudioPublishCovers
            shots={draft.shots}
            chosen={draft.chosen}
            missed={draft.missed}
            locked={running}
            onChoose={onChoose}
          />

          <div className="studio-publish__category">
            <span
              className="gallery-dialog__label"
              id="studio-publish-category"
            >
              {t('studio.publish.category')}
            </span>
            <span className="studio-publish__category-hint">
              {t('studio.publish.categoryHint')}
            </span>
            <div
              className="gallery-chips"
              role="group"
              aria-labelledby="studio-publish-category"
            >
              {PLUS_CATEGORIES.map((entry, index) => (
                <button
                  key={entry}
                  ref={index === 0 ? firstRef : undefined}
                  type="button"
                  aria-pressed={categories.includes(entry)}
                  className="gallery-chip"
                  disabled={running}
                  onClick={() => pick(entry)}
                >
                  {t(categoryKey(entry))}
                  {categories.length === 2 && categories.includes(entry) && (
                    <span className="studio-publish__order" aria-hidden="true">
                      {categories.indexOf(entry) + 1}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <ul className="gallery-points studio-publish__points">
            <li>{t('studio.publish.point1')}</li>
            <li>{t('studio.publish.point2')}</li>
            <li>
              {update
                ? t('studio.publish.point3Update')
                : t('studio.publish.point3')}
            </li>
          </ul>
        </div>

        <div className="gallery-dialog__foot">
          <button
            type="button"
            className="button small subtle gallery-dialog__aside"
            disabled={running}
            onClick={() => {
              // The terms open in the Account dialog, which would otherwise
              // appear underneath this one.
              cancel();
              requestAccountPanel('terms');
            }}
          >
            {t('studio.publish.read')}
          </button>
          <button
            type="button"
            className="button small subtle"
            disabled={running}
            onClick={cancel}
          >
            {t('studio.publish.cancel')}
          </button>
          <button
            type="button"
            className={`button small${running ? ' is-running' : ''}`}
            aria-busy={running}
            disabled={!category}
            title={category ? undefined : t('studio.publish.pickCategory')}
            onClick={() => {
              if (category && !running) {
                onPublish(category, category2);
              }
            }}
          >
            {running ? t('studio.publish.running') : go}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
