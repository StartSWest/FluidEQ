/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect } from 'react';
import { usePlaybackOwner } from '../audio/playbackOwner';
import {
  useLastTransportOwner,
  useTransportSources,
} from '../audio/transportSource';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { useSinglePlayer } from '../utils/singlePlayer';
import '../styles/RemoteAudio.scss';
import RemoteAudioCodeList from './RemoteAudioCodeList';
import RemoteAudioLinkCard from './RemoteAudioLinkCard';
import RemoteAudioLinkForm from './RemoteAudioLinkForm';
import { useIncomingSound, useRemoteAudio } from './remoteAudioValueContext';
import {
  describeForRemote,
  pickSourceForRemote,
} from './useRemoteNowPlayingBroadcast';

const RULES = [
  {
    icon: 'bothWays',
    title: 'remoteAudio.rule.echoTitle',
    body: 'remoteAudio.rule.echo',
  },
  {
    icon: 'eqBars',
    title: 'remoteAudio.rule.eqTitle',
    body: 'remoteAudio.rule.eq',
  },
  {
    icon: 'steady',
    title: 'remoteAudio.rule.steadyTitle',
    body: 'remoteAudio.rule.steady',
  },
] as const;

/**
 * Share Audio: link this computer with another, and both play each other.
 *
 * Nothing linked, the page is the link itself — this computer's code to
 * copy and room to paste the other's, from whichever side. Linked, it is a
 * card per computer with its two directions, each on its own switch. There
 * is no role to choose any more: the listener/sender pair it replaced asked
 * people to decide which computer was "the one with the headset" before they
 * could share anything, and a link that runs both ways has no such side.
 */
const RemoteAudioPanel = () => {
  const { t } = useTranslation();
  const remote = useRemoteAudio();
  const incoming = useIncomingSound();
  const singlePlayer = useSinglePlayer();
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastOwner = useLastTransportOwner();
  const localNowPlaying = describeForRemote(
    pickSourceForRemote(sources, playingOwner, lastOwner),
  );
  const { links, phase, role, showCode } = remote;

  // The page opens on this computer's code. It is the same code every time —
  // the pairing secret is kept — so showing it is never a new pairing.
  useEffect(() => {
    if (role === undefined && phase === 'idle') {
      showCode().catch(() => undefined);
    }
  }, [phase, role, showCode]);

  const joining = role === 'sender' && links.length === 0;
  const linked = links.length > 0;
  const errorMessage = remote.error
    ? t(`remoteAudio.error.${remote.error}`)
    : '';
  const codeStatus =
    phase === 'error' && errorMessage
      ? errorMessage
      : t('remoteAudio.status.preparing');

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

      {!linked && !joining && (
        <>
          <h3 className="remote-audio__choice-title">
            {t('remoteAudio.link.section')}
          </h3>
          <RemoteAudioLinkForm
            deviceName={role === 'listener' ? remote.deviceName : undefined}
            lanOptions={remote.lanOptions}
            status={codeStatus}
            onLink={(code) => {
              remote.link(code).catch(() => undefined);
            }}
          />
          <ul className="remote-audio__rules">
            {RULES.map((rule) => (
              <li key={rule.title}>
                <span className="remote-audio__rule-icon" aria-hidden="true">
                  <MenuIcon name={rule.icon} />
                </span>
                <span>
                  <strong>{t(rule.title)}</strong>
                  <span>{t(rule.body)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(linked || joining) && (
        <>
          <h3 className="remote-audio__choice-title">
            {t('remoteAudio.linked.section')}
          </h3>
          {joining && (
            <article className="remote-audio__link is-looking">
              <header className="remote-audio__link-head">
                <span className="remote-audio__link-icon" aria-hidden="true">
                  <MenuIcon name="monitor" />
                </span>
                <span className="remote-audio__link-name">
                  <strong>{remote.deviceName ?? '—'}</strong>
                  <span role="status">
                    {phase === 'disconnected' && errorMessage
                      ? errorMessage
                      : t('remoteAudio.linked.looking', {
                          name: remote.deviceName ?? '',
                        })}
                  </span>
                </span>
                <span className="remote-audio__link-spacer" />
                <button
                  type="button"
                  className="button small subtle"
                  onClick={() => {
                    remote.unlink().catch(() => undefined);
                  }}
                >
                  {t('remoteAudio.linked.unlink')}
                </button>
              </header>
            </article>
          )}
          {links.map((link) => (
            <RemoteAudioLinkCard
              key={link.id}
              link={link}
              bothWays={remote.bothWays}
              sending={remote.sending}
              sendingFailed={remote.sendingFailed}
              localNowPlaying={localNowPlaying}
              delayMs={incoming.find((sound) => sound.id === link.id)?.delayMs}
              networkStats={remote.networkStats}
              subscribe={remote.subscribeMeter}
              onSwitches={(name, switches) => {
                remote.setSwitches(name, switches).catch(() => undefined);
              }}
              onUnlink={() => {
                remote.unlink().catch(() => undefined);
              }}
            />
          ))}
          {phase === 'playback-blocked' && (
            <div className="remote-audio__notice" role="alert">
              <span>{t('remoteAudio.status.playbackBlocked')}</span>
              <button
                type="button"
                className="button small"
                onClick={() => {
                  remote.resumePlayback().catch(() => undefined);
                }}
              >
                {t('remoteAudio.resume')}
              </button>
            </div>
          )}
          <h3 className="remote-audio__choice-title">
            {t('remoteAudio.another.section')}
          </h3>
          <div className="remote-audio__another">
            {role === 'listener' ? (
              <>
                <p>{t('remoteAudio.another.hub')}</p>
                <RemoteAudioCodeList
                  lanOptions={remote.lanOptions}
                  status={t('remoteAudio.status.preparing')}
                />
              </>
            ) : (
              <p>
                {t('remoteAudio.another.spoke', {
                  name: remote.deviceName ?? '',
                })}
              </p>
            )}
          </div>
          {singlePlayer && (
            <p className="remote-audio__note">
              <strong>{t('remoteAudio.singlePlayer.title')}</strong>
              <span>{t('remoteAudio.singlePlayer.body')}</span>
            </p>
          )}
        </>
      )}

      {errorMessage && phase === 'error' && (
        <div className="remote-audio__notice is-error" role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              showCode().catch(() => undefined);
            }}
          >
            {t('remoteAudio.retry')}
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
