import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PLUS_CATEGORIES, type TPlusCategory } from 'common/plusGallery';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph from '../community/Glyph';
import { categoryKey } from '../plus/GalleryParts';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import type { IPublishDraft } from './useStudioPublish';
import '../styles/Gallery.scss';

interface IStudioPublishDialogProps {
  name: string;
  version: number;
  draft: IPublishDraft;
  running: boolean;
  onPublish: (category: TPlusCategory) => void;
  onCancel: () => void;
}

/**
 * Publishing a scene to the gallery: the picture it will show with — taken
 * from the stage a moment ago — a category from the fixed list, and the three
 * sentences that matter about what publishing means.
 *
 * The category is chosen, never typed: nothing reaches the gallery that a
 * member wrote except the scene's own name, which the app already checked.
 * Publish is disabled until a category is picked; an update starts on the one
 * the scene already has.
 */
export default function StudioPublishDialog({
  name,
  version,
  draft,
  running,
  onPublish,
  onCancel,
}: IStudioPublishDialogProps) {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const [category, setCategory] = useState<TPlusCategory | undefined>(
    draft.published?.category,
  );
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
        className="gallery-dialog gallery-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-publish-title"
        aria-busy={running}
      >
        <div className="gallery-dialog__head">
          <span className="gallery-dialog__mark" aria-hidden="true">
            <Glyph name="upload" />
          </span>
          <h2 id="studio-publish-title" className="gallery-dialog__title">
            {update
              ? t('studio.publish.titleUpdate', { name })
              : t('studio.publish.title', { name })}
          </h2>
        </div>

        <div className="studio-publish__scene">
          <img
            className="studio-publish__picture"
            src={draft.pictureUrl}
            alt={t('studio.publish.pictureAlt', { name })}
          />
          <span className="studio-publish__about">
            <strong>{name}</strong>
            <span>
              {t('studio.publish.version', { version: String(version) })}
            </span>
            <span className="studio-publish__hint">
              {t('studio.publish.pictureHint')}
            </span>
          </span>
        </div>

        <span className="gallery-dialog__label" id="studio-publish-category">
          {t('studio.publish.category')}
        </span>
        <div
          className="gallery-chips"
          role="radiogroup"
          aria-labelledby="studio-publish-category"
        >
          {PLUS_CATEGORIES.map((entry, index) => (
            <button
              key={entry}
              ref={index === 0 ? firstRef : undefined}
              type="button"
              role="radio"
              aria-checked={category === entry}
              className="gallery-chip"
              disabled={running}
              onClick={() => setCategory(entry)}
            >
              {t(categoryKey(entry))}
            </button>
          ))}
        </div>

        <ul className="gallery-points">
          <li>{t('studio.publish.point1')}</li>
          <li>{t('studio.publish.point2')}</li>
          <li>
            {update
              ? t('studio.publish.point3Update')
              : t('studio.publish.point3')}
          </li>
        </ul>

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
                onPublish(category);
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
