/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import '../styles/RemoteAudio.scss';
import { useRemoteAudio } from './remoteAudioValueContext';
import RemoteAudioMonitor from './RemoteAudioMonitor';
import {
  RemoteAudioListenerWorkspace,
  RemoteAudioSenderWorkspace,
} from './RemoteAudioRoleWorkspaces';

const RemoteAudioPanel = () => {
  const { t } = useTranslation();
  const remote = useRemoteAudio();
  const [selectedRole, setSelectedRole] = useState<'listener' | 'sender'>(
    'listener',
  );
  const [pairingCode, setPairingCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const displayedRole = remote.role ?? selectedRole;
  useEffect(() => {
    if (displayedRole !== 'sender' || pairingCode) {
      return undefined;
    }
    let cancelled = false;
    window.electron.ipcRenderer
      .getSavedRemoteAudioLanSenderCode()
      .then((savedCode) => {
        if (!cancelled && savedCode) {
          setPairingCode((current) => current || savedCode);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [displayedRole, pairingCode]);
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
  const errorMessage = remote.error
    ? t(`remoteAudio.error.${remote.error}`)
    : '';
  const monitorStatus =
    errorMessage ||
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
  const connectionNotice = errorMessage || status || monitorStatus;
  let connectionStateClass = '';
  if (remote.error) {
    connectionStateClass = ' is-error';
  } else if (monitorActive) {
    connectionStateClass = ' is-active';
  }

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

  const startListenerSession = async () => {
    setSelectedRole('listener');
    await remote.startListening();
  };

  const stopSession = async () => {
    await remote.stop();
    // Stopping is not forgetting. Keep the chosen card open and retain the
    // entered code so the user can reconnect it or replace it with another.
    if (displayedRole === 'sender') {
      const savedCode = await window.electron.ipcRenderer
        .getSavedRemoteAudioLanSenderCode()
        .catch(() => undefined);
      if (savedCode) {
        setPairingCode(savedCode);
      }
    }
    setSelectedRole(displayedRole);
  };

  const replaceConnectionCode = async () => {
    setCopiedCode('');
    await remote.startListening(true);
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

      <RemoteAudioMonitor
        active={monitorActive}
        connectedComputers={remote.connectedComputers}
        detail={monitorDetail}
        mode={displayedRole}
        networkStats={remote.networkStats}
        status={monitorStatus}
        subscribe={remote.subscribeMeter}
      />

      <h3 className="remote-audio__choice-title">{t('remoteAudio.choose')}</h3>
      <div className="remote-audio__role-shell">
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
              <span className="remote-audio__role-icon" aria-hidden="true">
                <MenuIcon name="model" />
              </span>
              <span className="control-kicker">
                {t('remoteAudio.listen.kicker')}
              </span>
              <strong>{t('remoteAudio.listen.title')}</strong>
              <span>{t('remoteAudio.listen.body')}</span>
            </button>
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
              <span className="remote-audio__role-icon" aria-hidden="true">
                <MenuIcon name="waveform" />
              </span>
              <span className="control-kicker">
                {t('remoteAudio.send.kicker')}
              </span>
              <strong>{t('remoteAudio.send.title')}</strong>
              <span>{t('remoteAudio.send.body')}</span>
            </button>
          </article>
        </div>

        {displayedRole === 'listener' && (
          <RemoteAudioListenerWorkspace
            copiedCode={copiedCode}
            copyCode={copyCode}
            remote={remote}
            replaceConnectionCode={replaceConnectionCode}
            startListening={startListenerSession}
            status={status}
            stopSession={stopSession}
          />
        )}
        {displayedRole === 'sender' && (
          <RemoteAudioSenderWorkspace
            pairingCode={pairingCode}
            remote={remote}
            setPairingCode={setPairingCode}
            stopSession={stopSession}
          />
        )}
      </div>

      <footer className="remote-audio__note">
        <strong>{t('remoteAudio.note.title')}</strong>
        <span>{t('remoteAudio.note.body')}</span>
      </footer>

      <div
        className={`remote-audio__connection-state${connectionStateClass}`}
        role={remote.error ? 'alert' : 'status'}
      >
        <span aria-hidden="true" />
        <p>{connectionNotice}</p>
      </div>
    </section>
  );
};

export default RemoteAudioPanel;
