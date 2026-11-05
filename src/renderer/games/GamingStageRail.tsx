/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import DspSectionIcon from '../dsp/DspSectionIcon';
import type { TDspSection } from '../dsp/sections';
import EqModeIcon from '../icons/EqModeIcon';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import {
  GAMING_GROUP_KEYS,
  GAMING_STAGES,
  TGamingStage,
  TGamingStageGroup,
} from './gamingStages';

interface IGamingStageRailProps {
  active: TGamingStage;
  onSelect: (stage: TGamingStage) => void;
  /** Which parts are doing something, while the game's sound is the one on. */
  lamps?: Partial<Record<TGamingStage, boolean>>;
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
 * The lamp is whether the part is doing anything, read only while the game's
 * sound is the one on; "tuned" is whether this game's copy has moved away
 * from its profile there.
 */
const GamingStageRail = ({
  active,
  onSelect,
  lamps,
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
            ({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                className={`dsp-rail-tab${id === active ? ' is-active' : ''}${
                  lamps?.[id] ? ' is-on' : ''
                }`}
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
                {lamps && <span className="dsp-rail-lamp" aria-hidden="true" />}
              </button>
            ),
          )}
        </div>
      ))}
    </nav>
  );
};

export default GamingStageRail;
