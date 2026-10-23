/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { useTranslation } from '../utils/I18nContext';

/**
 * This computer's one code, with its Copy. It used to be one code per
 * network address, and a machine running Docker or WSL showed a dozen; the
 * code now carries every address worth trying and the computer that pastes
 * it picks the one that answers first.
 */
const RemoteAudioCodeList = ({
  code,
  status,
}: {
  code?: string;
  /** Said while there is no code yet. */
  status: string;
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState('');
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setCopied('');
    }
  };
  if (!code) {
    return (
      <div className="remote-audio__code-placeholder">
        <span aria-hidden="true" />
        {status}
      </div>
    );
  }
  return (
    <div className="remote-audio__code-rows">
      <div className="remote-audio__code-row">
        <code
          className="remote-audio__code-value"
          title={code}
          aria-label={t('remoteAudio.code.label')}
        >
          {code}
        </code>
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            copy(code).catch(() => undefined);
          }}
        >
          {copied === code
            ? t('remoteAudio.code.copied')
            : t('remoteAudio.code.copy')}
        </button>
      </div>
    </div>
  );
};

export default RemoteAudioCodeList;
