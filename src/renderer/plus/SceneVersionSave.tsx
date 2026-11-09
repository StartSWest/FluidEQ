import type { TSaveGalleryVersion } from 'common/plusGallery';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import type useSceneVersionSave from './useSceneVersionSave';

/** What a finished save that did not save says, by why. */
const FAILURES: Record<
  Exclude<Extract<TSaveGalleryVersion, { ok: false }>['reason'], 'cancelled'>,
  TranslationKey
> = {
  'signed-out': 'plus.version.failSignedOut',
  'not-owned': 'plus.version.failNotOwned',
  gone: 'plus.version.failGone',
  offline: 'plus.version.failOffline',
  failed: 'plus.version.failFailed',
};

type TSaving = ReturnType<typeof useSceneVersionSave>;

interface ISaveProps {
  version: number;
  saving: TSaving;
}

/**
 * An earlier version's Save, in the row's last column where a kept one has
 * its Play, and the same quiet button: one word, so a list of ten does not
 * become a wall of sentences, and the row says what it saves to a screen
 * reader. It breathes while its save runs (`is-running`).
 */
export function SceneVersionSaveButton({ version, saving }: ISaveProps) {
  const { t } = useTranslation();
  const running = saving.saving === version;
  return (
    <button
      type="button"
      className={`button small subtle gallery-versions__play${running ? ' is-running' : ''}`}
      aria-busy={running}
      disabled={saving.saving !== undefined && !running}
      aria-label={t('plus.version.saveLabel', { version: String(version) })}
      onClick={() => {
        if (!running) {
          saving.save(version);
        }
      }}
    >
      {t('plus.version.saveShort')}
    </button>
  );
}

interface ISaveNoteProps extends ISaveProps {
  /** Already among this computer's kept versions. */
  kept: boolean;
  /** The server still holds it. */
  available: boolean;
  /** Listed by the server at all, as opposed to kept here alone. */
  listed: boolean;
}

/**
 * Under an earlier version's note and date, for the scene's owner: "Saving…"
 * with a Cancel from the press until main answers, then what happened —
 * saved, which makes it one of the kept versions with a Play, or why not —
 * and, for a version the server has let go and this computer never kept,
 * that it is gone.
 */
export function SceneVersionSaveNote({
  version,
  kept,
  available,
  listed,
  saving,
}: ISaveNoteProps) {
  const { t } = useTranslation();
  const words = { version: String(version) };
  const outcome =
    saving.result?.version === version ? saving.result.outcome : undefined;

  if (saving.saving === version) {
    return (
      <span className="gallery-versions__save" role="status">
        <span className="gallery-versions__saving">
          {t('plus.version.saving')}
        </span>
        <button
          type="button"
          className="button small subtle"
          onClick={saving.cancel}
        >
          {t('plus.version.cancelSave')}
        </button>
      </span>
    );
  }
  if (outcome?.ok === true) {
    return (
      <span className="gallery-versions__saved" role="status">
        {t('plus.version.saved', words)}
      </span>
    );
  }
  if (outcome && outcome.reason !== 'cancelled') {
    return (
      <span className="gallery-versions__failed" role="alert">
        {t(FAILURES[outcome.reason], words)}
      </span>
    );
  }
  if (!kept && !available && listed) {
    return (
      <span className="gallery-versions__quiet">{t('plus.version.gone')}</span>
    );
  }
  return null;
}
