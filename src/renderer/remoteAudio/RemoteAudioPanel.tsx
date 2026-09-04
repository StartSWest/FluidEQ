/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import TextInput from '../widgets/TextInput';
import '../styles/RemoteAudio.scss';
import { useRemoteAudio } from './remoteAudioValueContext';
import RemoteAudioMonitor from './RemoteAudioMonitor';

const RemoteAudioPanel = () => {
  const { t } = useTranslation();
  const remote = useRemoteAudio();
  const [selectedRole, setSelectedRole] = useState<
    'listener' | 'sender' | undefined
  >(undefined);
  const [pairingCode, setPairingCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const displayedRole = remote.role ?? selectedRole;
  const errorBanner = remote.error ? (
    <div className="remote-audio__error" role="alert">
      {t(`remoteAudio.error.${remote.error}`)}
    </div>
  ) : null;
  const status = useMemo(() => {
    if (remote.phase === 'preparing') {
      return t('remoteAudio.status.preparing');
    }
    if (remote.phase === 'waiting') {
      return t('remoteAudio.status.waiting');
    }
    if (remote.phase === 'connecting') {
      return t('remoteAudio.status.connecting');
    }
    if (remote.phase === 'connected') {
      return remote.role === 'listener'
        ? t(
            remote.connectedCount === 1
              ? 'remoteAudio.status.connectedOne'
              : 'remoteAudio.status.connectedMany',
            { count: remote.connectedCount },
          )
        : t('remoteAudio.status.sending');
    }
    if (remote.phase === 'playback-blocked') {
      return t('remoteAudio.status.playbackBlocked');
    }
    if (remote.phase === 'disconnected') {
      return t('remoteAudio.status.disconnected');
    }
    return '';
  }, [remote.connectedCount, remote.phase, remote.role, t]);
  const monitorStatus =
    status ||
    (displayedRole === 'sender'
      ? t('remoteAudio.monitor.ready')
      : t('remoteAudio.monitor.inactive'));
  const monitorDetail =
    remote.role === 'sender' && remote.deviceName
      ? t('remoteAudio.send.destination', { name: remote.deviceName })
      : undefined;
  const monitorActive =
    remote.role !== undefined &&
    remote.phase !== 'disconnected' &&
    remote.phase !== 'error';

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
    } catch {
      setCopiedCode('');
    }
  };

  const chooseListener = async () => {
    if (remote.role === 'listener') {
      return;
    }
    if (remote.role) {
      await remote.stop();
    }
    setSelectedRole('listener');
    await remote.startListening();
  };

  const chooseSender = async () => {
    if (remote.role === 'sender') {
      return;
    }
    if (remote.role) {
      await remote.stop();
    }
    setSelectedRole('sender');
  };

  const resetRoleChoice = () => {
    setSelectedRole(undefined);
    setPairingCode('');
  };

  const stopSession = async () => {
    await remote.stop();
    resetRoleChoice();
  };

  return (
    <section className="remote-audio" aria-labelledby="remote-audio-title">
      <header className="remote-audio__header">
        <div>
          <p className="eyebrow">{t('remoteAudio.eyebrow')}</p>
          <h2 id="remote-audio-title">{t('remoteAudio.title')}</h2>
          <p>{t('remoteAudio.subtitle')}</p>
          <ul
            className="remote-audio__facts"
            aria-label={t('remoteAudio.security')}
          >
            <li>{t('remoteAudio.badge.local')}</li>
            <li>{t('remoteAudio.badge.lossless')}</li>
            <li>{t('remoteAudio.badge.encrypted')}</li>
          </ul>
        </div>
      </header>

      {errorBanner}
      <RemoteAudioMonitor
        active={monitorActive}
        connectedComputers={remote.connectedComputers}
        detail={monitorDetail}
        mode={displayedRole}
        status={monitorStatus}
        subscribe={remote.subscribeMeter}
      />

      <h3 className="remote-audio__choice-title">{t('remoteAudio.choose')}</h3>
      <div
        className="remote-audio__role-cards"
        role="radiogroup"
        aria-label={t('remoteAudio.choose')}
      >
        <article
          className={`remote-audio__role-card${
            displayedRole === 'listener' ? ' is-selected' : ''
          }`}
        >
          <button
            type="button"
            role="radio"
            aria-checked={displayedRole === 'listener'}
            className="remote-audio__role-choice"
            onClick={() => chooseListener().catch(() => undefined)}
          >
            <span className="remote-audio__role-radio" aria-hidden="true" />
            <span className="control-kicker">
              {t('remoteAudio.listen.kicker')}
            </span>
            <strong>{t('remoteAudio.listen.title')}</strong>
            <span>{t('remoteAudio.listen.body')}</span>
          </button>

          {displayedRole === 'listener' && (
            <div className="remote-audio__role-content">
              <div className="remote-audio__role-status-row">
                <strong>{t('remoteAudio.listen.activeTitle')}</strong>
                <span
                  className={`remote-audio__status remote-audio__status--${remote.phase}`}
                  role="status"
                >
                  {status || t('remoteAudio.status.preparing')}
                </span>
              </div>

              {remote.lanOptions.length > 0 && (
                <div className="remote-audio__codes">
                  <h4>{t('remoteAudio.code.title')}</h4>
                  <p>{t('remoteAudio.code.hint')}</p>
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
                </div>
              )}

              <div className="remote-audio__session-actions">
                {!remote.role && (
                  <button
                    type="button"
                    className="button small"
                    onClick={() => chooseListener().catch(() => undefined)}
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
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={stopSession}
                  >
                    {t('remoteAudio.listen.stop')}
                  </button>
                )}
              </div>
            </div>
          )}
        </article>

        <article
          className={`remote-audio__role-card${
            displayedRole === 'sender' ? ' is-selected' : ''
          }`}
        >
          <button
            type="button"
            role="radio"
            aria-checked={displayedRole === 'sender'}
            className="remote-audio__role-choice"
            onClick={() => chooseSender().catch(() => undefined)}
          >
            <span className="remote-audio__role-radio" aria-hidden="true" />
            <span className="control-kicker">
              {t('remoteAudio.send.kicker')}
            </span>
            <strong>{t('remoteAudio.send.title')}</strong>
            <span>{t('remoteAudio.send.body')}</span>
          </button>

          {displayedRole === 'sender' && (
            <div className="remote-audio__role-content">
              {remote.role !== 'sender' ? (
                <div className="remote-audio__sender-connect">
                  <div className="remote-audio__field">
                    <span>{t('remoteAudio.send.codeLabel')}</span>
                    <TextInput
                      value={pairingCode}
                      ariaLabel={t('remoteAudio.send.codeLabel')}
                      isDisabled={false}
                      errorMessage=""
                      placeholder={t('remoteAudio.send.codePlaceholder')}
                      handleChange={setPairingCode}
                      handleSubmit={(code) => {
                        if (code.trim()) {
                          remote.startSending(code).catch(() => undefined);
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="button small"
                    disabled={!pairingCode.trim()}
                    onClick={() => remote.startSending(pairingCode)}
                  >
                    {t('remoteAudio.send.start')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="remote-audio__role-status-row">
                    <strong>{t('remoteAudio.send.activeTitle')}</strong>
                    <span
                      className={`remote-audio__status remote-audio__status--${remote.phase}`}
                      role="status"
                    >
                      {status}
                    </span>
                  </div>
                  <p className="remote-audio__sender-copy">
                    {remote.deviceName && (
                      <strong className="remote-audio__destination">
                        {t('remoteAudio.send.destination', {
                          name: remote.deviceName,
                        })}
                      </strong>
                    )}
                    {t('remoteAudio.send.activeBody')}
                  </p>
                  <div className="remote-audio__session-actions">
                    <button
                      type="button"
                      className="button small subtle"
                      onClick={stopSession}
                    >
                      {t('remoteAudio.send.stop')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </article>
      </div>

      <footer className="remote-audio__note">
        <strong>{t('remoteAudio.note.title')}</strong>
        <span>{t('remoteAudio.note.body')}</span>
      </footer>
    </section>
  );
};

export default RemoteAudioPanel;
