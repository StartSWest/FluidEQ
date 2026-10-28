/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IRemoteNowPlaying } from 'common/remoteAudio';
import { LINK_SWITCHES_ON } from 'common/remoteAudio';
import { PICTURE_QUEUE } from '../../components/featureTour/playerPictureData';
import MenuIcon from '../../icons/MenuIcon';
import type { IRemoteAudioMeter } from '../../remoteAudio/meter';
import RemoteAudioGroup from '../../remoteAudio/RemoteAudioGroup';
import RemoteAudioMix from '../../remoteAudio/RemoteAudioMix';
import type { IRemoteAudioValue } from '../../remoteAudio/remoteAudioState';
import { useTranslation } from '../../utils/I18nContext';
import Dropdown from '../../widgets/Dropdown';
import '../../styles/RemoteAudio.scss';
import '../../styles/RemoteAudioGroup.scss';

/**
 * The Share Audio chapter's page, drawn by the page's own parts
 * (`helpChapters/listen.ts`).
 *
 * The group and the mix are the page's own components, handed a made-up
 * group: this computer playing a song from the Library, a studio computer
 * playing another here, a laptop that joined through it and is not received
 * yet, and a bedroom computer that is away. The page's head and its output
 * picker are their markup, class for class, as `RemoteAudioPanel` and
 * `RemoteAudioOutput` draw them: the panel reads the reader's own players and
 * volume, and the picker the reader's own outputs. It stands in the
 * workspace's card, which is also the width the page's layout answers to.
 */

const nothing = () => undefined;
const settled = () => Promise.resolve();

const song = (index: number): IRemoteNowPlaying => ({
  title: PICTURE_QUEUE[index].title,
  subtitle: PICTURE_QUEUE[index].artist,
  artist: PICTURE_QUEUE[index].artist,
  isPlaying: true,
  positionMs: 0,
  durationMs: PICTURE_QUEUE[index].durationMs,
  canNext: true,
  canPrevious: true,
  canStep: true,
  canStop: true,
});

const STUDIO = 'peer-studio';

/** A lane's whole history at once: as many readings as a lane first keeps. */
const READINGS = 240;
const NO_WAVE = new Float32Array(0);

/** A few seconds of music for one computer, the same every time it is drawn. */
const readings = (sourceId: string | undefined, phase: number) =>
  Array.from({ length: READINGS }, (_, index): IRemoteAudioMeter => {
    const beat = index % 11 < 2 ? 0.28 : 0;
    const peak = Math.min(
      1,
      0.2 +
        0.12 * Math.sin(index / 7 + phase) +
        0.07 * Math.sin(index / 2.3 + phase * 2) +
        beat,
    );
    return { sourceId, peak, rms: peak * 0.7, waveform: NO_WAVE };
  });

const SOUND = [...readings(undefined, 0), ...readings(STUDIO, 1.7)];

const GROUP: IRemoteAudioValue = {
  bothWays: true,
  sharing: true,
  setSharing: settled,
  deviceName: 'Living Room PC',
  links: [
    {
      id: STUDIO,
      computerId: 'studio',
      name: 'Studio PC',
      joined: false,
      theirs: { sends: true, plays: true },
      switches: { ...LINK_SWITCHES_ON, volume: 0.8 },
      receiving: true,
      nowPlaying: song(3),
    },
    {
      id: 'peer-laptop',
      computerId: 'laptop',
      name: 'Laptop',
      joined: true,
      theirs: { sends: true, plays: true },
      switches: { ...LINK_SWITCHES_ON, play: false },
      receiving: false,
    },
  ],
  looking: [{ computerId: 'bedroom', deviceName: 'Bedroom PC' }],
  networkStats: [],
  phase: 'ready',
  sending: true,
  sendingFailed: false,
  start: settled,
  link: () => Promise.resolve(true),
  unlink: settled,
  setSwitches: settled,
  resumePlayback: settled,
  subscribeMeter: (listener) => {
    SOUND.forEach(listener);
    return nothing;
  },
};

const SYSTEM = {
  isAvailable: true,
  level: 0.64,
  isMuted: false,
  setLevel: nothing,
  toggleMute: nothing,
};

const OUTPUT = 'speakers';

/** The output the mix plays through, as `RemoteAudioOutput` draws it. */
const OutputPicker = () => {
  const { t } = useTranslation();
  return (
    <div className="remote-audio__lane remote-audio__mix-output">
      <span className="control-kicker">{t('remoteAudio.group.output')}</span>
      <Dropdown
        name={t('remoteAudio.group.output')}
        value={OUTPUT}
        options={[
          {
            value: OUTPUT,
            label: 'Speakers (Realtek Audio)',
            display: 'Speakers (Realtek Audio)',
          },
        ]}
        isDisabled={false}
        handleChange={nothing}
      />
    </div>
  );
};

/** The Share Audio page with a group of four, in the workspace's card. */
const ShareDrawing = () => {
  const { t } = useTranslation();
  return (
    <div className="workspace-tab-panel workspace-tab-panel--share">
      <div className="workspace-tab-panel__scroll">
        <section className="remote-audio">
          <header className="remote-audio__header">
            <div>
              <p className="eyebrow">{t('remoteAudio.eyebrow')}</p>
              <h2>{t('remoteAudio.title')}</h2>
            </div>
            <button type="button" className="button small">
              <MenuIcon name="plus" />
              {t('remoteAudio.group.add')}
            </button>
          </header>
          <div className="remote-audio__intro">
            <p>{t('remoteAudio.group.hint')}</p>
            <ul className="remote-audio__facts">
              <li>{t('remoteAudio.badge.local')}</li>
              <li>{t('remoteAudio.badge.lossless')}</li>
              <li>{t('remoteAudio.badge.encrypted')}</li>
            </ul>
          </div>
          <div className="remote-audio__columns">
            <RemoteAudioGroup remote={GROUP} localNowPlaying={song(1)} />
            <RemoteAudioMix
              remote={GROUP}
              system={SYSTEM}
              output={<OutputPicker />}
            />
          </div>
          <footer className="remote-audio__note">
            <strong>{t('remoteAudio.note.title')}</strong>
            <span>{t('remoteAudio.note.body')}</span>
          </footer>
        </section>
      </div>
    </div>
  );
};

export default ShareDrawing;
