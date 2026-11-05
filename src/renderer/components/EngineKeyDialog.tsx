/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  acceleratorOfKey,
  engineKeyNames,
  engineKeyProblem,
  TEngineKeyAnswer,
  TEngineKeyProblem,
} from '../../common/engineKey';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import runsOnMac from '../utils/platform';
import useModalKeys from '../utils/useModalKeys';
import CompactFrame from './CompactFrame';
import '../styles/Button.scss';
import '../styles/RestartAudioDialog.scss';
import '../styles/EngineKeyDialog.scss';

interface IEngineKeyBridge {
  readEngineKey?: () => Promise<unknown>;
  setEngineKey?: (accelerator: string) => Promise<unknown>;
}

const bridgeOf = () =>
  window.electron?.ipcRenderer as IEngineKeyBridge | undefined;

const isAnswer = (value: unknown): value is TEngineKeyAnswer =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as TEngineKeyAnswer).ok === 'boolean';

const PROBLEM_KEYS = {
  invalid: 'engineKey.problem.invalid',
  modifier: 'engineKey.problem.modifier',
  altgr: 'engineKey.problem.altgr',
  taken: 'engineKey.problem.taken',
} as const;

/**
 * Picking the on/off key (`common/engineKey.ts`), from the main menu: press
 * the keys, and Use holds them system-wide. A key that cannot be one, or that
 * another program holds already, says why where it was pressed. No key takes
 * it away again.
 */
const EngineKeyDialog = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const fieldId = useId();
  const surface = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState('');
  const [picked, setPicked] = useState('');
  const [problem, setProblem] = useState<TEngineKeyProblem>();
  const [busy, setBusy] = useState(false);
  useModalKeys(surface, field, { busy, onCancel: onClose });
  const isMac = runsOnMac();
  const named = (accelerator: string) =>
    engineKeyNames(accelerator, isMac).join(' + ');

  useEffect(() => {
    bridgeOf()
      ?.readEngineKey?.()
      .then((held) => {
        if (typeof held === 'string') {
          setCurrent(held);
          setPicked((now) => now || held);
        }
        return undefined;
      })
      .catch((error: unknown) =>
        reportError('Could not read the on/off key', error),
      );
  }, []);

  const capture = (event: KeyboardEvent<HTMLInputElement>) => {
    // Tab and Escape keep their meaning: the dialog's own.
    if (event.key === 'Tab' || event.key === 'Escape') {
      return;
    }
    event.preventDefault();
    const accelerator = acceleratorOfKey(event);
    if (accelerator === undefined) {
      return;
    }
    setPicked(accelerator);
    setProblem(engineKeyProblem(accelerator));
  };

  const apply = async (accelerator: string) => {
    const bridge = bridgeOf();
    if (busy || !bridge?.setEngineKey) {
      return;
    }
    setBusy(true);
    try {
      const answer = await bridge.setEngineKey(accelerator);
      if (!isAnswer(answer)) {
        setProblem('invalid');
        return;
      }
      if (answer.ok) {
        onClose();
        return;
      }
      setProblem(answer.problem);
    } catch (error) {
      reportError('Could not set the on/off key', error);
      setProblem('invalid');
    } finally {
      setBusy(false);
    }
  };

  const canUse =
    picked !== '' && picked !== current && problem === undefined && !busy;

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
        icon={<MenuIcon name="power" />}
        title={t('engineKey.title')}
        titleId="engine-key-title"
        aria-describedby="engine-key-body"
        aria-busy={busy}
        closeLabel={t('config.cancel')}
        onClose={() => {
          if (!busy) {
            onClose();
          }
        }}
        actions={
          <>
            {current !== '' && (
              <button
                type="button"
                className="button small subtle engine-key__none"
                disabled={busy}
                onClick={() => {
                  apply('').catch(() => undefined);
                }}
              >
                {t('engineKey.none')}
              </button>
            )}
            <button
              type="button"
              className="button small subtle"
              disabled={busy}
              onClick={onClose}
            >
              {t('config.cancel')}
            </button>
            <button
              type="button"
              className={`button small${busy ? ' is-running' : ''}`}
              disabled={!canUse}
              onClick={() => {
                apply(picked).catch(() => undefined);
              }}
            >
              {picked !== '' && picked !== current
                ? t('engineKey.use', { key: named(picked) })
                : t('engineKey.useKey')}
            </button>
          </>
        }
      >
        <p id="engine-key-body">{t('engineKey.body')}</p>
        <label className="engine-key__label" htmlFor={fieldId}>
          {t('engineKey.field')}
        </label>
        <input
          ref={field}
          id={fieldId}
          className={`engine-key__field${problem ? ' has-problem' : ''}`}
          readOnly
          value={picked === '' ? '' : named(picked)}
          placeholder={t('engineKey.waiting')}
          aria-invalid={problem !== undefined}
          aria-describedby={problem ? 'engine-key-problem' : undefined}
          onKeyDown={capture}
        />
        {problem && (
          <p
            id="engine-key-problem"
            className="engine-key__problem"
            role="alert"
          >
            {t(PROBLEM_KEYS[problem], { key: named(picked) })}
          </p>
        )}
      </CompactFrame>
    </div>,
    document.body,
  );
};

export default EngineKeyDialog;
