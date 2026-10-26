/* FluidEQ — GPL-3.0-or-later */
import type { ReactNode } from 'react';
import { useTranslation } from '../utils/I18nContext';
import RemoteAudioFader from './RemoteAudioFader';
import { audioGroupRows, audioLinkKey } from './RemoteAudioGroup';
import type { IRemoteAudioValue } from './remoteAudioState';
import { linkControls } from './linkRecords';

/** The system fader targets the OS default output, which the output picker
 * changes too. Incoming gains are independent receiver gains; no send gain. */
const RemoteAudioMix = ({
  remote,
  system,
  output,
}: {
  remote: IRemoteAudioValue;
  system: {
    isAvailable: boolean;
    level?: number;
    isMuted: boolean;
    setLevel(value: number): void;
    toggleMute(): void;
  };
  output?: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <section
      className="remote-audio__link remote-audio__mix"
      aria-label={t('remoteAudio.group.mix')}
    >
      <header className="remote-audio__link-head">
        <span className="remote-audio__link-name">
          <strong>{t('remoteAudio.group.mix')}</strong>
        </span>
      </header>
      {output}
      <RemoteAudioFader
        id="this-pc-volume"
        label={t('remoteAudio.group.thisPC')}
        value={system.isAvailable ? system.level : undefined}
        disabled={!system.isAvailable}
        muted={system.isMuted}
        muteLabel={t(
          system.isMuted
            ? 'remoteAudio.group.unmute'
            : 'remoteAudio.group.mute',
        )}
        onToggleMute={system.toggleMute}
        onChange={(level) => {
          if (system.isMuted && level > 0) {
            system.toggleMute();
          }
          system.setLevel(level);
        }}
        caption={
          !system.isAvailable
            ? t('remoteAudio.group.unavailable')
            : t('player.volume.system')
        }
      />
      <div
        className="remote-audio__peer-scroll"
        role="group"
        aria-label={t('remoteAudio.group.mix')}
      >
        {audioGroupRows(remote).map(({ link }) => {
          if (!link) {
            return null;
          }
          const controls = linkControls(link, remote.bothWays, remote.sharing);
          const canAdjust = controls.receive && link.switches.play;
          let caption = t('remoteAudio.lane.inQuiet', { name: link.name });
          if (link.receiving) {
            caption = t('remoteAudio.lane.receiving');
          }
          if (link.switches.paused) {
            caption = t('remoteAudio.linked.paused');
          } else if (link.theirs?.paused) {
            caption = t('remoteAudio.lane.pausedThere', { name: link.name });
          } else if (link.theirs?.sends === false) {
            caption = t('remoteAudio.lane.inNotSent', { name: link.name });
          } else if (!link.switches.play) {
            caption = t('remoteAudio.lane.inOff', { name: link.name });
          }
          return (
            <RemoteAudioFader
              key={link.id}
              id={`volume-${link.id}`}
              label={link.name}
              value={link.switches.volume}
              muted={link.switches.muted}
              muteLabel={`${link.name}: ${t(link.switches.muted ? 'library.unmute' : 'library.mute')}`}
              onToggleMute={() => {
                if (!canAdjust) {
                  return;
                }
                remote
                  .setSwitches(audioLinkKey(link), {
                    ...link.switches,
                    muted: !link.switches.muted,
                  })
                  .catch(() => undefined);
              }}
              disabled={!canAdjust}
              caption={caption}
              onChange={(volume) => {
                if (!canAdjust) {
                  return;
                }
                remote
                  .setSwitches(audioLinkKey(link), {
                    ...link.switches,
                    volume,
                    ...(volume > 0 ? { muted: false } : {}),
                  })
                  .catch(() => undefined);
              }}
            />
          );
        })}
      </div>
    </section>
  );
};
export default RemoteAudioMix;
