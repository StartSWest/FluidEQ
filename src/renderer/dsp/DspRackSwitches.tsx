/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../common/i18n/en';
import GameModeSwitch from '../components/GameModeSwitch';
import LatencyReadout from '../components/LatencyReadout';
import { useTranslation } from '../utils/I18nContext';
import type { IListenedDelay } from '../utils/useListenedOutput';
import Switch from '../widgets/Switch';
import DspHeldLock from './DspHeldLock';

interface IDspRackSwitchesProps {
  /** Under the FluidEQ Engine, where Game mode and its delay are the rack's. */
  isSystemWide: boolean;
  /** The installed engine's version, which decides whether Game mode exists. */
  engineVersion: string | undefined;
  /** What the engine reports for the output being listened to. */
  reportedGameMode: boolean | undefined;
  delay: IListenedDelay | undefined;
  /** Which channels the rack is actually on, the Room's hold included. */
  allChannels: boolean;
  isRoomOn: boolean;
  isRackEngaged: boolean;
  isRackLive: boolean;
  onToggleSurround: () => void;
  onTogglePower: () => void;
}

/**
 * The rack's switches, wrapped as one: at a narrow width they leave the first
 * row together and stay at the right, where separately the power switch went
 * to a row of its own at the left. The surround switch is beside the rack's
 * own switch, not on the Master card: it is a setting of the whole rack -
 * which channels of a surround output it runs on - and a card that is
 * switched off with its stage would have taken it off with it. Its two words
 * say which channels, the way the power's say on or off; the longer sentence
 * is the tooltip.
 */
const DspRackSwitches = ({
  isSystemWide,
  engineVersion,
  reportedGameMode,
  delay,
  allChannels,
  isRoomOn,
  isRackEngaged,
  isRackLive,
  onToggleSurround,
  onTogglePower,
}: IDspRackSwitchesProps) => {
  const { t } = useTranslation();
  /** Why the surround switch reads as it does: the Room's reason first. */
  const surroundHint = (): TranslationKey => {
    if (isRoomOn) {
      return 'dsp.surround.roomHint';
    }
    return allChannels ? 'dsp.surround.onHint' : 'dsp.surround.offHint';
  };
  return (
    <div className="dsp-header-switches">
      {/* One capsule, the same one the equaliser's page wears: the switch is
          what moves the figure beside it, and standing apart they read as
          two unrelated things rather than as a cause and its number. */}
      {isSystemWide ? (
        <div className="engine-strip">
          <GameModeSwitch
            installedVersion={engineVersion}
            reportedGameMode={reportedGameMode}
          />
          {delay ? (
            <LatencyReadout latency={delay.latency} gameMode={delay.gameMode} />
          ) : null}
        </div>
      ) : null}
      <div className="dsp-global-power dsp-surround" title={t(surroundHint())}>
        {/* Held by the Room, and said inside the group that is held: see
            `DspHeldLock` for the two ways a sentence on a line of its own got
            this wrong. */}
        {isRoomOn ? <DspHeldLock /> : undefined}
        <span
          className={`dsp-global-power-state${allChannels ? ' is-on' : ''}`}
          aria-hidden="true"
        >
          {allChannels
            ? t('dsp.surround.allChannels')
            : t('dsp.surround.frontPair')}
        </span>
        <Switch
          id="dsp-surround-all-channels"
          isOn={allChannels}
          // Held on, and held still, while the Room is running: it takes every
          // channel to place them around the head, so a switch that still
          // moved would be saying something the rack is not doing. The stored
          // choice is untouched and comes back when the Room goes off.
          isDisabled={!isRackEngaged || isRoomOn}
          handleToggle={onToggleSurround}
          ariaLabel={t('dsp.surround.title')}
        />
      </div>
      <div className="dsp-global-power">
        <span
          className={`dsp-global-power-state${isRackLive ? ' is-on' : ''}`}
          aria-hidden="true"
        >
          {isRackLive ? t('dsp.enabled') : t('dsp.bypassed')}
        </span>
        <Switch
          id="dsp-global-toggle"
          isOn={isRackLive}
          isDisabled={!isRackEngaged}
          handleToggle={onTogglePower}
          ariaLabel={t('dsp.title')}
        />
      </div>
    </div>
  );
};

export default DspRackSwitches;
