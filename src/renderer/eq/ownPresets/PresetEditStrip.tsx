/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { openPresetEditPage, type TPresetEditPage } from './presetEditPages';
import { canAddDraftBand } from './presetEditBands';
import { addDraftBand, usePresetEditSession } from './presetEditSession';
import usePresetEditActions from './usePresetEditActions';

const PARTS: ReadonlyArray<{
  page: TPresetEditPage;
  icon: 'eqBars' | 'configure';
  label: 'eq.own.curve' | 'eq.own.rack';
}> = [
  { page: 'eq', icon: 'eqBars', label: 'eq.own.curve' },
  { page: 'dsp', icon: 'configure', label: 'eq.own.rack' },
];

/**
 * What stands where the EQ page's tab row stood, and over the DSP page,
 * while one of the listener's presets is open (Ivan, 2026-11-20, own
 * presets, Direction A): which preset, its two parts — the curve on the EQ
 * page, the rack on the DSP page — and Discard and Save, either page. The
 * part lit is the page it stands on; the other is the way there.
 */
const PresetEditStrip = ({ page }: { page: TPresetEditPage }) => {
  const { t } = useTranslation();
  const session = usePresetEditSession();
  const { discard, save, isBusy } = usePresetEditActions();
  if (!session) {
    return null;
  }
  return (
    <div
      className="own-preset-strip"
      role="region"
      aria-label={t('eq.own.editing')}
    >
      <div className="own-preset-strip__who">
        <span className="own-preset-strip__swatch" aria-hidden="true" />
        <span className="own-preset-strip__editing">{t('eq.own.editing')}</span>
        <strong title={session.name}>{session.name}</strong>
      </div>
      <div
        className="segmented own-preset-strip__parts"
        role="group"
        aria-label={t('eq.own.parts')}
      >
        {PARTS.map((part) => (
          <button
            key={part.page}
            type="button"
            className={`segmented__option${
              part.page === page ? ' is-selected' : ''
            }`}
            aria-pressed={part.page === page}
            onClick={() => openPresetEditPage(part.page)}
          >
            <MenuIcon name={part.icon} className="own-preset-strip__icon" />
            <span>{t(part.label)}</span>
          </button>
        ))}
      </div>
      {/* The curve's own tool, on the page where the curve is. */}
      {page === 'eq' && (
        <button
          type="button"
          className="button small subtle own-preset-strip__add"
          disabled={!canAddDraftBand(session.bands)}
          title={t('eq.addBandAria')}
          onClick={addDraftBand}
        >
          <MenuIcon name="plus" className="own-preset-strip__icon" />
          <span>{t('eq.own.addBand')}</span>
        </button>
      )}
      {/* Whether there is anything to keep, with the two answers to it: one
          group, so a narrow row wraps them together, at its end. */}
      <div className="own-preset-strip__actions">
        {session.isDirty && (
          <span className="own-preset-strip__unsaved" role="status">
            {t('eq.own.unsaved')}
          </span>
        )}
        <button
          type="button"
          className="button small subtle"
          disabled={isBusy}
          onClick={() => {
            discard().catch(() => undefined);
          }}
        >
          {t('eq.own.discard')}
        </button>
        <button
          type="button"
          className="button small"
          disabled={isBusy}
          onClick={() => {
            save().catch(() => undefined);
          }}
        >
          <MenuIcon name="save" className="own-preset-strip__icon" />
          <span>{t('eq.own.save')}</span>
        </button>
      </div>
    </div>
  );
};

export default PresetEditStrip;
