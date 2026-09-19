import { useEffect, useId, useRef, useState } from 'react';
import type { IPlusTrialSettings, TPlusTrialFailure } from 'common/plusTrial';
import { useAccount } from '../account/accountStore';
import { useTranslation } from '../utils/I18nContext';
import TRIAL_ERRORS from './trialErrors';
import '../styles/PlusTrial.scss';

const bridge = () => window.electron?.ipcRenderer;

/** Controls future offers only; existing grants keep their original dates. */
export default function PlusTrialSettings() {
  const { t, locale } = useTranslation();
  const { identity } = useAccount();
  const id = useId();
  const [settings, setSettings] = useState<IPlusTrialSettings>();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<TPlusTrialFailure>();
  const [attempt, setAttempt] = useState(0);
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current += 1;
    let current = true;
    setLoading(true);
    setSaving(false);
    setSettings(undefined);
    setError(undefined);
    setSaved(false);
    const load = async () => {
      try {
        const result = await bridge()?.getPlusTrialSettings?.();
        if (!current) {
          return;
        }
        if (result?.ok) {
          setSettings(result.settings);
          setEnabled(result.settings.enabled);
        } else {
          setError(result?.reason ?? 'unavailable');
        }
      } catch {
        if (current) {
          setError('offline');
        }
      } finally {
        if (current) {
          setLoading(false);
        }
      }
    };
    load().catch(() => {
      if (current) {
        setError('offline');
      }
    });
    return () => {
      current = false;
      epoch.current += 1;
    };
  }, [identity?.id, attempt]);

  const save = async () => {
    const started = epoch.current;
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const result = await bridge()?.setPlusTrialOffer?.(enabled);
      if (started !== epoch.current) {
        return;
      }
      if (result?.ok) {
        setSettings(result.settings);
        setEnabled(result.settings.enabled);
        setSaved(true);
      } else {
        setError(result?.reason ?? 'unavailable');
      }
    } catch {
      if (started === epoch.current) {
        setError('offline');
      }
    } finally {
      if (started === epoch.current) {
        setSaving(false);
      }
    }
  };
  const date =
    settings?.eligibleSince === undefined
      ? undefined
      : new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(settings.eligibleSince);
  return (
    <section className="plus-trial-settings" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('trial.settings.title')}</h3>
      <p>{t('trial.settings.body')}</p>
      {loading ? (
        <p role="status">{t('account.checking')}</p>
      ) : (
        settings && (
          <>
            <p>
              {date
                ? t('trial.settings.since', { date })
                : t('trial.settings.off')}
            </p>
            <p>
              {t(
                settings.enabled
                  ? 'trial.settings.on'
                  : 'trial.settings.disabled',
              )}
            </p>
            <label htmlFor={id}>
              <input
                id={id}
                type="checkbox"
                checked={enabled}
                disabled={saving}
                onChange={(event) => {
                  setEnabled(event.target.checked);
                  setSaved(false);
                }}
              />
              {t('trial.settings.label')}
            </label>
            <button
              type="button"
              className="button small"
              disabled={saving || enabled === settings.enabled}
              onClick={save}
            >
              {t(saving ? 'trial.settings.saving' : 'trial.settings.save')}
            </button>
          </>
        )
      )}
      {error && (
        <p className="account__error" role="alert">
          {t(TRIAL_ERRORS[error])}
        </p>
      )}
      {error && !settings && (
        <button
          type="button"
          className="button small subtle"
          disabled={loading}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t('trial.retry')}
        </button>
      )}
      {saved && <p role="status">{t('trial.settings.saved')}</p>}
    </section>
  );
}
