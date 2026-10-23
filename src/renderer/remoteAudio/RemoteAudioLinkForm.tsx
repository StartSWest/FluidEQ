/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import TextInput from '../widgets/TextInput';
import RemoteAudioCodeList from './RemoteAudioCodeList';

interface IRemoteAudioLinkFormProps {
  deviceName?: string;
  /** This computer's one code. */
  code?: string;
  status: string;
  /** Why the last paste did not link, if it did not. */
  pasteError?: string;
  /** Resolves true once the code is saved and being linked. */
  onLink(code: string): Promise<boolean>;
}

/**
 * Linking computers, from any of them: this computer's code to copy, and
 * room to paste another's. Whichever side pastes, the link that comes of it
 * runs both ways, and the same code links any number of computers.
 */
const RemoteAudioLinkForm = ({
  deviceName,
  code,
  status,
  pasteError,
  onLink,
}: IRemoteAudioLinkFormProps) => {
  const { t } = useTranslation();
  const [pasted, setPasted] = useState('');
  const submit = () => {
    const value = pasted.trim();
    if (value) {
      onLink(value)
        .then((linked) => {
          if (linked) {
            setPasted('');
          }
          return undefined;
        })
        .catch(() => undefined);
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
          <RemoteAudioCodeList code={code} status={status} />
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
              value={pasted}
              isDisabled={false}
              errorMessage={pasteError ?? ''}
              placeholder={t('remoteAudio.link.placeholder')}
              handleChange={setPasted}
              handleSubmit={submit}
            />
            <button
              type="button"
              className="button small"
              disabled={!pasted.trim()}
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
        {t('remoteAudio.link.once')} {t('remoteAudio.link.many')}
      </p>
    </div>
  );
};

export default RemoteAudioLinkForm;
