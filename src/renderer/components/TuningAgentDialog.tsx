/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TUNING_ASSISTANTS,
  shownTuningAgentSetup,
  tuningAgentSetup,
  type ITuningAgentDoor,
  type TTuningAssistant,
} from '../../common/tuningAgent';
import type { TranslationKey } from '../../common/i18n/en';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import useModalKeys from '../utils/useModalKeys';
import Switch from '../widgets/Switch';
import CompactFrame from './CompactFrame';
import '../styles/Button.scss';
import '../styles/RestartAudioDialog.scss';
import '../styles/TuningAgentDialog.scss';

const ASSISTANT_LABELS: Record<TTuningAssistant, TranslationKey> = {
  claude: 'tuningAgent.assistant.claude',
  codex: 'tuningAgent.assistant.codex',
  other: 'tuningAgent.assistant.other',
  cli: 'tuningAgent.assistant.cli',
};

const TuningAgentDialog = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const switchId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [door, setDoor] = useState<ITuningAgentDoor>();
  const [assistant, setAssistant] = useState<TTuningAssistant>('claude');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');

  useModalKeys(surface, closeButton, { busy, onCancel: onClose });

  useEffect(() => {
    const api = window.electron?.ipcRenderer;
    let alive = true;
    api
      ?.getTuningAgentDoor?.()
      .then((next) => {
        if (alive) {
          setDoor(next);
        }
        return undefined;
      })
      .catch((error: unknown) =>
        reportError('reading the AI tuning door', error),
      );
    const unsubscribe = api?.onTuningAgentChanged?.((next) => {
      if (alive) {
        setDoor(next);
      }
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const runAction = async (work: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try {
      await work();
    } catch (error) {
      reportError('updating the AI tuning door', error);
      setNotice(t('tuningAgent.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const url = door?.open ? door.url : undefined;
  const key = door?.open ? door.key : undefined;
  const fullSetup = url && key ? tuningAgentSetup(assistant, url, key) : '';
  const shownSetup =
    url && key ? shownTuningAgentSetup(assistant, url, key) : '';

  const handleCopy = async () => {
    if (!fullSetup) {
      return;
    }
    try {
      await navigator.clipboard.writeText(fullSetup);
      setCopied(true);
      setNotice('');
    } catch {
      setNotice(t('tuningAgent.copyFailed'));
    }
  };

  const session = door?.session;

  return createPortal(
    <div
      className="restart-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <CompactFrame
        ref={surface}
        icon={<MenuIcon name="configure" />}
        title={t('tuningAgent.title')}
        titleId="tuning-agent-title"
        aria-describedby="tuning-agent-body"
        aria-busy={busy}
        closeLabel={t('config.cancel')}
        onClose={() => {
          if (!busy) {
            onClose();
          }
        }}
        actions={
          <button
            ref={closeButton}
            type="button"
            className="button small"
            disabled={busy}
            onClick={onClose}
          >
            {t('tuningAgent.done')}
          </button>
        }
      >
        <div className="tuning-agent">
          <p id="tuning-agent-body" className="tuning-agent__text">
            {t('tuningAgent.body')}
          </p>

          <div className={`tuning-agent__card${url ? ' is-open' : ''}`}>
            <div className="tuning-agent__head">
              <div className="tuning-agent__words">
                <label className="tuning-agent__title" htmlFor={switchId}>
                  {t('tuningAgent.switchTitle')}
                </label>
                <span className="tuning-agent__text">
                  {t('tuningAgent.safetyHint')}
                </span>
              </div>
              <Switch
                id={switchId}
                ariaLabel={t('tuningAgent.switchTitle')}
                isOn={door?.open === true}
                isDisabled={!door || busy}
                handleToggle={() => {
                  setCopied(false);
                  runAction(async () => {
                    const next =
                      await window.electron?.ipcRenderer?.setTuningAgentDoor?.(
                        door?.open !== true,
                      );
                    if (next) {
                      setDoor(next);
                    }
                  }).catch(() => undefined);
                }}
              />
            </div>

            {door && !door.open && door.failed && (
              <p className="tuning-agent__error" role="alert">
                {t('tuningAgent.failed')}
              </p>
            )}

            {url && key && (
              <>
                <div
                  className="tuning-agent__assistants"
                  role="group"
                  aria-label={t('tuningAgent.assistantLabel')}
                >
                  {TUNING_ASSISTANTS.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      className="tuning-agent__tab"
                      aria-pressed={assistant === entry}
                      onClick={() => {
                        setAssistant(entry);
                        setCopied(false);
                      }}
                    >
                      {t(ASSISTANT_LABELS[entry])}
                    </button>
                  ))}
                </div>
                <pre
                  className="tuning-agent__code"
                  role="region"
                  aria-label={t('tuningAgent.setupLabel')}
                >
                  {shownSetup}
                </pre>
                <div className="tuning-agent__row">
                  <button
                    type="button"
                    className="button small"
                    disabled={busy}
                    onClick={() => {
                      handleCopy().catch(() => undefined);
                    }}
                  >
                    {t(copied ? 'tuningAgent.copied' : 'tuningAgent.copy')}
                  </button>
                  <button
                    type="button"
                    className="button small subtle"
                    disabled={busy}
                    onClick={() => {
                      setCopied(false);
                      runAction(async () => {
                        const next =
                          await window.electron?.ipcRenderer?.newTuningAgentKey?.();
                        if (next) {
                          setDoor(next);
                        }
                      }).catch(() => undefined);
                    }}
                  >
                    {t('tuningAgent.newKey')}
                  </button>
                </div>
                <span className="tuning-agent__hint">
                  {t('tuningAgent.keyHint')}
                </span>
              </>
            )}
          </div>

          {session?.hasSnapshot && (
            <div className="tuning-agent__session">
              <span className="tuning-agent__session-title">
                {t('tuningAgent.sessionSummary', {
                  count: String(session.changeCount),
                  mode: t(
                    session.mode === 'original'
                      ? 'tuningAgent.modeOriginal'
                      : 'tuningAgent.modeTuned',
                  ),
                })}
              </span>
              <div className="tuning-agent__row">
                <button
                  type="button"
                  className="button small subtle"
                  disabled={busy}
                  onClick={() => {
                    runAction(async () => {
                      const res =
                        await window.electron?.ipcRenderer?.abTuningAgent?.();
                      if (res && !res.ok && res.error) {
                        setNotice(res.error);
                      }
                    }).catch(() => undefined);
                  }}
                >
                  {t(
                    session.mode === 'original'
                      ? 'tuningAgent.listenTuned'
                      : 'tuningAgent.listenOriginal',
                  )}
                </button>
                <button
                  type="button"
                  className="button small subtle"
                  disabled={busy}
                  onClick={() => {
                    runAction(async () => {
                      const res =
                        await window.electron?.ipcRenderer?.revertTuningAgent?.();
                      if (res && !res.ok && res.error) {
                        setNotice(res.error);
                      }
                    }).catch(() => undefined);
                  }}
                >
                  {t('tuningAgent.revert')}
                </button>
              </div>
            </div>
          )}

          {notice && (
            <p className="tuning-agent__error" role="alert">
              {notice}
            </p>
          )}
        </div>
      </CompactFrame>
    </div>,
    document.body,
  );
};

export default TuningAgentDialog;
