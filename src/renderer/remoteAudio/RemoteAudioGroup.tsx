/* FluidEQ — GPL-3.0-or-later */
import type { IRemoteNowPlaying } from '../../common/remoteAudio';
import { compareAudioComputers } from '../../common/remoteAudioGroup';
import type { TranslationKey } from '../../common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { pluralCategory } from '../utils/pluralCategory';
import MenuIcon from '../icons/MenuIcon';
import Switch from '../widgets/Switch';
import RemoteAudioLane from './RemoteAudioLane';
import RemoteAudioPeerMenu from './RemoteAudioPeerMenu';
import type { IRemoteAudioLink, IRemoteAudioValue } from './remoteAudioState';
import { heardHere, linkControls } from './linkRecords';
import useIncomingSounding, { THIS_COMPUTER } from './useIncomingSounding';
import useRemoteAudioSmooth from './useRemoteAudioSmooth';

/** The one sound the This computer row listens for. */
const ONLY_THIS_COMPUTER: readonly string[] = [THIS_COMPUTER];

export const audioLinkKey = (link: IRemoteAudioLink) =>
  link.computerId ? `id:${link.computerId}` : link.name;

/** One shared order for connected and offline PCs; connectivity never moves
 * a row. The local row is rendered separately, always first. */
export const audioGroupRows = (
  remote: Pick<IRemoteAudioValue, 'links' | 'looking'>,
) => {
  const live = [
    ...new Map(
      remote.links.map((link) => [link.computerId ?? link.id, link]),
    ).values(),
  ];
  return [
    ...live.map((link) => ({
      name: link.name,
      computerId: link.computerId ?? link.id,
      link,
    })),
    ...remote.looking
      .filter(
        (away) =>
          !remote.links.some((link) => link.computerId === away.computerId),
      )
      .map((away) => ({
        name: away.deviceName,
        computerId: away.computerId,
        link: undefined,
      })),
  ].sort(compareAudioComputers);
};

const RemoteAudioGroup = ({
  remote,
  localNowPlaying,
}: {
  remote: IRemoteAudioValue;
  localNowPlaying?: IRemoteNowPlaying;
}) => {
  const { t, locale } = useTranslation();
  // This computer and every other one listed, counted in the language's own
  // plural: with nobody linked the header read "1 computers".
  const computers = 1 + audioGroupRows(remote).length;
  const { sharing } = remote;
  const [smooth, setSmooth] = useRemoteAudioSmooth();
  const thisComputerSounds =
    useIncomingSounding(remote.subscribeMeter, ONLY_THIS_COMPUTER)[
      THIS_COMPUTER
    ] === true;
  // A player that never describes itself is still sound going out: a game,
  // or a program the machine cannot read (every one on a Mac, 2026-10-26),
  // must not read as "Nothing playing" over a moving wave.
  let localLine =
    localNowPlaying?.title ??
    t(
      thisComputerSounds
        ? 'remoteAudio.lane.outSounding'
        : 'remoteAudio.lane.outQuiet',
    );
  if (remote.sendingFailed) {
    localLine = t('remoteAudio.lane.outFailed');
  }
  if (!sharing) {
    localLine = t('remoteAudio.group.sourceOff');
  }
  const choose = (
    link: IRemoteAudioLink,
    change: Partial<IRemoteAudioLink['switches']>,
  ) => {
    remote
      .setSwitches(audioLinkKey(link), { ...link.switches, ...change })
      .catch(() => undefined);
  };
  return (
    <section
      className="remote-audio__link remote-audio__group"
      aria-label={t('remoteAudio.group.title')}
    >
      <header className="remote-audio__link-head">
        <span className="remote-audio__link-name">
          <strong>{t('remoteAudio.group.title')}</strong>
        </span>
        <span className="remote-audio__link-spacer" />
        <span className="remote-audio__link-stats">
          {t(
            `remoteAudio.group.count.${pluralCategory(computers, locale)}` as TranslationKey,
            { count: new Intl.NumberFormat(locale).format(computers) },
          )}
        </span>
      </header>
      <article className="remote-audio__lane remote-audio__group-row">
        <div className="remote-audio__lanes remote-audio__group-lanes">
          <RemoteAudioLane
            direction="out"
            kicker={t('remoteAudio.link.thisComputer')}
            title={remote.deviceName ?? t('remoteAudio.link.thisComputer')}
            line={localLine}
            lineDetail={localNowPlaying?.subtitle}
            live={sharing && remote.sending}
            meterKey={null}
            subscribe={remote.subscribeMeter}
            figures={[]}
            switchId="remote-audio-share"
            switchLabel={t('remoteAudio.group.share')}
            isOn={sharing}
            isSwitchDisabled={false}
            onToggle={() => {
              remote.setSharing(!sharing).catch(() => undefined);
            }}
          />
        </div>
        {/* Smooth stands where every other row has Send, and its hint where
            they have their options button, so the switches and the buttons
            make straight columns. */}
        <div className="remote-audio__link-actions remote-audio__group-actions">
          <div className="remote-audio__lane-switch">
            <span>{t('remoteAudio.group.smooth')}</span>
            <Switch
              id="remote-audio-smooth"
              ariaLabel={t('remoteAudio.group.smooth')}
              isOn={smooth}
              isDisabled={false}
              handleToggle={() => setSmooth(!smooth)}
            />
          </div>
          <button
            type="button"
            className="remote-audio__group-info"
            title={t('remoteAudio.group.smoothHint')}
            aria-label={t('remoteAudio.group.smoothHint')}
          >
            <MenuIcon name="info" />
          </button>
        </div>
      </article>
      <div
        className="remote-audio__group-list remote-audio__peer-scroll"
        role="group"
        aria-label={t('remoteAudio.group.title')}
      >
        {audioGroupRows(remote).map(({ name, computerId, link }) => {
          const paused = link?.switches.paused ?? false;
          const canPlay = !!link && (remote.bothWays || !link.joined);
          const controls = link && linkControls(link, remote.bothWays, sharing);
          const live =
            !!link && heardHere(link, remote.bothWays) && link.receiving;
          let line = t('remoteAudio.group.offline');
          if (link) {
            if (paused) {
              line = t('remoteAudio.lane.inPaused');
            } else if (link.theirs?.paused) {
              line = t('remoteAudio.lane.pausedThere', { name });
            } else if (!canPlay) {
              line = t('remoteAudio.lane.inOneWay');
            } else if (link.joined && link.theirs === undefined) {
              line = t('remoteAudio.lane.inOld', { name });
            } else if (link.theirs?.sends === false) {
              line = t('remoteAudio.lane.inNotSent', { name });
            } else if (!link.switches.play) {
              line = t('remoteAudio.lane.inOff', { name });
            } else if (live) {
              line = link.nowPlaying?.title ?? t('remoteAudio.lane.receiving');
            } else {
              line = t('remoteAudio.lane.inQuiet', { name });
            }
          }
          return (
            <article
              className="remote-audio__lane remote-audio__group-row"
              key={computerId}
              aria-label={name}
            >
              <div className="remote-audio__lanes remote-audio__group-lanes">
                <RemoteAudioLane
                  direction="in"
                  kicker={
                    link
                      ? t('remoteAudio.lane.from', { name })
                      : t('remoteAudio.group.offline')
                  }
                  title={name}
                  line={line}
                  lineDetail={live ? link?.nowPlaying?.subtitle : undefined}
                  live={live}
                  meterKey={link?.id ?? computerId}
                  subscribe={remote.subscribeMeter}
                  figures={[]}
                  switchId={`receive-${computerId}`}
                  switchLabel={t('remoteAudio.group.receive')}
                  isOn={!!controls?.receive && !!link?.switches.play}
                  isSwitchDisabled={!controls?.receive}
                  onToggle={() => {
                    if (link && controls?.receive) {
                      choose(link, { play: !link.switches.play });
                    }
                  }}
                />
              </div>
              <div className="remote-audio__link-actions remote-audio__group-actions">
                <div className="remote-audio__lane-switch">
                  <span>{t('remoteAudio.group.send')}</span>
                  <Switch
                    id={`send-${computerId}`}
                    ariaLabel={t('remoteAudio.lane.to', { name })}
                    isOn={!!controls?.send && !!link?.switches.send}
                    isDisabled={!controls?.send}
                    handleToggle={() => {
                      if (link && controls?.send) {
                        choose(link, { send: !link.switches.send });
                      }
                    }}
                  />
                </div>
                <RemoteAudioPeerMenu
                  name={name}
                  paused={paused}
                  canPause={!!link}
                  onPause={() => {
                    if (link) {
                      choose(link, { paused: !paused });
                    }
                  }}
                  onUnlink={() => {
                    remote
                      .unlink(link ? { peerId: link.id } : { computerId })
                      .catch(() => undefined);
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
export default RemoteAudioGroup;
