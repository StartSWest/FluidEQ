/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import DspRailRow from '../dsp/DspRailRow';
import DspSectionIcon from '../dsp/DspSectionIcon';
import type { TDspSection } from '../dsp/sections';
import EqModeIcon from '../icons/EqModeIcon';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import {
  GAMING_GROUP_KEYS,
  GAMING_STAGES,
  gamingStageSection,
  TGamingStage,
  TGamingStageGroup,
} from './gamingStages';

/** The game's own sound, while it is the one on. */
interface IGamingPlaying {
  /** Which parts are doing something. */
  lamps: Partial<Record<TGamingStage, boolean>>;
  /** A stage's switch on its row: what the stage card's power switch does. */
  onToggle: (section: TDspSection) => void;
}

interface IGamingStageRailProps {
  active: TGamingStage;
  onSelect: (stage: TGamingStage) => void;
  /**
   * Absent while the game's sound is not the one on: there is then no card to
   * switch a stage from either (`GamingStageWaiting` stands in its place),
   * so the rail has no lamps and no switches.
   */
  playing?: IGamingPlaying;
  tuned: readonly TGamingStage[];
}

/**
 * The picture beside a part: the DSP page's own for a stage of the rack, and
 * the EQ page's own glyphs for its two, framed the way the rack's are so a
 * column of them reads as one rail.
 */
const StageIcon = ({ stage }: { stage: TGamingStage }) => {
  if (stage !== 'mainEq' && stage !== 'curve') {
    return <DspSectionIcon section={stage as TDspSection} />;
  }
  return (
    <span className="dsp-section-icon gaming-rail__glyph">
      {stage === 'curve' ? (
        <EqModeIcon kind="curves" />
      ) : (
        <MenuIcon name="layout" />
      )}
    </span>
  );
};

const GROUPS: readonly TGamingStageGroup[] = ['game', 'sound', 'dsp'];

/**
 * Every part of a game's sound down the side, as the DSP page lists its
 * stages, so tuning a game is one page and not three (Ivan, 2026-11-02).
 * While the game's sound is the one on, each stage of the rack and the Game
 * filter has its own switch on its row, the same rows as the Mic tab's
 * (`DspRailRow`, Ivan, 2026-11-25), and the bands and the curve - on by being
 * there, with no switch - keep the lamp that says they are doing anything;
 * "tuned" is whether this game's copy has moved away from its profile there.
 */
const GamingStageRail = ({
  active,
  onSelect,
  playing,
  tuned,
}: IGamingStageRailProps) => {
  const { t } = useTranslation();
  return (
    <nav className="dsp-rail gaming-rail" aria-label={t('gaming.tab')}>
      {GROUPS.map((group) => (
        <div key={group} className="gaming-rail__group">
          <span className="dsp-rail-group-label">
            {t(GAMING_GROUP_KEYS[group])}
          </span>
          {GAMING_STAGES.filter((stage) => stage.group === group).map(
            ({ id, labelKey }) => {
              const section = gamingStageSection(id);
              const isOn = Boolean(playing?.lamps[id]);
              return (
                <DspRailRow
                  key={id}
                  name={t(labelKey)}
                  isActive={id === active}
                  isOff={playing !== undefined && !isOn}
                  power={
                    playing && section
                      ? {
                          id: `gaming-rail-${id}`,
                          isOn,
                          isDisabled: false,
                          onToggle: () => playing.onToggle(section),
                        }
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className={`dsp-rail-tab${
                      id === active ? ' is-active' : ''
                    }${isOn ? ' is-on' : ''}`}
                    aria-current={id === active ? 'true' : undefined}
                    title={t(labelKey)}
                    onClick={() => onSelect(id)}
                  >
                    <StageIcon stage={id} />
                    <span className="dsp-rail-name">{t(labelKey)}</span>
                    {tuned.includes(id) && (
                      <span className="gaming-rail__tuned">
                        {t('gaming.rail.tuned')}
                      </span>
                    )}
                    {playing && (
                      <span className="dsp-rail-lamp" aria-hidden="true" />
                    )}
                  </button>
                </DspRailRow>
              );
            },
          )}
        </div>
      ))}
    </nav>
  );
};

export default GamingStageRail;
