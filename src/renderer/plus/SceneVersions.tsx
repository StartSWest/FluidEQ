/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { IGalleryScene, IGalleryVersion } from 'common/plusGallery';
import { isNewSceneVersion } from 'common/sceneVersionNote';
import { absoluteTime } from '../forum/forumTime';
import { useTranslation } from '../utils/I18nContext';

interface ISceneVersionsProps {
  scene: IGalleryScene;
}

const dateOf = (iso: string, locale: string) => {
  const then = Date.parse(iso);
  return Number.isFinite(then)
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(then)
    : '';
};

/**
 * Which version of a scene this is, what its maker wrote about it, and the
 * versions before it — on the scene's page, under its name.
 *
 * The earlier versions are asked for when the page opens and fold away until
 * wanted: most visits are to play the scene, not to read its history, and a
 * server from before version notes answers with none, which shows nothing.
 */
export default function SceneVersions({ scene }: ISceneVersionsProps) {
  const { t, locale } = useTranslation();
  const [earlier, setEarlier] = useState<IGalleryVersion[]>([]);
  const { authorId, sceneId, version, updatedAt } = scene;

  useEffect(() => {
    let cancelled = false;
    setEarlier([]);
    window.electron?.ipcRenderer
      ?.galleryVersions?.(authorId, sceneId)
      .then((outcome) => {
        if (!cancelled && outcome.ok) {
          setEarlier(
            outcome.versions.filter((entry) => entry.version < version),
          );
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authorId, sceneId, version, updatedAt]);

  const isNew = isNewSceneVersion(scene, Date.now());

  return (
    <section className="gallery-versions" aria-label={t('plus.version.title')}>
      <p
        className="gallery-versions__line"
        title={absoluteTime(updatedAt, locale)}
      >
        {t('plus.version.pageLine', {
          version: String(version),
          date: dateOf(updatedAt, locale),
        })}
        {isNew && (
          <span className="gallery-versions__new">{t('plus.version.new')}</span>
        )}
      </p>
      {scene.versionNote && (
        <div className={`gallery-versions__note${isNew ? ' is-new' : ''}`}>
          <span className="gallery-versions__note-title">
            {t('plus.version.whatsNew', { version: String(version) })}
          </span>
          <p>{scene.versionNote}</p>
        </div>
      )}
      {earlier.length > 0 && (
        <details className="gallery-versions__history">
          <summary>
            {t('plus.version.earlier', { count: String(earlier.length) })}
          </summary>
          <ol className="gallery-versions__list">
            {earlier.map((entry) => (
              <li key={entry.version}>
                <span className="gallery-versions__number">
                  {t('plus.version.short', { version: String(entry.version) })}
                </span>
                <span className="gallery-versions__text">
                  {entry.note ?? (
                    <span className="gallery-versions__quiet">
                      {t('plus.version.noNote')}
                    </span>
                  )}
                  <time dateTime={entry.publishedAt}>
                    {dateOf(entry.publishedAt, locale)}
                  </time>
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
