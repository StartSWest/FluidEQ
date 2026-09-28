/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { engineSupportsGameMode } from 'common/engineHealth';
import type { TranslationKey } from 'common/i18n/en';
import type { TPlaybackOwner } from '../audio/playbackOwner';
import type { ITransportSource } from '../audio/transportSource';
import { useLiveAudioControl } from '../audio/LiveAudioContext';
import { formatLatencyMs } from '../components/LatencyReadout';
import { setGameMode, useDspSettings } from '../dsp/store';
import BrandMark from '../icons/BrandMark';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { readKnownAudioDevices } from '../utils/equalizerApi';
import { useFluidEqShell } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import {
  useListenedDelay,
  useListenedOutput,
} from '../utils/useListenedOutput';
import useSmoothFrames from '../utils/useSmoothFrames';
import PlayerIcon from './PlayerIcon';
import type { TPlayerPage } from './PlayerMarkMenu';
import { usePlayerSheet } from './playerLayout';
import { codecTag, sourceLabel, sourceShortLabel } from './playerText';

/** How often the flow follows the level: often enough to live, not to flicker. */
const LEVEL_EVERY_MS = 250;
/** The quietest level that counts as sound going through. */
const FLOOR_DB = -60;

/**
 * Each source by the tab strip's glyph for it (`PlayerMarkMenu`), and the
 * page its node opens, named by that page's tab. The machine's own audio
 * belongs to no page, so its node opens nothing.
 */
const SOURCE_NODES: Record<
  TPlaybackOwner,
  { icon: MenuIconName; page?: TPlayerPage; pageKey?: TranslationKey }
> = {
  library: { icon: 'album', page: 'library', pageKey: 'tabs.library' },
  media: { icon: 'video', page: 'video', pageKey: 'tabs.media' },
  karaoke: { icon: 'microphone', page: 'karaoke', pageKey: 'tabs.karaoke' },
  remote: { icon: 'waveform', page: 'share', pageKey: 'tabs.share' },
  system: { icon: 'monitor' },
};

/**
 * The name Windows gives the output being played through, for the output
 * node's tooltip. Read again whenever the output changes; an answer to an
 * older request never replaces a newer one.
 */
const useOutputName = () => {
  const [name, setName] = useState<string>();
  useEffect(() => {
    let isLive = true;
    let request = 0;
    const read = () => {
      request += 1;
      const asked = request;
      readKnownAudioDevices()
        .then((devices) => {
          if (isLive && asked === request) {
            setName(devices.find((device) => device.isDefault)?.name);
          }
          return undefined;
        })
        .catch((error: unknown) =>
          reportError('The output list could not be read for the amp', error),
        );
    };
    read();
    window.addEventListener('fluideq-output-changed', read);
    return () => {
      isLive = false;
      window.removeEventListener('fluideq-output-changed', read);
    };
  }, []);
  return name;
};

interface IPlayerPathProps {
  /** What is playing, or was last; nothing on an amp that has played nothing. */
  source: Pick<ITransportSource, 'owner' | 'origin'> | undefined;
  /** The file's format, for a Library song (`codecTag`). */
  codec: string | undefined;
  onOpenPage: (page: TPlayerPage) => void;
}

/**
 * WHERE THE SOUND GOES, under the song on the Stage (Ivan, 2026-09-28, the
 * third of three designs: "C ok"). One glass strip reads left to right as
 * the path the sound takes — where it comes from, FluidEQ, and the output it
 * reaches, with the output's rate and layout — and a light runs along its
 * two wires while sound is going through. Game mode stands beside it as a
 * switch, carrying the delay it is there to cut.
 *
 * It replaced six chips of one weight (source, level, rate, delay, layout,
 * Game mode). The level in decibels went: it read −∞ whenever the song was
 * paused and changed four times a second; the light on the wires says the
 * same thing, and is brighter as the sound is louder. The rate and layout
 * became the output's, and the delay Game mode's.
 *
 * The level is read from the live capture and written straight onto the
 * strip four times a second, never through React. The output's rate, layout
 * and delay are the engine's report of the output being listened to
 * (`useListenedOutput`), so they are there under the FluidEQ Engine only;
 * under Equalizer APO the output node is its glyph.
 */
const PlayerPath = ({ source, codec, onOpenPage }: IPlayerPathProps) => {
  const { t } = useTranslation();
  const { setSheet } = usePlayerSheet();
  const status = useKnownAudioEngineStatus();
  const { isEnabled, isBlockingError } = useFluidEqShell();
  const isFluid = status?.engine === 'fluid';
  const listened = useListenedOutput(isFluid && isEnabled);
  const delay = useListenedDelay(listened);
  const { gameMode } = useDspSettings();
  const outputName = useOutputName();
  const { isActive, readFrame } = useLiveAudioControl();
  const readRef = useRef(readFrame);
  readRef.current = readFrame;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const pathRef = useRef<HTMLSpanElement>(null);

  // Written as an attribute and a custom property, and only when either
  // changes: the wires light and dim with no render.
  const showFlow = useCallback(() => {
    const path = pathRef.current;
    if (!path) {
      return false;
    }
    const peaks = activeRef.current
      ? (readRef.current()?.channelPeaks ?? [])
      : [];
    const loudest = peaks.reduce((max, peak) => Math.max(max, peak), 0);
    const db = loudest > 0 ? 20 * Math.log10(loudest) : -Infinity;
    const flow = db > FLOOR_DB ? 'on' : 'off';
    if (path.dataset.flow !== flow) {
      path.dataset.flow = flow;
    }
    // In twentieths, so a level that wobbles inside one writes nothing.
    const level =
      flow === 'on' ? Math.round(((db - FLOOR_DB) / -FLOOR_DB) * 20) / 20 : 0;
    const written = String(level);
    if (path.style.getPropertyValue('--path-level') !== written) {
      path.style.setProperty('--path-level', written);
    }
    return activeRef.current;
  }, []);
  const kick = useSmoothFrames(showFlow, {
    isEnabled: true,
    target: pathRef,
    minFrameMs: () => LEVEL_EVERY_MS,
  });
  useEffect(() => {
    kick();
  }, [isActive, kick]);

  const { output } = listened;
  const latency = isEnabled ? delay?.latency : undefined;
  const channels = output?.channels;
  const isSurround = channels !== undefined && channels > 2;
  let layout: string | undefined;
  if (channels === 2) {
    layout = t('player.readout.stereo');
  } else if (channels === 1) {
    layout = t('player.readout.mono');
  } else if (isSurround) {
    // 5.1 and 7.1 are how every receiver and every game names a layout,
    // in every language: the speakers and the one subwoofer.
    layout = `${channels - 1}.1`;
  }
  const khz = latency ? Number((latency.rate / 1000).toFixed(1)) : undefined;
  const outputTitle = [
    outputName,
    khz === undefined ? undefined : `${khz} ${t('player.unit.khz')}`,
    layout,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
  const supportsGame =
    isFluid &&
    engineSupportsGameMode(status?.fluid.dllVersion, output?.gameMode);

  const node = source ? SOURCE_NODES[source.owner] : undefined;
  const tag = source?.owner === 'library' ? codecTag(codec) : undefined;
  const sourceFace = source && node && (
    <>
      <MenuIcon name={node.icon} className="player-path__icon" />
      <span>{sourceShortLabel(source, t)}</span>
      {tag && <span className="player-path__tag">{tag}</span>}
    </>
  );
  let sourceNode = null;
  if (source && node?.page && node.pageKey) {
    const { page } = node;
    sourceNode = (
      <button
        type="button"
        className="player-path__node"
        title={t('player.path.open', { name: t(node.pageKey) })}
        onClick={() => onOpenPage(page)}
      >
        {sourceFace}
      </button>
    );
  } else if (source) {
    sourceNode = (
      <span className="player-path__node" title={sourceLabel(source, t)}>
        {sourceFace}
      </span>
    );
  }
  const eqTitle = t(isEnabled ? 'player.path.eqOn' : 'player.path.eqOff');

  return (
    <>
      <span
        ref={pathRef}
        className="player-path"
        role="group"
        aria-label={t('player.path.aria')}
      >
        {sourceNode}
        {sourceNode && (
          <span className="player-path__wire" aria-hidden="true" />
        )}
        <button
          type="button"
          className={`player-path__node player-path__node--eq${
            isEnabled ? '' : ' is-off'
          }`}
          title={eqTitle}
          aria-label={eqTitle}
          onClick={() => setSheet({ tab: 'eq', isOpen: true })}
        >
          <BrandMark className="player-path__wave" />
        </button>
        <span
          className="player-path__wire player-path__wire--out"
          aria-hidden="true"
        />
        <span
          className="player-path__node"
          title={outputTitle || undefined}
          aria-label={outputTitle || undefined}
        >
          <PlayerIcon
            name={isSurround ? 'speakers' : 'headphones'}
            className="player-icon player-path__icon"
          />
          {khz !== undefined && <b>{`${khz}k`}</b>}
          {layout && <span className="player-path__soft">{layout}</span>}
        </span>
      </span>
      {supportsGame && (
        <button
          type="button"
          className={`player-game${gameMode ? ' is-on' : ''}`}
          aria-pressed={gameMode}
          title={t('dsp.gameMode.hint')}
          disabled={!isEnabled || isBlockingError}
          onClick={() => setGameMode(!gameMode)}
        >
          <span className="player-game__lamp" aria-hidden="true" />
          <PlayerIcon
            name="gamepad"
            className="player-icon player-game__icon"
          />
          <span>{t('player.path.game')}</span>
          {latency && (
            <span className="player-game__delay">
              {`${formatLatencyMs(latency.frames, latency.rate)} ${t(
                'player.unit.ms',
              )}`}
            </span>
          )}
        </button>
      )}
    </>
  );
};

export default PlayerPath;
