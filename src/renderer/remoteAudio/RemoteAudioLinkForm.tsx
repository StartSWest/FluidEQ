/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { ILanPairingOption } from '../../common/remoteAudio';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import TextInput from '../widgets/TextInput';
import RemoteAudioCodeList from './RemoteAudioCodeList';

interface IRemoteAudioLinkFormProps {
  deviceName?: string;
  lanOptions: ILanPairingOption[];
  status: string;
  onLink(code: string): void;
}

/**
 * Linking two computers, from either one: this computer's code to copy, and
 * room to paste the other's. Whichever side pastes, the link that comes of it
 * runs both ways.
 */
const RemoteAudioLinkForm = ({
  deviceName,
  lanOptions,
  status,
  onLink,
}: IRemoteAudioLinkFormProps) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const submit = () => {
    if (code.trim()) {
      onLink(code.trim());
    }
  };
  return (
    <div className="remote-audio__link-form">
      <div className="remote-audio__link-form-grid">
        <div className="remote-audio__link-half">
          <span className="remote-audio__lane-kicker">
            {t('remoteAudio.link.thisComputer')}
          </span>
          <strong className="remote-audio__link-form-name">
            <MenuIcon name="monitor" />
            {deviceName ?? '—'}
          </strong>
          <RemoteAudioCodeList lanOptions={lanOptions} status={status} />
          <p className="remote-audio__link-hint">
            {t('remoteAudio.link.thisHint')}
          </p>
        </div>
        <div className="remote-audio__link-or" aria-hidden="true">
          <span />
          {t('remoteAudio.link.or')}
          <span />
        </div>
        <div className="remote-audio__link-half">
          <span className="remote-audio__lane-kicker">
            {t('remoteAudio.link.otherComputer')}
          </span>
          <span className="remote-audio__link-label" aria-hidden="true">
            {t('remoteAudio.link.codeLabel')}
          </span>
          <div className="remote-audio__link-paste">
            <TextInput
              ariaLabel={t('remoteAudio.link.codeLabel')}
              value={code}
              isDisabled={false}
              errorMessage=""
              placeholder={t('remoteAudio.link.placeholder')}
              handleChange={setCode}
              handleSubmit={submit}
            />
            <button
              type="button"
              className="button small"
              disabled={!code.trim()}
              onClick={submit}
            >
              {t('remoteAudio.link.start')}
            </button>
          </div>
          <p className="remote-audio__link-hint">
            {t('remoteAudio.link.otherHint')}
          </p>
        </div>
      </div>
      <p className="remote-audio__link-once">
        <MenuIcon name="restart" />
        {t('remoteAudio.link.once')}
      </p>
    </div>
  );
};

export default RemoteAudioLinkForm;
