/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import '../styles/RemoteAudio.scss';
import { useRemoteAudio } from './RemoteAudioContext';

const RemoteAudioPanel = () => {
  const { t } = useTranslation();
  const remote = useRemoteAudio();
  const [pairingCode, setPairingCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
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

  const outputPicker = (
    <label className="remote-audio__field" htmlFor="remote-audio-output">
      <span>{t('remoteAudio.output.label')}</span>
      <select
        id="remote-audio-output"
        value={remote.outputId}
        onChange={(event) => {
          remote.setOutput(event.target.value).catch(() => undefined);
        }}
      >
        <option value="">{t('remoteAudio.output.default')}</option>
        {remote.outputs.map((output, index) => (
          <option key={output.id} value={output.id}>
            {output.label ||
              t('remoteAudio.output.unnamed', { number: index + 1 })}
          </option>
        ))}
      </select>
    </label>
  );

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
    } catch {
      setCopiedCode('');
    }
  };

  return (
    <section className="remote-audio">
      <header className="remote-audio__header">
        <div>
          <p className="remote-audio__eyebrow">{t('remoteAudio.eyebrow')}</p>
          <h1>{t('remoteAudio.title')}</h1>
          <p>{t('remoteAudio.subtitle')}</p>
        </div>
        <div
          className="remote-audio__badges"
          aria-label={t('remoteAudio.security')}
        >
          <span>{t('remoteAudio.badge.local')}</span>
          <span>{t('remoteAudio.badge.lossless')}</span>
          <span>{t('remoteAudio.badge.encrypted')}</span>
        </div>
      </header>

      {remote.error && (
        <div className="remote-audio__error" role="alert">
          {t(`remoteAudio.error.${remote.error}`)}
        </div>
      )}

      {!remote.role && (
        <div className="remote-audio__choices">
          <article className="remote-audio__card remote-audio__card--listen">
            <div className="remote-audio__role-mark" aria-hidden="true">
              B
            </div>
            <div className="remote-audio__card-copy">
              <p className="remote-audio__card-kicker">
                {t('remoteAudio.listen.kicker')}
              </p>
              <h2>{t('remoteAudio.listen.title')}</h2>
              <p>{t('remoteAudio.listen.body')}</p>
            </div>
            {outputPicker}
            <button
              type="button"
              className="button small"
              onClick={() => remote.startListening()}
            >
              {t('remoteAudio.listen.start')}
            </button>
          </article>

          <article className="remote-audio__card">
            <div className="remote-audio__role-mark" aria-hidden="true">
              A
            </div>
            <div className="remote-audio__card-copy">
              <p className="remote-audio__card-kicker">
                {t('remoteAudio.send.kicker')}
              </p>
              <h2>{t('remoteAudio.send.title')}</h2>
              <p>{t('remoteAudio.send.body')}</p>
            </div>
            <label
              className="remote-audio__field"
              htmlFor="remote-audio-pairing-code"
            >
              <span>{t('remoteAudio.send.codeLabel')}</span>
              <textarea
                id="remote-audio-pairing-code"
                rows={3}
                value={pairingCode}
                placeholder={t('remoteAudio.send.codePlaceholder')}
                spellCheck={false}
                onChange={(event) => setPairingCode(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="button small"
              disabled={!pairingCode.trim()}
              onClick={() => remote.startSending(pairingCode)}
            >
              {t('remoteAudio.send.start')}
            </button>
          </article>
        </div>
      )}

      {remote.role === 'listener' && (
        <div className="remote-audio__session">
          <div className="remote-audio__session-heading">
            <div>
              <p className="remote-audio__card-kicker">
                {t('remoteAudio.listen.kicker')}
              </p>
              <h2>{t('remoteAudio.listen.activeTitle')}</h2>
            </div>
            <span
              className={`remote-audio__status remote-audio__status--${remote.phase}`}
              role="status"
            >
              {status}
            </span>
          </div>

          {outputPicker}

          {remote.lanOptions.length > 0 && (
            <div className="remote-audio__codes">
              <h3>{t('remoteAudio.code.title')}</h3>
              <p>{t('remoteAudio.code.hint')}</p>
              {remote.lanOptions.map((option) => (
                <div className="remote-audio__code" key={option.address}>
                  <div className="remote-audio__code-heading">
                    <span>{option.address}</span>
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
                  <textarea
                    rows={3}
                    readOnly
                    spellCheck={false}
                    value={option.code}
                    aria-label={t('remoteAudio.code.forAddress', {
                      address: option.address,
                    })}
                  />
                </div>
              ))}
            </div>
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
          <button
            type="button"
            className="button small subtle remote-audio__stop"
            onClick={() => remote.stop()}
          >
            {t('remoteAudio.listen.stop')}
          </button>
        </div>
      )}

      {remote.role === 'sender' && (
        <div className="remote-audio__session remote-audio__session--sender">
          <div className="remote-audio__session-heading">
            <div>
              <p className="remote-audio__card-kicker">
                {t('remoteAudio.send.kicker')}
              </p>
              <h2>{t('remoteAudio.send.activeTitle')}</h2>
            </div>
            <span
              className={`remote-audio__status remote-audio__status--${remote.phase}`}
              role="status"
            >
              {status}
            </span>
          </div>
          <p>{t('remoteAudio.send.activeBody')}</p>
          <button
            type="button"
            className="button small subtle remote-audio__stop"
            onClick={() => remote.stop()}
          >
            {t('remoteAudio.send.stop')}
          </button>
        </div>
      )}

      <footer className="remote-audio__note">
        <strong>{t('remoteAudio.note.title')}</strong>
        <span>{t('remoteAudio.note.body')}</span>
      </footer>
    </section>
  );
};

export default RemoteAudioPanel;
