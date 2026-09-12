import { useState, type MouseEvent } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId, packIdOfLook } from 'common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import { refreshMemberScenes } from '../utils/memberScenes';
import { refreshScenePacks } from '../utils/scenePacks';
import '../styles/GraphSceneRemove.scss';

/** Only removes a local scene copy, never a project or publication. */
export default function GraphSceneRemove({
  lookId,
  name,
}: {
  lookId: string;
  name: string;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const official = isPremiumLookId(lookId);
  if (!official && !isMemberLookId(lookId)) {
    return null;
  }
  const remove = async (event: MouseEvent) => {
    event.stopPropagation();
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const api = window.electron?.ipcRenderer;
      const removed = official
        ? await api?.removeScenePack?.(packIdOfLook(lookId))
        : await api?.removeMemberScene?.(lookId);
      if (!removed) {
        throw new Error('Scene was not removed');
      }
      if (official) {
        await refreshScenePacks(true);
      } else {
        await refreshMemberScenes();
      }
      setConfirming(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className={`graph-scene-remove${confirming ? ' is-confirming' : ''}`}>
      {confirming ? (
        <>
          <span
            className="graph-scene-remove__question"
            role={failed ? 'alert' : undefined}
          >
            {failed
              ? t('plus.remove.failed', { name })
              : t('plus.remove.confirm')}
          </span>
          <button
            type="button"
            className="button small subtle graph-scene-remove__cancel"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              setConfirming(false);
              setFailed(false);
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m5 5 6 6m0-6-6 6" />
            </svg>
            {t('plus.report.cancel')}
          </button>
          <button
            type="button"
            className="button small graph-scene-remove__confirm"
            disabled={busy}
            aria-busy={busy}
            onClick={remove}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10M7 6v5M9 6v5" />
            </svg>
            {t('plus.card.remove')}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="graph-scene-remove__open"
          aria-label={`${t('plus.card.remove')} ${name}`}
          title={`${t('plus.card.remove')} ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            setConfirming(true);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10M7 6v5M9 6v5" />
          </svg>
        </button>
      )}
    </span>
  );
}
