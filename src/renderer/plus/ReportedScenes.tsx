import { useCallback, useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import type {
  IReportedScene,
  TModerationAction,
  TModerationList,
} from 'common/plusModeration';
import type { TModerationListOutcome } from 'main/ipc/plusModeration';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GalleryListNotice from './GalleryListNotice';
import {
  moderateReportedScene,
  setOpenReports,
  useModeration,
} from './moderationStore';
import { openGalleryPage } from './plusNavigation';
import ReportedSceneRow from './ReportedSceneRow';
import '../styles/GalleryModeration.scss';

type TListFailure = Extract<TModerationListOutcome, { ok: false }>['reason'];

const LIST_ERRORS: Record<TListFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
  forbidden: 'plus.moderation.forbidden',
};

const LISTS: readonly TModerationList[] = ['open', 'taken-down'];

const LIST_LABELS: Record<TModerationList, TranslationKey> = {
  open: 'plus.moderation.list.open',
  'taken-down': 'plus.moderation.list.takenDown',
};

type TQueue =
  | { state: 'loading' }
  | { state: 'ready'; scenes: IReportedScene[] }
  | { state: 'failed'; key: TranslationKey };

const rowKey = (entry: IReportedScene) => entry.scene.lookId;

interface IReportedScenesProps {
  me: string | undefined;
}

/**
 * The admin's queue: scenes members reported that nobody has reviewed, and
 * the scenes taken down, with the way back for each.
 *
 * Every answer is said through the gallery's own line under its head, and a
 * row leaves its list the moment the server accepts the answer — the list is
 * what is still to do.
 */
export default function ReportedScenes({ me }: IReportedScenesProps) {
  const { t, locale } = useTranslation();
  const moderation = useModeration();
  const [list, setList] = useState<TModerationList>('open');
  const [queue, setQueue] = useState<TQueue>({ state: 'loading' });
  const [confirming, setConfirming] = useState<string>();
  const [working, setWorking] = useState<{
    key: string;
    action: TModerationAction;
  }>();

  const load = useCallback(() => {
    let current = true;
    setQueue({ state: 'loading' });
    setConfirming(undefined);
    window.electron?.ipcRenderer
      ?.listReportedScenes?.(list)
      .then((outcome) => {
        if (!current) {
          return undefined;
        }
        if (!outcome.ok) {
          setQueue({ state: 'failed', key: LIST_ERRORS[outcome.reason] });
          return undefined;
        }
        setQueue({ state: 'ready', scenes: outcome.scenes });
        return undefined;
      })
      .catch(() => {
        if (current) {
          setQueue({ state: 'failed', key: 'plus.gallery.error.offline' });
        }
      });
    return () => {
      current = false;
    };
  }, [list]);

  useEffect(load, [load]);

  // The toolbar's count is the open list's length whenever that list is the
  // one on screen: it is the freshest answer there is.
  useEffect(() => {
    if (list === 'open' && queue.state === 'ready') {
      setOpenReports(me, queue.scenes.length);
    }
  }, [list, queue, me]);

  const act = (entry: IReportedScene, action: TModerationAction) => {
    const key = rowKey(entry);
    setWorking({ key, action });
    moderateReportedScene(entry, action, resolveSceneName(entry.scene, locale))
      .then((done) => {
        setWorking(undefined);
        setConfirming(undefined);
        if (done) {
          setQueue((current) =>
            current.state === 'ready'
              ? {
                  state: 'ready',
                  scenes: current.scenes.filter((row) => rowKey(row) !== key),
                }
              : current,
          );
        }
        return undefined;
      })
      .catch(() => setWorking(undefined));
  };

  const numbers = new Intl.NumberFormat(locale);
  const empty =
    list === 'open'
      ? {
          glyph: 'shield' as const,
          title: t('plus.moderation.empty.open'),
          hint: t('plus.moderation.empty.openHint'),
        }
      : {
          glyph: 'check' as const,
          title: t('plus.moderation.empty.takenDown'),
          hint: undefined,
        };

  return (
    <div className="gallery-page gallery-moderation">
      <div className="gallery-moderation__intro">
        <span className="gallery-moderation__mark" aria-hidden="true">
          <Glyph name="report" />
        </span>
        <p className="gallery-fine">{t('plus.moderation.hint')}</p>
        <div
          className="segmented gallery-moderation__lists"
          role="group"
          aria-label={t('plus.moderation.title')}
        >
          {LISTS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={`segmented__option${list === entry ? ' is-selected' : ''}`}
              aria-pressed={list === entry}
              onClick={() => setList(entry)}
            >
              {t(LIST_LABELS[entry])}
              {entry === 'open' && moderation.open > 0 && (
                <span className="gallery-moderation__count">
                  {numbers.format(moderation.open)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {queue.state === 'failed' && (
        <GalleryListNotice text={t(queue.key)} onRetry={load} />
      )}

      {queue.state === 'loading' && (
        <div
          className="gallery-rows"
          role="status"
          aria-label={t('plus.gallery.loading')}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="gallery-row gallery-row--skeleton"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {queue.state === 'ready' && queue.scenes.length === 0 && (
        <div className="community__empty gallery-empty">
          <span className="community__empty-mark" aria-hidden="true">
            <Glyph name={empty.glyph} />
          </span>
          <p className="community__empty-title">{empty.title}</p>
          {empty.hint && <p className="community__empty-hint">{empty.hint}</p>}
        </div>
      )}

      {queue.state === 'ready' && queue.scenes.length > 0 && (
        <ul className="gallery-rows">
          {queue.scenes.map((entry) => {
            const key = rowKey(entry);
            return (
              <ReportedSceneRow
                key={key}
                entry={entry}
                working={working?.key === key ? working.action : undefined}
                confirming={confirming === key}
                onConfirm={(next) => setConfirming(next ? key : undefined)}
                onAct={(action) => act(entry, action)}
                onOpen={() =>
                  openGalleryPage({
                    kind: 'scene',
                    scene: entry.scene,
                    report: entry,
                  })
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
