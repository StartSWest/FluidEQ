/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useState } from 'react';
import {
  versionLineIn,
  type IGalleryScene,
  type IGalleryVersion,
} from 'common/plusGallery';
import type { IKeptSceneVersions } from 'common/sceneStore';
import { isNewSceneVersion } from 'common/sceneVersionNote';
import { absoluteTime } from '../forum/forumTime';
import { useTranslation } from '../utils/I18nContext';
import {
  SceneVersionSaveButton,
  SceneVersionSaveNote,
} from './SceneVersionSave';
import useSceneVersionSave from './useSceneVersionSave';

interface ISceneVersionsProps {
  scene: IGalleryScene;
  /**
   * Whether this account may keep one of the server's versions here: it owns
   * the scene and did not make it. A maker's history is their Studio
   * project, and their own scene plays no kept version (main refuses it).
   */
  mayKeep: boolean;
  /** The version of it in this member's looks; undefined while it is not. */
  inLooks: number | undefined;
}

/**
 * Versions listed at most: the server keeps the files of a scene's last 10
 * (Ivan, 2026-11-09), so older ones could be read about and never had. The
 * current version is one of them; one this computer kept is listed however
 * old, because it plays here.
 */
const LISTED_VERSIONS = 10;

/** One earlier version as the list shows it: the server's, this computer's, or both. */
interface IVersionRow {
  version: number;
  note?: string;
  notes?: import('common/sceneVersionNote').TVersionNotes;
  publishedAt?: string;
  kept: boolean;
  /** The server still holds it, so an owner may save it here. */
  available: boolean;
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
 * Every version is listed open under it, up to the last 10, each with its
 * date and its "What's new" in the reader's language, and the one in the
 * member's looks marked; a scene with one version says so (Ivan, 2026-11-12:
 * "we are not showing all versions, all last 10 versions"). The list used to
 * fold away behind a summary, and to show nothing at all for a first
 * version.
 *
 * An owner can play again any earlier version this computer kept — every
 * version it had, from its own copies, so going back downloads nothing. While
 * one plays the list says so above it, with the way back to the newest.
 *
 * And an owner can save any version the server still holds — its last 10
 * (Ivan, 2026-11-09) — onto this computer, where it stays theirs after the
 * server lets it go: one of the scene's kept versions from then on, played
 * from this same list. The version the scene is at now heads the list,
 * marked, with nothing to save.
 */
export default function SceneVersions({
  scene,
  mayKeep,
  inLooks,
}: ISceneVersionsProps) {
  const { t, locale } = useTranslation();
  // What is new in this version, in the reader's language or English.
  const currentLine = versionLineIn(
    scene.versionNote,
    scene.versionNotes,
    locale,
  );
  const [earlier, setEarlier] = useState<IGalleryVersion[]>([]);
  const [kept, setKept] = useState<IKeptSceneVersions>(NOTHING_KEPT);
  // Bumped to ask again: a buy makes a scene owned, a play changes which
  // version plays.
  const [keptAsk, setKeptAsk] = useState(0);
  const [busy, setBusy] = useState(false);
  const { authorId, sceneId, version, updatedAt } = scene;
  const saving = useSceneVersionSave(authorId, sceneId);
  const [current, setCurrent] = useState<IGalleryVersion>();

  useEffect(() => {
    let cancelled = false;
    setEarlier([]);
    setCurrent(undefined);
    window.electron?.ipcRenderer
      ?.galleryVersions?.(authorId, sceneId)
      .then((outcome) => {
        if (!cancelled && outcome.ok) {
          setEarlier(
            outcome.versions.filter((entry) => entry.version < version),
          );
          setCurrent(
            outcome.versions.find((entry) => entry.version === version),
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

  // A version just saved is one of the kept ones now: asked for again, so
  // its Play is there without waiting on the store's own word.
  const savedVersion =
    saving.result?.outcome.ok === true ? saving.result.version : undefined;
  useEffect(() => {
    if (savedVersion !== undefined) {
      setKeptAsk((ask) => ask + 1);
    }
  }, [savedVersion]);

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
      // A server from before it kept versions says nothing: nothing to save.
      available: entry.available === true,
    }));
    const onlyHere = kept.versions
      .filter(
        (entry) =>
          entry < version && !earlier.some((row) => row.version === entry),
      )
      .map((entry) => ({ version: entry, kept: true, available: false }));
    // The newest, the current version counted among the ten; a version kept
    // here stays listed however old, or its Play would vanish.
    return [...listed, ...onlyHere]
      .sort((a, b) => b.version - a.version)
      .filter((entry, at) => at < LISTED_VERSIONS - 1 || entry.kept);
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
      {currentLine && (
        <div className={`gallery-versions__note${isNew ? ' is-new' : ''}`}>
          <span className="gallery-versions__note-title">
            {t('plus.version.whatsNew', { version: String(version) })}
          </span>
          <p>{currentLine}</p>
        </div>
      )}
      <div className="gallery-versions__history">
        <h3 className="gallery-versions__heading">
          {/* The current version heads the list, so it is counted. */}
          {t('plus.version.all', { count: String(rows.length + 1) })}
        </h3>
        <ol className="gallery-versions__list">
          <li className="is-current">
            <span className="gallery-versions__number">
              {t('plus.version.short', { version: String(version) })}
            </span>
            <span className="gallery-versions__text">
              {/* Its note is "What's new" just above: not said twice. */}
              {!currentLine &&
                (versionLineIn(current?.note, current?.notes, locale) ?? (
                  <span className="gallery-versions__quiet">
                    {t('plus.version.noNote')}
                  </span>
                ))}
              <time dateTime={current?.publishedAt ?? updatedAt}>
                {dateOf(current?.publishedAt ?? updatedAt, locale)}
              </time>
            </span>
            <span className="gallery-versions__tags">
              <span className="gallery-versions__playing gallery-versions__current">
                {t('plus.version.current')}
              </span>
              {inLooks === version && (
                <span className="gallery-versions__mine">
                  {t('plus.version.inLooks')}
                </span>
              )}
            </span>
          </li>
          {rows.map((entry) => (
            <li
              key={entry.version}
              className={entry.version === playing ? 'is-playing' : undefined}
            >
              <span className="gallery-versions__number">
                {t('plus.version.short', { version: String(entry.version) })}
              </span>
              <span className="gallery-versions__text">
                {versionLineIn(entry.note, entry.notes, locale) ?? (
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
                {mayKeep && (
                  <SceneVersionSaveNote
                    version={entry.version}
                    kept={entry.kept}
                    available={entry.available}
                    listed={entry.publishedAt !== undefined}
                    saving={saving}
                  />
                )}
              </span>
              <span className="gallery-versions__tags">
                {entry.version === playing && (
                  <span className="gallery-versions__playing">
                    {t('plus.version.playing')}
                  </span>
                )}
                {entry.version === inLooks && (
                  <span className="gallery-versions__mine">
                    {t('plus.version.inLooks')}
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
                {mayKeep &&
                  !entry.kept &&
                  entry.available &&
                  saving.available && (
                    <SceneVersionSaveButton
                      version={entry.version}
                      saving={saving}
                    />
                  )}
              </span>
            </li>
          ))}
        </ol>
        {rows.length === 0 && (
          <p className="gallery-versions__quiet gallery-versions__only">
            {t('plus.version.onlyOne')}
          </p>
        )}
      </div>
    </section>
  );
}
