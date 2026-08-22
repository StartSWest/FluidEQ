/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { fromApoText, toApoText } from '../../common/dsp/apoEqFormat';
import {
  DSP_DEFAULTS,
  EQ_MODELS,
  EQ_RACK_SIZES,
  IEqSettings,
  TEqModel,
  buildEqRack,
} from '../../common/dsp/chain';
import { rackMatchingCurveOf } from './rack';
import { EQ_PRESETS, isCompleteEqPreset } from '../../common/dsp/eqPresets';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';
import DspEqImportDialog from './DspEqImportDialog';

interface IDspEqBarProps {
  eq: IEqSettings;
  /** The fit is done against real filter responses, which are rate-dependent. */
  sampleRate: number;
  onChange: (next: IEqSettings) => void;
  onCommit: () => void;
}

/**
 * The equaliser's toolbar: the rack size, the preset, and the way curves get
 * in and out.
 *
 * Lives in the card's header rather than above the graph, and that is the whole
 * reason it is its own component. The EQ page has no description line, so the
 * header was an empty band with the bypass switch stranded at the far right of
 * it — a strip of nothing wide enough to look like a bug, which is exactly how
 * it was reported.
 */
const DspEqBar = ({ eq, sampleRate, onChange, onCommit }: IDspEqBarProps) => {
  const { t } = useTranslation();
  const [notice, setNotice] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  /**
   * A different resolution of the same curve, not a different curve.
   *
   * Read from `sourceBands` and NOT from the live rack. Resampling the rack
   * each time compounds its own loss — ten bands read down to six and back up
   * to thirty-one cannot recover what the six could not hold — so a trip
   * through a smaller size used to flatten an imported curve for good. Coming
   * back to the size it arrived at now returns the curve that arrived.
   */
  const applyRack = (size: string) => {
    const count = Number(size);
    if (!Number.isFinite(count) || count === eq.bands.length) {
      return;
    }
    setNotice('');
    const source = eq.sourceBands.length > 0 ? eq.sourceBands : eq.bands;
    onChange({
      ...eq,
      // Untouched: the rack size is a resolution, not an edit, so the curve
      // somebody authored stays the reference for every later size.
      sourceBands: source,
      bands: rackMatchingCurveOf(
        buildEqRack(count),
        source,
        sampleRate,
        eq.model,
      ),
    });
    onCommit();
  };

  const applyPreset = (id: string) => {
    const chosen = EQ_PRESETS.find((one) => one.id === id);
    if (!chosen || !isCompleteEqPreset(chosen)) {
      return;
    }
    setNotice('');
    // The presets are fifteen gains written against the fifteen-band rack, so
    // they are built there and then read onto whatever rack is loaded. The
    // alternative — snapping the rack back to fifteen — would throw away a
    // size the user chose on purpose every time they auditioned a preset.
    const asFifteen = DSP_DEFAULTS.eq.bands.map((band, index) => ({
      ...band,
      gainDb: chosen.gains[index],
    }));
    onChange({
      ...eq,
      presetId: id,
      // The preset's own fifteen are the reference, so moving to 31 bands
      // afterwards reads the preset at full detail rather than reading back
      // whatever the current rack could hold of it.
      sourceBands: asFifteen,
      bands: rackMatchingCurveOf(eq.bands, asFifteen, sampleRate, eq.model),
    });
    onCommit();
  };

  /**
   * Written as Equalizer APO's ParametricEQ text, which is what AutoEq,
   * oratory1990 and every headphone correction database publishes in — so a
   * curve made here pastes into `config.txt` and behaves identically.
   *
   * A blob and an anchor rather than an IPC round trip: this is a few hundred
   * bytes the renderer already has in hand, and routing it through main would
   * add a channel and a handler to something the platform does in three lines.
   */
  const handleExport = () => {
    const url = URL.createObjectURL(
      new Blob([toApoText(eq)], { type: 'text/plain' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fluideq-eq.txt';
    link.click();
    // The blob is held alive by the URL until it is let go, and a session of
    // exporting would keep every one of them.
    URL.revokeObjectURL(url);
  };

  const handleImport = (text: string) => {
    const { bands, preampDb, skipped } = fromApoText(text);
    if (!bands.length) {
      // Says nothing was read rather than nothing at all. The likeliest reason
      // is that this is not a ParametricEQ file, and silence from a button
      // that was just pressed reads as a bug.
      setNotice(t('dsp.eqPreset.importEmpty'));
      return;
    }
    setIsImporting(false);
    onChange({
      ...eq,
      // An imported curve is nobody's preset, whatever it was made from.
      presetId: '',
      // The file decides the rack size. Padding it out to fifteen left silent
      // bands behind, and cutting it to fifteen threw away filters the author
      // put there.
      bands,
      // The published curve is the reference from here on, so every rack size
      // is read from the file rather than from the last size that was on
      // screen.
      sourceBands: bands,
      preampDb,
    });
    onCommit();
    const notes = [
      skipped > 0
        ? t('dsp.eqPreset.importSkipped', { count: bands.length, skipped })
        : t('dsp.eqPreset.imported', { count: bands.length }),
    ];
    if (preampDb !== 0) {
      notes.push(t('dsp.eqPreset.importPreamp', { gain: preampDb }));
    }
    setNotice(notes.join(' '));
  };

  // Whatever an import left behind, so a rack of ten reads as ten rather than
  // as the picker having lost its value.
  const rackOptions = EQ_RACK_SIZES.map(String).includes(
    String(eq.bands.length),
  )
    ? EQ_RACK_SIZES.map(String)
    : [...EQ_RACK_SIZES.map(String), String(eq.bands.length)].sort(
        (a, b) => Number(a) - Number(b),
      );

  return (
    <div className="dsp-eq-bar">
      {/* Labels sit BESIDE their fields, not stacked over them. Above, each
          pair stood two rows tall inside a row that is one control high, and
          the header grew a band of empty space to fit a word. */}
      <div className="dsp-eq-preset dsp-eq-rack">
        <span className="dsp-eq-preset-label">{t('dsp.eq.rack')}</span>
        <Dropdown
          name={t('dsp.eq.rack')}
          value={String(eq.bands.length)}
          isDisabled={false}
          options={rackOptions.map((size) => ({
            value: size,
            label: size,
            display: size,
          }))}
          handleChange={applyRack}
        />
      </div>

      {/* The same curve through different machinery. Sits beside the rack size
          because both change how the dials below are rendered rather than what
          they are set to. */}
      <div className="dsp-eq-preset dsp-eq-model">
        <span className="dsp-eq-preset-label">{t('dsp.eqModel.label')}</span>
        <Dropdown
          name={t('dsp.eqModel.label')}
          value={eq.model}
          isDisabled={false}
          options={EQ_MODELS.map((model) => ({
            value: model,
            label: t(`dsp.eqModel.${model}` as TranslationKey),
            display: t(`dsp.eqModel.${model}` as TranslationKey),
          }))}
          handleChange={(next: string) => {
            onChange({ ...eq, model: next as TEqModel });
            onCommit();
          }}
        />
      </div>

      <div className="dsp-eq-preset">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <Dropdown
          name={t('dsp.eqPreset.label')}
          value={eq.presetId}
          isDisabled={false}
          noSelectionPlaceholder={t('dsp.eqPreset.custom')}
          options={EQ_PRESETS.map((one) => ({
            value: one.id,
            label: t(one.labelKey as TranslationKey),
            display: t(one.labelKey as TranslationKey),
          }))}
          handleChange={applyPreset}
        />
      </div>

      {/* Both quiet: neither is the recommended action, they are the two
          halves of the same door. */}
      <div className="dsp-eq-transfer">
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            setNotice('');
            setIsImporting(true);
          }}
        >
          {t('dsp.eqPreset.import')}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={handleExport}
        >
          {t('dsp.eqPreset.export')}
        </button>
      </div>

      {notice !== '' && (
        <p className="dsp-eq-notice" role="status">
          {notice}
        </p>
      )}

      {isImporting && (
        <DspEqImportDialog
          onImport={handleImport}
          onClose={() => setIsImporting(false)}
        />
      )}
    </div>
  );
};

export default DspEqBar;
