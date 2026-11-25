/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ReactNode } from 'react';
import type { TEqModeScope } from 'common/eqMode';
import { DEFAULT_CURVE_SMOOTHING } from 'common/eqShape';
import { DEFAULT_TREBLE_DESIGN } from 'common/filterDesign';
import { EqModeReset, EqModeRows } from '../../components/eqMode/EqModeRows';
import type {
  TEqModeChoices,
  TEqModeRowKind,
} from '../../components/eqMode/useEqModeChoices';
import { EQ_MODE_SCOPES } from '../../components/eqMode/useEqModeChoices';
import SidebarSection from '../../components/SidebarSection';
import EqModeIcon from '../../icons/EqModeIcon';
import MenuIcon from '../../icons/MenuIcon';
import ProfileActionIcon from '../../icons/ProfileActionIcon';
import { FluidEqProviderWrapper } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import Dropdown from '../../widgets/Dropdown';
import IconButton, { IconName } from '../../widgets/IconButton';
import Switch from '../../widgets/Switch';
import helpEqState from './helpEqState';
import '../../styles/Dsp.scss';
import '../../styles/EqModeSelect.scss';

/**
 * The sound panel beside the EQ page, as `SoundPanel` stacks it: the EQ mode
 * card pinned first, the Output card with its profiles, the second output
 * and the driver type — for the EQ mode and profiles chapters.
 *
 * The EQ mode card's rows and Reset are the card's own (`EqModeRows`,
 * `EqModeReset`), handed made-up choices in place of `useEqModeChoices`,
 * which reads the reader's engine, phase and treble over IPC. The sections
 * are `SidebarSection`; what is inside them — the outputs, the profiles, the
 * second output, the driver — is their markup, class for class
 * (`DeviceProfiles`, `PresetsBar`, `PresetListItem`, `ExtraOutputs`,
 * `DriverPicker`), with made-up outputs and profiles: the real ones list the
 * reader's own. Nothing in it acts.
 */

const nothing = () => undefined;
const nowhere = async () => undefined;

/** The panel's width on a wide window. */
const PANEL_WIDTH = 330;
/** Tall enough for every card open, so none is clipped by the panel's scroll. */
const PANEL_HEIGHT = 1100;

const VALUE = helpEqState();

/** The card's state: everything at its default, Normal on both tabs. */
const choices: TEqModeChoices = {
  state: { ...VALUE, bandCount: 10 },
  phase: {
    status: {
      variant: 'B',
      eqVariant: 'B',
      eqSupported: true,
      hasSampledCurves: false,
      supported: true,
      active: false,
    },
    select: nowhere,
  },
  customized: false,
  disabled: false,
  trebleShown: true,
  trebleSupported: true,
  trebleOf: () => DEFAULT_TREBLE_DESIGN,
  linearDelayLabel: () => '',
  currentChoice: (_scope: TEqModeScope, kind: TEqModeRowKind) => {
    if (kind === 'strength') {
      return 'normal';
    }
    if (kind === 'q') {
      return 'off';
    }
    if (kind === 'treble') {
      return DEFAULT_TREBLE_DESIGN;
    }
    if (kind === 'phase') {
      return 'B';
    }
    return DEFAULT_CURVE_SMOOTHING;
  },
  select: nowhere,
  pending: undefined,
  isSaving: false,
};

/** `PinnedEqModeCard`'s markup, on Your EQ. */
const EqModeCardStill = () => {
  const { t } = useTranslation();
  return (
    <SidebarSection
      className="eq-mode-card"
      glyph={<MenuIcon name="settings" />}
      title={t('eq.mode')}
      status={t('eq.mode.normal')}
      aside={
        <button
          type="button"
          className="button small subtle eq-mode-card__unpin"
          aria-label={t('eq.mode.unpin')}
        >
          <MenuIcon name="pin" />
        </button>
      }
    >
      <div className="eq-mode-choices eq-mode-card__body">
        <div className="eq-mode-card__groups" role="tablist">
          {EQ_MODE_SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={scope === 'eq'}
              className="eq-mode-card__group"
            >
              <EqModeIcon kind={scope} />
              <span>
                {t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves')}
              </span>
            </button>
          ))}
        </div>
        <div className="eq-mode-card__panels">
          {EQ_MODE_SCOPES.map((scope) => (
            <div
              key={scope}
              className="eq-mode-card__rows"
              role="tabpanel"
              inert={scope !== 'eq'}
            >
              <EqModeRows choices={choices} scope={scope} />
            </div>
          ))}
        </div>
        <div className="eq-mode-card__foot">
          <p className="eq-mode-choices__note">{t('eq.mode.shapeHint')}</p>
          <EqModeReset choices={choices} />
        </div>
      </div>
    </SidebarSection>
  );
};

const HEADSET_GLYPH = (
  <>
    <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
    <rect x="3" y="13" width="4" height="7" rx="1.5" />
    <rect x="17" y="13" width="4" height="7" rx="1.5" />
  </>
);

/** A made-up output, as `DeviceProfiles` writes one in its list. */
const OutputOption = ({
  name,
  sub,
  isActive,
}: {
  name: string;
  sub: string;
  isActive: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <div className="device-option">
      <span className={isActive ? 'device-dot active' : 'device-dot'} />
      <svg className="device-option__glyph" viewBox="0 0 24 24">
        {HEADSET_GLYPH}
      </svg>
      <span className="device-option__text">
        <span className="device-option__name">{name}</span>
        <span className="device-option__sub">{sub}</span>
      </span>
      <span className="device-option__badges">
        {isActive && (
          <span className="default-badge">{t('output.active')}</span>
        )}
      </span>
    </div>
  );
};

/** One profile in the list, as `PresetListItem` draws it at rest. */
const ProfileRow = ({
  name,
  isOn,
  isSelected,
}: {
  name: string;
  isOn: boolean;
  isSelected: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <li
      role="menuitem"
      className={`row preset-list-item ${isSelected ? 'selected' : ''}`}
    >
      <div className="preset-name">
        <span>{name}</span>
        {isOn && (
          <span className="preset-attached">{t('profiles.attached')}</span>
        )}
      </div>
      <div className="row icons">
        <IconButton
          icon={IconName.EDIT}
          handleClick={nothing}
          isDisabled={false}
        />
        <IconButton
          icon={IconName.DELETE}
          handleClick={nothing}
          isDisabled={false}
        />
      </div>
    </li>
  );
};

const ProfileAction = ({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) => (
  <div role="button" className={`button ${className}`}>
    {children}
  </div>
);

const OutputCard = () => {
  const { t } = useTranslation();
  const headset = t('help.profiles.sampleHeadset');
  return (
    <SidebarSection
      className="device-profiles"
      glyph={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M18.5 7a7 7 0 0 1 0 10" />
        </svg>
      }
      title={t('output.title')}
      summary={
        <Dropdown
          name={t('output.device')}
          className="device-profiles__row"
          options={[
            {
              value: 'headset',
              label: headset,
              display: (
                <OutputOption
                  name={headset}
                  sub={t('output.playing', {
                    profile: t('help.profiles.sampleMusic'),
                  })}
                  isActive
                />
              ),
            },
          ]}
          value="headset"
          handleChange={nothing}
          isDisabled={false}
        />
      }
    >
      <div className="presets-bar">
        <div className="presets-bar__head">
          <span className="eyebrow">{t('profiles.title')}</span>
          <span className="presets-bar__count">3</span>
        </div>
        <div className="list-wrapper profile-list">
          <ul className="list profile-list">
            <ProfileRow name={t('help.profiles.sampleMusic')} isOn isSelected />
            <ProfileRow
              name={t('help.profiles.sampleMovies')}
              isOn={false}
              isSelected={false}
            />
            <ProfileRow
              name={t('help.profiles.sampleNight')}
              isOn={false}
              isSelected={false}
            />
          </ul>
        </div>
        <div className="profile-actions">
          <ProfileAction className="small subtle profile-actions__new">
            <ProfileActionIcon action="new" />
            {t('profiles.new')}
          </ProfileAction>
          <ProfileAction className="small subtle profile-actions__restore">
            <ProfileActionIcon action="restore" />
            {t('profiles.restore')}
          </ProfileAction>
          <ProfileAction className="small profile-actions__save">
            <ProfileActionIcon action="save" />
            {t('profiles.update')}
          </ProfileAction>
        </div>
      </div>
      <p className="device-profiles__hint">{t('output.hint')}</p>
    </SidebarSection>
  );
};

/** The second output, folded, one output mirrored to, as `ExtraOutputs`. */
const SecondOutput = () => {
  const { t } = useTranslation();
  const speakers = t('help.profiles.sampleSpeakers');
  return (
    <SidebarSection
      className="extra-outputs"
      defaultOpen={false}
      glyph={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="7" height="16" rx="2" />
          <rect x="14" y="4" width="7" height="16" rx="2" />
          <circle cx="6.5" cy="14" r="2" />
          <circle cx="17.5" cy="14" r="2" />
        </svg>
      }
      title={t('extraOutput.title')}
      summaryWhenCollapsedOnly
      summary={
        <ul className="extra-outputs__onList">
          <li className="extra-outputs__on">
            <span className="device-dot active" />
            <span className="extra-outputs__onText">
              <span className="extra-outputs__onLine">
                <span className="extra-outputs__onName">{speakers}</span>
              </span>
              <span className="extra-outputs__profileActions">
                <span className="extra-outputs__onProfile">
                  {t('output.mapping.neutral')}
                </span>
                <span className="extra-outputs__separator" aria-hidden="true">
                  ·
                </span>
                <button
                  className="link-button output-edit-button"
                  type="button"
                  aria-pressed={false}
                >
                  <MenuIcon name="configure" />
                  <span>{t('extraOutput.edit')}</span>
                </button>
              </span>
            </span>
          </li>
        </ul>
      }
      aside={
        <div className="extra-outputs__rule">
          <Switch
            id="help-single-player"
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
      <p className="extra-outputs__hint">{t('extraOutput.hint')}</p>
    </SidebarSection>
  );
};

const DriverType = () => {
  const { t } = useTranslation();
  return (
    <SidebarSection
      glyph={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          {HEADSET_GLYPH}
        </svg>
      }
      title={t('driver.title')}
      summary={
        <Dropdown
          name={t('driver.title')}
          options={[
            {
              value: 'none',
              label: t('driver.none'),
              display: (
                <div className="driver-option">
                  <span>{t('driver.none')}</span>
                  <small>{t('driver.none.hint')}</small>
                </div>
              ),
            },
          ]}
          value="none"
          isDisabled={false}
          handleChange={nothing}
        />
      }
    >
      {null}
    </SidebarSection>
  );
};

export default function SoundPanelDrawing() {
  return (
    <FluidEqProviderWrapper value={VALUE}>
      <div
        className="right-content is-shown"
        style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
      >
        <div className="right-content__panel">
          <div
            className="right-content__scroll"
            style={{ overflow: 'visible' }}
          >
            <EqModeCardStill />
            <OutputCard />
            <SecondOutput />
            <DriverType />
          </div>
        </div>
      </div>
    </FluidEqProviderWrapper>
  );
}
