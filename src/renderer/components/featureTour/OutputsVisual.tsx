/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';
import SidebarSection from '../SidebarSection';
import Switch from '../../widgets/Switch';
import BatteryLevel from '../../widgets/BatteryLevel';
import Chevron from '../../icons/Chevron';
import MenuIcon from '../../icons/MenuIcon';
import MirrorDelay from '../../MirrorDelay';
import '../../styles/DeviceProfiles.scss';
import '../../styles/PresetsBar.scss';
import '../../styles/ExtraOutputs.scss';
import '../../styles/OutputEditButton.scss';
import '../../styles/List.scss';
import '../../styles/Dropdown.scss';

/**
 * Every output keeping its own sound, as the side panel shows it: the Output
 * card, built from the panel's own pieces and classes, switching from the
 * headset to the speakers and back, each bringing its own profile with it;
 * and the Second output card with a headset playing beside them on a profile
 * of its own.
 *
 * Drawn with the panel's real parts, not a drawing of them: a picture made
 * of look-alike cards showed a Second output the app does not have, and the
 * film beside it showed the real one (Ivan, 2026-10-18: "generate the right
 * ui"). Inert, so nothing in it can be pressed; the reader's colours and
 * language, because it is the panel itself. The two cards' footnotes are left
 * out: the picture has to fit beside "How to start" on a laptop's window.
 */

interface IOutputTurn {
  name: string;
  profiles: TranslationKey[];
  /** The profile the output plays, one of `profiles`. */
  on: TranslationKey;
}

const TURNS: IOutputTurn[] = [
  {
    name: 'Kraken V4 Pro',
    profiles: [
      'dsp.eqPreset.rock',
      'dsp.eqPreset.lateNight',
      'dsp.eqPreset.jazz',
    ],
    on: 'dsp.eqPreset.rock',
  },
  {
    name: 'Speakers (Realtek(R) Audio)',
    profiles: [
      'dsp.eqPreset.movie',
      'dsp.eqPreset.podcast',
      'dsp.eqPreset.lateNight',
    ],
    on: 'dsp.eqPreset.movie',
  },
];

const SPEAKER = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M18.5 7a7 7 0 0 1 0 10" />
  </svg>
);

const TWO_OUTPUTS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <rect x="3" y="4" width="7" height="16" rx="2" />
    <rect x="14" y="4" width="7" height="16" rx="2" />
    <circle cx="6.5" cy="14" r="2" />
    <circle cx="17.5" cy="14" r="2" />
  </svg>
);

/** The output picker's face, as `DeviceProfiles` draws the chosen output. */
const OutputFace = ({ turn }: { turn: IOutputTurn }) => {
  const { t } = useTranslation();
  return (
    <div className="dropdown dropdown--down device-profiles__row">
      <div role="menu" className="row">
        <div className="device-option">
          <span className="device-dot active" />
          <svg
            className="device-option__glyph"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
            <rect x="3" y="13" width="4" height="7" rx="1.5" />
            <rect x="17" y="13" width="4" height="7" rx="1.5" />
          </svg>
          <span className="device-option__text">
            <span className="device-option__name">{turn.name}</span>
            <span className="device-option__sub">{t(turn.on)}</span>
          </span>
          <span className="device-option__badges">
            <span className="default-badge">{t('output.active')}</span>
          </span>
        </div>
        <Chevron className="arrow" />
      </div>
    </div>
  );
};

/** That output's profiles, as `PresetsBar` lists them, its own one on. */
const ProfileList = ({ turn }: { turn: IOutputTurn }) => {
  const { t } = useTranslation();
  return (
    <div className="list-wrapper profile-list">
      <ul className="list profile-list">
        {turn.profiles.map((profile) => (
          <li
            key={profile}
            className={`row preset-list-item${
              profile === turn.on ? ' selected' : ''
            }`}
          >
            <div className="preset-name">
              <span>{t(profile)}</span>
              {profile === turn.on && (
                <span className="preset-attached">
                  {t('profiles.attached')}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * The two outputs' parts, one over the other in one place, crossing over in
 * turn (`_tour-outputs.scss`): what the reader sees switching output.
 */
const Turns = ({ part }: { part: 'face' | 'profiles' }) => (
  <div className="outputs-visual__turns">
    {TURNS.map((turn, index) => (
      <div
        key={turn.name}
        className={`outputs-visual__turn outputs-visual__turn--${index}`}
      >
        {part === 'face' ? (
          <OutputFace turn={turn} />
        ) : (
          <ProfileList turn={turn} />
        )}
      </div>
    ))}
  </div>
);

export default function OutputsVisual() {
  const { t } = useTranslation();
  const nothing = () => undefined;
  return (
    <div
      className="outputs-visual pane-picture"
      role="img"
      aria-label={t('tour.outputs.imageAlt')}
      inert
    >
      <SidebarSection
        className="device-profiles"
        glyph={SPEAKER}
        title={t('output.title')}
        summary={<Turns part="face" />}
      >
        <div className="presets-bar">
          <div className="presets-bar__head">
            <span className="eyebrow">{t('profiles.title')}</span>
            <span className="presets-bar__count">3</span>
          </div>
          <Turns part="profiles" />
          <div className="profile-actions">
            <span className="button small subtle profile-actions__new">
              {t('profiles.new')}
            </span>
            <span className="button small subtle profile-actions__restore">
              {t('profiles.restore')}
            </span>
            <span className="button small profile-actions__save">
              {t('profiles.update')}
            </span>
          </div>
        </div>
      </SidebarSection>

      <SidebarSection
        className="extra-outputs"
        glyph={TWO_OUTPUTS}
        title={t('extraOutput.title')}
        aside={
          <div className="extra-outputs__rule">
            <Switch
              id="tour-single-player"
              isOn
              isDisabled={false}
              handleToggle={nothing}
            />
            <span className="extra-outputs__text">
              <span className="extra-outputs__name">
                {t('extraOutput.singlePlayer')}
              </span>
              <span className="extra-outputs__profile">
                {t('extraOutput.singlePlayerHint')}
              </span>
            </span>
          </div>
        }
      >
        <ul className="extra-outputs__list">
          <li className="extra-outputs__row">
            <Switch
              id="tour-second-output"
              isOn
              isDisabled={false}
              handleToggle={nothing}
            />
            <span className="device-dot active" />
            <div className="extra-outputs__text">
              <span className="extra-outputs__name">
                BlackShark V2 Pro
                <BatteryLevel percent={82} />
              </span>
              <div className="device-profiles__picker">
                <span className="device-profiles__label">
                  {t('extraOutput.profile')}
                </span>
                <div className="extra-outputs__profileActions">
                  <div className="output-profile-select">
                    <div className="dropdown dropdown--down">
                      <div role="menu" className="row">
                        {t('dsp.eqPreset.gaming')}
                        <Chevron className="arrow" />
                      </div>
                    </div>
                  </div>
                  <span className="extra-outputs__separator">·</span>
                  <span className="link-button output-edit-button">
                    <MenuIcon name="configure" />
                    <span>{t('extraOutput.edit')}</span>
                  </span>
                </div>
              </div>
              <div className="extra-outputs__volume">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={100}
                  readOnly
                  tabIndex={-1}
                />
                <span className="extra-outputs__volumeValue">100%</span>
              </div>
              {/* The engine's own delay, as the panel says it for an output
                  the FluidEQ Engine plays: what the slide promises. */}
              <MirrorDelay delayMs={38} kind="engine" incoming={[]} />
            </div>
          </li>
        </ul>
      </SidebarSection>
    </div>
  );
}
