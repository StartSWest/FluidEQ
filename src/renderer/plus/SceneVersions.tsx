/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useState } from 'react';
import type { IGalleryScene, IGalleryVersion } from 'common/plusGallery';
import type { IKeptSceneVersions } from 'common/sceneStore';
import { isNewSceneVersion } from 'common/sceneVersionNote';
import { absoluteTime } from '../forum/forumTime';
import { useTranslation } from '../utils/I18nContext';

interface ISceneVersionsProps {
  scene: IGalleryScene;
}

/** One earlier version as the list shows it: the server's, this computer's, or both. */
interface IVersionRow {
  version: number;
  note?: string;
  publishedAt?: string;
  kept: boolean;
}

const dateOf = (iso: string, locale: string) => {
  const then = Date.parse(iso);
  return Number.isFinite(then)
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(then)
    : '';
};

const NOTHING_KEPT: IKeptSceneVersions = { versions: [] };

/**
 * Which version of a scene this is, what its maker wrote about it, and the
 * versions before it — on the scene's page, under its name.
 *
 * The earlier versions are asked for when the page opens and fold away until
 * wanted: most visits are to play the scene, not to read its history, and a
 * server from before version notes answers with none, which shows nothing.
 *
 * An owner can play again any earlier version this computer kept — every
 * version it had, from its own copies, so going back downloads nothing. The
 * list opens by itself while one plays, and says so above it with the way
 * back to the newest.
 */
export default function SceneVersions({ scene }: ISceneVersionsProps) {
  const { t, locale } = useTranslation();
  const [earlier, setEarlier] = useState<IGalleryVersion[]>([]);
  const [kept, setKept] = useState<IKeptSceneVersions>(NOTHING_KEPT);
  // Bumped to ask again: a buy makes a scene owned, a play changes which
  // version plays.
  const [keptAsk, setKeptAsk] = useState(0);
  const [busy, setBusy] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    window.electron?.ipcRenderer
      ?.keptSceneVersions?.(authorId, sceneId)
      .then((answer) => {
        if (!cancelled) {
          setKept(answer);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authorId, sceneId, version, keptAsk]);

  useEffect(
    () =>
      window.electron?.ipcRenderer?.onSceneStoreChanged?.(() =>
        setKeptAsk((ask) => ask + 1),
      ),
    [],
  );

  const rows = useMemo((): IVersionRow[] => {
    const held = new Set(kept.versions);
    const listed = earlier.map((entry) => ({
      ...entry,
      kept: held.has(entry.version),
    }));
    const onlyHere = kept.versions
      .filter(
        (entry) =>
          entry < version && !earlier.some((row) => row.version === entry),
      )
      .map((entry) => ({ version: entry, kept: true }));
    return [...listed, ...onlyHere].sort((a, b) => b.version - a.version);
  }, [earlier, kept, version]);

  const play = (next: number | null) => {
    setBusy(true);
    (
      window.electron?.ipcRenderer?.playSceneVersion?.(
        authorId,
        sceneId,
        next,
      ) ?? Promise.resolve(false)
    )
      .catch(() => false)
      .finally(() => {
        setBusy(false);
        setKeptAsk((ask) => ask + 1);
      });
  };

  const isNew = isNewSceneVersion(scene, Date.now());
  const { playing } = kept;

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
      {playing !== undefined && (
        <div className="gallery-versions__pinned" role="status">
          <p>{t('plus.version.playingLine', { version: String(playing) })}</p>
          <button
            type="button"
            className="button small subtle"
            disabled={busy}
            onClick={() => play(null)}
          >
            {t('plus.version.backToNewest')}
          </button>
        </div>
      )}
      {scene.versionNote && (
        <div className={`gallery-versions__note${isNew ? ' is-new' : ''}`}>
          <span className="gallery-versions__note-title">
            {t('plus.version.whatsNew', { version: String(version) })}
          </span>
          <p>{scene.versionNote}</p>
        </div>
      )}
      {rows.length > 0 && (
        <details
          className="gallery-versions__history"
          open={playing !== undefined || undefined}
        >
          <summary>
            {t('plus.version.earlier', { count: String(rows.length) })}
          </summary>
          <ol className="gallery-versions__list">
            {rows.map((entry) => (
              <li
                key={entry.version}
                className={entry.version === playing ? 'is-playing' : undefined}
              >
                <span className="gallery-versions__number">
                  {t('plus.version.short', { version: String(entry.version) })}
                </span>
                <span className="gallery-versions__text">
                  {entry.note ?? (
                    <span className="gallery-versions__quiet">
                      {entry.publishedAt
                        ? t('plus.version.noNote')
                        : t('plus.version.keptHere')}
                    </span>
                  )}
                  {entry.publishedAt && (
                    <time dateTime={entry.publishedAt}>
                      {dateOf(entry.publishedAt, locale)}
                    </time>
                  )}
                </span>
                {entry.version === playing && (
                  <span className="gallery-versions__playing">
                    {t('plus.version.playing')}
                  </span>
                )}
                {entry.kept && entry.version !== playing && (
                  <button
                    type="button"
                    className="button small subtle gallery-versions__play"
                    disabled={busy}
                    aria-label={t('plus.version.playLabel', {
                      version: String(entry.version),
                    })}
                    onClick={() => play(entry.version)}
                  >
                    {t('plus.version.play')}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
