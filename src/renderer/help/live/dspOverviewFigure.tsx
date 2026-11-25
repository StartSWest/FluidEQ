/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { CSSProperties } from 'react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { DSP_PRESETS } from 'common/dsp/presets';
import type { TranslationKey } from 'common/i18n';
import TitleRate from '../../components/TitleRate';
import DspBarIcon from '../../dsp/DspBarIcon';
import DspMaximizerCard from '../../dsp/DspMaximizerCard';
import DspRackSwitches from '../../dsp/DspRackSwitches';
import DspSideTabs from '../../dsp/DspSideTabs';
import useBarWords from '../../dsp/useBarWords';
import { InfoMark } from '../../dsp/GenreNotesParts';
import type { TDspSection } from '../../dsp/sections';
import VoicingIcon from '../../icons/VoicingIcon';
import type { ILibraryRailWidth } from '../../library/LibraryRailSplitter';
import { useTranslation } from '../../utils/I18nContext';
import RichPick from '../../widgets/RichPick';
import { StudioRailPin, StudioRailUnderBar } from '../../widgets/StudioRail';
import '../../styles/Dsp.scss';

/**
 * The DSP chapter's page, laid out as `DspPanel` lays it out: the whole
 * chain's bar across the card — the rail's pin, the page's name and rate,
 * the chain's preset and the rack's switches — and under its hairline the
 * stages down the rail with one stage open beside it.
 *
 * The rail, the rack's switches and the stage are the page's own
 * components. The chain's bar is `DspChainPresetBar`'s markup, class for
 * class, around the same `RichPick`: the bar itself lists the reader's own
 * chains and favourites and reads their preset scope, which a picture must
 * not. A made-up rack plays: the Pop chain with its stages on, the
 * Maximizer open.
 */

const nothing = () => undefined;

/** Which stages read as on in the rail: the Pop chain's, and the Normalizer. */
const ENABLED: Record<TDspSection, boolean> = {
  normalizer: true,
  denoise: false,
  deEsser: true,
  exciter: true,
  bassForge: false,
  eq: true,
  footsteps: false,
  bassPunch: true,
  dimension: true,
  room: false,
  dynamics: true,
  maximizer: true,
  master: false,
  crossfade: false,
};

/** The rail at the width a new install opens it at (`RAIL_DEFAULT_WIDTH`). */
const RAIL: ILibraryRailWidth = {
  width: 236,
  isResizing: false,
  storageKey: 'help-dsp-rail',
  setWidth: nothing,
  setIsResizing: nothing,
};

const MAXIMIZER = { ...DSP_DEFAULTS.maximizer, enabled: true, driveDb: 4 };

/** The chain bar's four actions, as `DspChainPresetBar` writes them. */
const TRANSFER: readonly {
  icon: 'reset' | 'save' | 'share' | 'import';
  label: TranslationKey;
}[] = [
  { icon: 'reset', label: 'dsp.eqPreset.reset' },
  { icon: 'save', label: 'dsp.eqSave.save' },
  { icon: 'share', label: 'dsp.eqPreset.export' },
  { icon: 'import', label: 'dsp.eqPreset.import' },
];

function ChainBar() {
  const { t } = useTranslation();
  const pop = DSP_PRESETS.find((preset) => preset.id === 'pop');
  return (
    <div className="dsp-presets dsp-eq-bar">
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.wholeChain')}</span>
        <RichPick
          entries={DSP_PRESETS.filter((preset) =>
            ['pop', 'rock', 'jazz'].includes(preset.id),
          ).map((preset) => ({
            id: preset.id,
            name: t(preset.labelKey as TranslationKey),
            hint: '',
            group: '',
            icon: null,
          }))}
          groupLabel={() => ''}
          activeId={pop ? 'pop' : ''}
          onPick={nothing}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.presets')}
          triggerTitle={t('dsp.presets')}
        />
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.previous')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.next')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
        <button type="button" className="button small subtle genre-about">
          <InfoMark />
          <span className="genre-about__label">
            {t('genre.notes.aboutShort')}
          </span>
        </button>
      </div>
      <div className="dsp-eq-transfer dsp-chain-transfer">
        {TRANSFER.map(({ icon, label }) => (
          <button key={icon} type="button" className="button small subtle">
            <DspBarIcon name={icon} />
            {t(label)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DspOverviewDrawing() {
  const { t } = useTranslation();
  // The page's own rule: the chain's actions lose their words before the
  // bar would wrap, which a long language does at this width.
  const bar = useBarWords(t);
  return (
    <div className="dsp-studio">
      <header
        className={`dsp-header dsp-studio__bar${bar.showWords ? ' has-words' : ''}`}
        style={{ '--dsp-bar-lead': `${RAIL.width}px` } as CSSProperties}
      >
        <div className="dsp-header-line" ref={bar.lineRef}>
          <div className="dsp-studio__bar-lead">
            <StudioRailPin isPinned onPinnedChange={nothing} />
            <h2 className="dsp-title">
              {t('dsp.title')}
              <TitleRate rate={48000} />
            </h2>
          </div>
          <ChainBar />
          <DspRackSwitches
            isSystemWide={false}
            engineVersion={undefined}
            reportedGameMode={undefined}
            delay={undefined}
            allChannels
            isRoomOn={false}
            isRackEngaged
            isRackLive
            onToggleSurround={nothing}
            onTogglePower={nothing}
          />
        </div>
      </header>
      <StudioRailUnderBar rail={RAIL} isPinned>
        <DspSideTabs
          active="maximizer"
          onSelect={nothing}
          enabled={ENABLED}
          filtersDisabled={false}
          playbackDisabled={false}
        />
      </StudioRailUnderBar>
      <div className="dsp-panel dsp-studio__main">
        <div className="dsp-stage">
          <DspMaximizerCard
            maximizer={MAXIMIZER}
            onPatch={nothing}
            onCommit={nothing}
          />
        </div>
      </div>
    </div>
  );
}
