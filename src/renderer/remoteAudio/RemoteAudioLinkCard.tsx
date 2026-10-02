/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  ILanRemoteAudioNetworkStats,
  IRemoteNowPlaying,
} from '../../common/remoteAudio';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { playsHere, sendsThere } from './linkRecords';
import type { TRemoteAudioMeterListener } from './meter';
import RemoteAudioLane from './RemoteAudioLane';
import type { ILinkSwitches, IRemoteAudioLink } from './remoteAudioState';

interface IRemoteAudioLinkCardProps {
  link: IRemoteAudioLink;
  bothWays: boolean;
  /** This computer's sound is being captured for the network now. */
  sending: boolean;
  sendingFailed: boolean;
  /** What this computer's bar shows, which is what goes out. */
  localNowPlaying?: IRemoteNowPlaying;
  /** How far behind its sound plays here, in milliseconds, while it
   * arrives (`useIncomingDelays.ts`). */
  delayMs?: number;
  networkStats: ILanRemoteAudioNetworkStats[];
  subscribe(listener: TRemoteAudioMeterListener): () => void;
  onSwitches(name: string, switches: ILinkSwitches): void;
  onUnlink(): void;
}

const megabits = (stats?: ILanRemoteAudioNetworkStats) =>
  stats ? ((stats.bytesPerSecond * 8) / 1_000_000).toFixed(1) : undefined;

/**
 * One linked computer: its sound coming in, this computer's going out, each
 * on its own switch, and the link itself — how it travels and how to end it.
 */
const RemoteAudioLinkCard = ({
  link,
  bothWays,
  sending,
  sendingFailed,
  localNowPlaying,
  delayMs,
  networkStats,
  subscribe,
  onSwitches,
  onUnlink,
}: IRemoteAudioLinkCardProps) => {
  const { t } = useTranslation();
  const { name } = link;
  const canPlay = bothWays || !link.joined;
  const canSend = bothWays || link.joined;
  // What can actually arrive: an older FluidEQ whose code this computer
  // used never sends back, and one that says it is not sending is not.
  const plays =
    playsHere(link, bothWays) &&
    !(link.joined && link.theirs === undefined) &&
    link.theirs?.sends !== false;
  const sends = sendsThere(link, bothWays);
  const incomingLive = plays && link.receiving;
  const playSwitchOn = link.switches.play && canPlay;
  // Off Windows the window itself sends, so main never says it is capturing.
  const outgoingLive = sends && (sending || !bothWays) && !sendingFailed;
  const received = networkStats.find(
    (entry) => entry.peerId === link.id && entry.direction === 'receive',
  );
  const sent = networkStats.find(
    (entry) => entry.peerId === link.id && entry.direction === 'send',
  );
  const queued = Math.max(
    received?.queuedMilliseconds ?? 0,
    sent?.queuedMilliseconds ?? 0,
  );
  const totalMegabits =
    received || sent
      ? (
          (((received?.bytesPerSecond ?? 0) + (sent?.bytesPerSecond ?? 0)) *
            8) /
          1_000_000
        ).toFixed(1)
      : undefined;

  let pill = t('remoteAudio.linked.paused');
  if (plays && sends) {
    pill = t('remoteAudio.linked.bothWays');
  } else if (plays) {
    pill = t('remoteAudio.linked.incomingOnly');
  } else if (sends) {
    pill = t('remoteAudio.linked.outgoingOnly');
  }

  let inLine: string;
  let inDetail: string | undefined;
  if (!canPlay) {
    inLine = t('remoteAudio.lane.inOneWay');
  } else if (!link.switches.play) {
    inLine = t('remoteAudio.lane.inOff', { name });
  } else if (link.joined && link.theirs === undefined) {
    inLine = t('remoteAudio.lane.inOld', { name });
  } else if (link.theirs?.sends === false) {
    inLine = t('remoteAudio.lane.inNotSent', { name });
  } else if (link.receiving && link.nowPlaying) {
    inLine = link.nowPlaying.title;
    inDetail = [
      link.nowPlaying.isPlaying ? undefined : t('remoteAudio.lane.paused'),
      link.nowPlaying.subtitle,
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (link.receiving) {
    inLine = t('remoteAudio.lane.receiving');
  } else {
    inLine = t('remoteAudio.lane.inQuiet', { name });
  }

  let outLine: string;
  let outDetail: string | undefined;
  if (!canSend) {
    outLine = t('remoteAudio.lane.outOneWay');
  } else if (!link.switches.send) {
    outLine = t('remoteAudio.lane.outOff', { name });
  } else if (sendingFailed) {
    outLine = t('remoteAudio.lane.outFailed');
  } else if (!link.joined && link.theirs === undefined) {
    outLine = t('remoteAudio.lane.outOld', { name });
  } else if (link.theirs?.plays === false) {
    outLine = t('remoteAudio.lane.outNotPlayed', { name });
  } else if (localNowPlaying) {
    outLine = localNowPlaying.title;
    outDetail = [
      localNowPlaying.isPlaying ? undefined : t('remoteAudio.lane.paused'),
      localNowPlaying.subtitle,
    ]
      .filter(Boolean)
      .join(' · ');
  } else {
    outLine = t('remoteAudio.lane.outQuiet');
  }

  const delayWidest = [
    '—',
    t('remoteAudio.lane.milliseconds', { milliseconds: 888 }),
  ];
  const rateWidest = [
    '—',
    t('remoteAudio.lane.megabits', { megabits: '88.8' }),
  ];
  const sentRate = megabits(sent);

  return (
    <article
      className="remote-audio__link"
      aria-label={t('remoteAudio.linked.cardLabel', { name })}
    >
      <header className="remote-audio__link-head">
        <span className="remote-audio__link-icon" aria-hidden="true">
          <MenuIcon name="monitor" />
        </span>
        <span className="remote-audio__link-name">
          <strong>{name}</strong>
          {link.address && <span>{link.address}</span>}
        </span>
        <span
          className={`remote-audio__link-pill${
            plays || sends ? '' : ' is-paused'
          }`}
        >
          <span aria-hidden="true" />
          {pill}
        </span>
        <span className="remote-audio__link-spacer" />
        <span className="remote-audio__link-stats">
          {t('remoteAudio.linked.lossless')}
          {totalMegabits !== undefined && (
            <>
              {' '}
              · {t('remoteAudio.lane.megabits', { megabits: totalMegabits })}
            </>
          )}
          {' · '}
          <span
            className={`remote-audio__link-health${
              queued > 100 ? ' is-congested' : ''
            }`}
          >
            {queued > 100
              ? t('remoteAudio.monitor.networkQueued', {
                  milliseconds: Math.round(queued),
                })
              : t('remoteAudio.monitor.networkHealthy')}
          </span>
        </span>
        <button
          type="button"
          className="button small subtle"
          onClick={onUnlink}
        >
          {t('remoteAudio.linked.unlink')}
        </button>
      </header>
      <RemoteAudioLane
        direction="in"
        kicker={t('remoteAudio.lane.from', { name })}
        title={t('remoteAudio.lane.playsHere')}
        line={inLine}
        lineDetail={inDetail || undefined}
        live={incomingLive}
        meterKey={link.id}
        subscribe={subscribe}
        figure={
          incomingLive && delayMs !== undefined
            ? t('remoteAudio.lane.milliseconds', { milliseconds: delayMs })
            : '—'
        }
        figureCaption={t('remoteAudio.lane.delay')}
        figureWidest={delayWidest}
        switchId={`remote-audio-play-${link.id}`}
        switchLabel={t('remoteAudio.lane.playItHere')}
        isOn={playSwitchOn}
        isSwitchDisabled={!canPlay}
        onToggle={() =>
          onSwitches(name, { ...link.switches, play: !link.switches.play })
        }
      />
      <RemoteAudioLane
        direction="out"
        kicker={t('remoteAudio.lane.to', { name })}
        title={t('remoteAudio.lane.yourSound')}
        line={outLine}
        lineDetail={outDetail || undefined}
        live={outgoingLive}
        meterKey={null}
        subscribe={subscribe}
        figure={
          outgoingLive && sentRate !== undefined
            ? t('remoteAudio.lane.megabits', { megabits: sentRate })
            : '—'
        }
        figureCaption={t('remoteAudio.lane.sent')}
        figureWidest={rateWidest}
        switchId={`remote-audio-send-${link.id}`}
        switchLabel={t('remoteAudio.lane.sendMySound')}
        isOn={link.switches.send && canSend}
        isSwitchDisabled={!canSend}
        onToggle={() =>
          onSwitches(name, { ...link.switches, send: !link.switches.send })
        }
      />
      <footer className="remote-audio__link-foot">
        <span>
          <MenuIcon name="bothWays" />
          {t('remoteAudio.linked.noEcho', { name })}
        </span>
        <span>
          <MenuIcon name="eqBars" />
          {t('remoteAudio.linked.untouched')}
        </span>
      </footer>
    </article>
  );
};

export default RemoteAudioLinkCard;
