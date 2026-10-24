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
import RemoteAudioGroup from './RemoteAudioGroup';
import RemoteAudioMix from './RemoteAudioMix';
import RemoteAudioOutput from './RemoteAudioOutput';
import { useSystemFader } from '../audio/systemVolume';
import '../styles/RemoteAudioGroup.scss';
import RemoteAudioLinkForm from './RemoteAudioLinkForm';
import { useRemoteAudio } from './remoteAudioValueContext';
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
 * Share Audio: link this computer with any number of others, all to all.
 *
 * One group, with the local source first and a stable order for the rest,
 * including offline computers. Your mix holds the OS volume and independent
 * receive gains. Pairing stays beneath it, inside the existing app page.
 */
const RemoteAudioPanel = () => {
  const { t } = useTranslation();
  const remote = useRemoteAudio();
  const system = useSystemFader();
  const singlePlayer = useSinglePlayer();
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastOwner = useLastTransportOwner();
  const localNowPlaying = describeForRemote(
    pickSourceForRemote(sources, playingOwner, lastOwner),
  );
  const { links, looking, phase, start } = remote;

  // The page opens on this computer's code. It is the same code every time —
  // the pairing secret is kept — so showing it is never a new pairing, and
  // asking while it runs drops no link.
  useEffect(() => {
    if (phase === 'idle') {
      start().catch(() => undefined);
    }
  }, [phase, start]);

  const linked = links.length > 0 || looking.length > 0;
  const errorMessage =
    remote.error && remote.error !== 'code'
      ? t(`remoteAudio.error.${remote.error}`)
      : '';
  let codeStatus = t('remoteAudio.status.preparing');
  if (phase === 'error' && errorMessage) {
    codeStatus = errorMessage;
  } else if (phase === 'ready' || phase === 'playback-blocked') {
    codeStatus = t('remoteAudio.status.noNetwork');
  }
  const form = (
    <RemoteAudioLinkForm
      deviceName={remote.deviceName}
      code={remote.code}
      status={codeStatus}
      pasteError={
        remote.error === 'code' ? t('remoteAudio.error.code') : undefined
      }
      onLink={remote.link}
    />
  );

  return (
    <section className="remote-audio" aria-labelledby="remote-audio-title">
      <header className="remote-audio__header">
        <div>
          <p className="eyebrow">{t('remoteAudio.eyebrow')}</p>
          <h2 id="remote-audio-title">{t('remoteAudio.title')}</h2>
          <p>{t('remoteAudio.group.hint')}</p>
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

      <div className="remote-audio__columns">
        <RemoteAudioGroup remote={remote} localNowPlaying={localNowPlaying} />
        <RemoteAudioMix
          remote={remote}
          system={system}
          output={<RemoteAudioOutput />}
        />
      </div>

      {linked && (
        <>
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
          {singlePlayer && (
            <p className="remote-audio__note">
              <strong>{t('remoteAudio.singlePlayer.title')}</strong>
              <span>{t('remoteAudio.singlePlayer.body')}</span>
            </p>
          )}
        </>
      )}

      <h3 className="remote-audio__choice-title">
        {linked
          ? t('remoteAudio.another.section')
          : t('remoteAudio.link.section')}
      </h3>
      {form}
      {!linked && (
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
      )}

      {errorMessage && phase === 'error' && (
        <div className="remote-audio__notice is-error" role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              start().catch(() => undefined);
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
