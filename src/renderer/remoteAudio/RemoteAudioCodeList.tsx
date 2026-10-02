/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { ILanPairingOption } from '../../common/remoteAudio';
import { useTranslation } from '../utils/I18nContext';

/**
 * This computer's code, one per network it is on, each with its own Copy:
 * a computer on Wi-Fi and Ethernet at once is reached at either address, and
 * the code names the address it was made for.
 */
const RemoteAudioCodeList = ({
  lanOptions,
  status,
}: {
  lanOptions: ILanPairingOption[];
  /** Said while there is no code yet. */
  status: string;
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState('');
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
    } catch {
      setCopied('');
    }
  };
  if (lanOptions.length === 0) {
    return (
      <div className="remote-audio__code-placeholder">
        <span aria-hidden="true" />
        {status}
      </div>
    );
  }
  return (
    <div className="remote-audio__code-rows">
      {lanOptions.map((option) => (
        <div className="remote-audio__code-row" key={option.address}>
          <code
            className="remote-audio__code-value"
            title={option.code}
            aria-label={t('remoteAudio.code.forAddress', {
              address: option.address,
            })}
          >
            {option.code}
          </code>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              copy(option.code).catch(() => undefined);
            }}
          >
            {copied === option.code
              ? t('remoteAudio.code.copied')
              : t('remoteAudio.code.copy')}
          </button>
        </div>
      ))}
    </div>
  );
};

export default RemoteAudioCodeList;
