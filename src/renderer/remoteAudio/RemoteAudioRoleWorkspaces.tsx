/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import TextInput from '../widgets/TextInput';
import type { IRemoteAudioValue } from './remoteAudioState';

interface IListenerWorkspaceProps {
  copiedCode: string;
  remote: IRemoteAudioValue;
  status: string;
  copyCode(code: string): Promise<void>;
  replaceConnectionCode(): Promise<void>;
  startListening(): Promise<void>;
  stopSession(): Promise<void>;
}

export const RemoteAudioListenerWorkspace = ({
  copiedCode,
  copyCode,
  remote,
  replaceConnectionCode,
  startListening,
  status,
  stopSession,
}: IListenerWorkspaceProps) => {
  const { t } = useTranslation();

  return (
    <div className="remote-audio__role-workspace is-listener">
      <div className="remote-audio__codes">
        <h4>{t('remoteAudio.code.title')}</h4>
        <p>{t('remoteAudio.code.hint')}</p>
        <div className="remote-audio__code-list">
          {remote.lanOptions.map((option) => (
            <div className="remote-audio__code" key={option.address}>
              <div className="remote-audio__code-heading">
                <div className="remote-audio__computer">
                  <strong>{option.deviceName}</strong>
                  <span>{option.address}</span>
                </div>
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
                  onClick={() => copyCode(option.code)}
                >
                  {copiedCode === option.code
                    ? t('remoteAudio.code.copied')
                    : t('remoteAudio.code.copy')}
                </button>
              </div>
            </div>
          ))}
          {remote.lanOptions.length === 0 && (
            <div className="remote-audio__code-placeholder">
              <span aria-hidden="true" />
              {status || t('remoteAudio.status.preparing')}
            </div>
          )}
        </div>
      </div>

      <div className="remote-audio__session-actions">
        {!remote.role && (
          <button
            type="button"
            className="button small"
            onClick={() => startListening().catch(() => undefined)}
          >
            {t('remoteAudio.listen.start')}
          </button>
        )}
        {remote.phase === 'playback-blocked' && (
          <button
            type="button"
            className="button small"
            onClick={() => remote.resumePlayback()}
          >
            {t('remoteAudio.resume')}
          </button>
        )}
        {remote.role === 'listener' && (
          <>
            <button
              type="button"
              className="button small subtle"
              onClick={() => replaceConnectionCode().catch(() => undefined)}
            >
              {t('remoteAudio.listen.newCode')}
            </button>
            <button
              type="button"
              className="button small subtle"
              onClick={() => stopSession().catch(() => undefined)}
            >
              {t('remoteAudio.listen.stop')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

interface ISenderWorkspaceProps {
  pairingCode: string;
  remote: IRemoteAudioValue;
  setPairingCode(code: string): void;
  stopSession(): Promise<void>;
}

const STREAM_MODES = ['video', 'music'] as const;

export const RemoteAudioSenderWorkspace = ({
  pairingCode,
  remote,
  setPairingCode,
  stopSession,
}: ISenderWorkspaceProps) => {
  const { t } = useTranslation();

  return (
    <div className="remote-audio__role-workspace is-sender">
      <div className="remote-audio__stream-mode">
        <div className="remote-audio__stream-mode-heading">
          <strong>{t('remoteAudio.stream.title')}</strong>
          <span>{t('remoteAudio.stream.lossless')}</span>
        </div>
        <div
          className="remote-audio__stream-options"
          role="radiogroup"
          aria-label={t('remoteAudio.stream.title')}
        >
          {STREAM_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={remote.streamMode === mode}
              className={`remote-audio__stream-option${
                remote.streamMode === mode ? ' is-selected' : ''
              }`}
              onClick={() => remote.setStreamMode(mode)}
            >
              <span className="remote-audio__stream-radio" aria-hidden="true" />
              <span>
                <span className="remote-audio__stream-title">
                  <MenuIcon name={mode === 'video' ? 'video' : 'song'} />
                  <strong>{t(`remoteAudio.stream.${mode}.title`)}</strong>
                </span>
                <small>{t(`remoteAudio.stream.${mode}.body`)}</small>
              </span>
              <em>{t(`remoteAudio.stream.${mode}.buffer`)}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="remote-audio__sender-connect">
        <div className="remote-audio__field">
          <span>{t('remoteAudio.send.codeLabel')}</span>
          <TextInput
            value={pairingCode}
            ariaLabel={t('remoteAudio.send.codeLabel')}
            isDisabled={remote.role === 'sender'}
            errorMessage=""
            placeholder={t('remoteAudio.send.codePlaceholder')}
            handleChange={setPairingCode}
            handleSubmit={(code) => {
              if (code.trim() && remote.role !== 'sender') {
                remote.startSending(code).catch(() => undefined);
              }
            }}
          />
        </div>
        <button
          type="button"
          className={`button small${remote.role === 'sender' ? ' subtle' : ''}`}
          disabled={remote.role !== 'sender' && !pairingCode.trim()}
          onClick={() =>
            remote.role === 'sender'
              ? stopSession().catch(() => undefined)
              : remote.startSending(pairingCode).catch(() => undefined)
          }
        >
          {t(
            remote.role === 'sender'
              ? 'remoteAudio.send.stop'
              : 'remoteAudio.send.start',
          )}
        </button>
      </div>
      <div className="remote-audio__sender-detail" aria-live="polite">
        {remote.role === 'sender' && remote.deviceName ? (
          <strong className="remote-audio__destination">
            {t('remoteAudio.send.destination', { name: remote.deviceName })}
          </strong>
        ) : (
          <span>{t('remoteAudio.send.readyHint')}</span>
        )}
      </div>
    </div>
  );
};
