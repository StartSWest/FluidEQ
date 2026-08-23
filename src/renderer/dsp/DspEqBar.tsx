/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { fromApoText, toApoText } from '../../common/dsp/apoEqFormat';
import {
  DSP_DEFAULTS,
  EQ_ENGINES,
  EQ_MODELS,
  EQ_PHASE_MODES,
  EQ_RACK_SIZES,
  EQ_STEREO_MODES,
  OVERSAMPLE_FACTORS,
  IEqBandSettings,
  IEqSettings,
  TEqEngine,
  TEqModel,
  TEqPhase,
  TEqStereo,
  buildEqRack,
  eqEdited,
} from '../../common/dsp/chain';
import { rackMatchingCurveOf } from './rack';
import { linearPhaseLatencyMs } from './linearPhase';
import {
  EQ_DEFAULT_PRESET_ID,
  EQ_PRESETS,
  IEqPreset,
  eqPresetSetup,
  isCompleteEqPreset,
} from '../../common/dsp/eqPresets';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';
import SegmentedControl from '../widgets/SegmentedControl';
import DspEqImportDialog from './DspEqImportDialog';
import DspPresetSaveDialog from './DspPresetSaveDialog';
import { fromPresetFile, toPresetFile } from '../../common/dsp/presetFile';
import {
  IUserPreset,
  USER_PRESET_PREFIX,
  findUserPreset,
  readUserPresets,
  removeUserPreset,
  saveUserPreset,
} from './userPresets';

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
  const [isNaming, setIsNaming] = useState(false);
  /**
   * The saved list, held in state so saving one shows it at once.
   *
   * Read from storage rather than subscribed to: nothing else in the app
   * writes these, so there is no second writer to keep in step with.
   */
  const [userPresets, setUserPresets] = useState<IUserPreset[]>(() =>
    readUserPresets(),
  );

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

  /**
   * A preset is its curve AND the rack it was voiced on.
   *
   * Applying only the fifteen gains left the character, the topology and the
   * protective filters wherever the previous preset put them, so the same entry
   * sounded different depending on what had been auditioned before it — which
   * is the one thing a preset exists to rule out.
   */
  /**
   * The preset decides which bands react, and no band it is silent about does.
   *
   * The fit solves gains onto the CURRENT rack and carries everything else
   * about those bands across, so a de-esser left over from the last preset
   * survived into the next one and kept ducking a frequency the new curve
   * never asked about. A preset owns this the way it owns the character and
   * the topology: stated or reset, never inherited.
   *
   * Matched by frequency rather than by index, because the fitted rack is
   * whatever size the user chose and the preset's list is always fifteen. The
   * nearest band in log space is the one covering the same ground.
   */
  const withPresetDynamics = (
    fitted: readonly IEqBandSettings[],
    preset: IEqPreset,
  ): IEqBandSettings[] => {
    const cleared = fitted.map((one) => ({
      ...one,
      dynamic: false,
      thresholdDb: DSP_DEFAULTS.eq.bands[0].thresholdDb,
    }));
    preset.dynamic?.forEach((threshold, index) => {
      const wanted = DSP_DEFAULTS.eq.bands[index]?.frequency;
      if (threshold === null || threshold === undefined || !wanted) {
        return;
      }
      let nearest = 0;
      let closest = Infinity;
      cleared.forEach((one, at) => {
        const distance = Math.abs(Math.log2(one.frequency / wanted));
        if (distance < closest) {
          closest = distance;
          nearest = at;
        }
      });
      cleared[nearest] = {
        ...cleared[nearest],
        dynamic: true,
        thresholdDb: threshold,
      };
    });
    return cleared;
  };

  /**
   * A saved preset is assigned, not rebuilt.
   *
   * The factory curves are fifteen gains read onto whatever rack is loaded,
   * because that is what they are. A saved one is the rack itself — its band
   * count, its thresholds, its phase mode — so fitting it to the current
   * rack would hand back something subtly different from what was saved.
   */
  const applyUserPreset = (preset: IUserPreset) => {
    setNotice('');
    onChange({ ...preset.eq, enabled: eq.enabled, presetId: preset.id });
    onCommit();
  };

  const applyPreset = (id: string) => {
    if (id.startsWith(USER_PRESET_PREFIX)) {
      const saved = findUserPreset(id);
      if (saved) {
        applyUserPreset(saved);
      }
      return;
    }
    const chosen = EQ_PRESETS.find((one) => one.id === id);
    if (!chosen || !isCompleteEqPreset(chosen)) {
      return;
    }
    setNotice('');
    if (id === EQ_DEFAULT_PRESET_ID) {
      // Everything, and deliberately more than the other entries touch: the
      // rack size, the source curve and the preamp all move on an import, and a
      // reset that leaves those behind is the kind that reads as half-working.
      // The bypass switch is the user's, not the preset's.
      onChange({ ...DSP_DEFAULTS.eq, enabled: eq.enabled, presetId: id });
      onCommit();
      return;
    }
    // The presets are fifteen gains written against the fifteen-band rack, so
    // they are built there and then read onto whatever rack is loaded. The
    // alternative — snapping the rack back to fifteen — would throw away a
    // size the user chose on purpose every time they auditioned a preset.
    const asFifteen = DSP_DEFAULTS.eq.bands.map((band, index) => {
      // Absent for almost every preset, which is what a tone curve should be.
      const threshold = chosen.dynamic?.[index] ?? null;
      return {
        ...band,
        gainDb: chosen.gains[index],
        dynamic: threshold !== null,
        thresholdDb: threshold ?? band.thresholdDb,
      };
    });
    const setup = eqPresetSetup(chosen);
    onChange({
      ...eq,
      ...setup,
      presetId: id,
      // The preset's own fifteen are the reference, so moving to 31 bands
      // afterwards reads the preset at full detail rather than reading back
      // whatever the current rack could hold of it.
      sourceBands: asFifteen,
      // Fitted through the INCOMING character, not the outgoing one. The fit
      // solves for gains that reproduce the curve through a given filter shape,
      // so reading it through the shape being replaced misfits every band.
      bands: withPresetDynamics(
        rackMatchingCurveOf(eq.bands, asFifteen, sampleRate, setup.model),
        chosen,
      ),
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

  /**
   * The rack as a file somebody else can open.
   *
   * Separate from the APO export beside it, and both are worth having: APO
   * text is the universal way to publish a CURVE and every correction
   * database speaks it, but it cannot say that a band only acts above a
   * threshold, that the rack runs in parallel, or that the phase is linear.
   * This carries all of it.
   */
  const handleShare = () => {
    const saved = eq.presetId.startsWith(USER_PRESET_PREFIX)
      ? findUserPreset(eq.presetId)
      : undefined;
    const name = saved?.name ?? t('dsp.eqPreset.custom');
    const url = URL.createObjectURL(
      new Blob([toPresetFile(name, eq)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/[^\w\- ]+/g, '')}.fluideq.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = (name: string) => {
    const saved = saveUserPreset(name, eq);
    setUserPresets(readUserPresets());
    setIsNaming(false);
    // Selected straight away, so the picker agrees with what was just saved
    // rather than still showing whatever it was built from.
    onChange({ ...eq, presetId: saved.id });
    onCommit();
    setNotice(t('dsp.eqSave.saved', { name: saved.name }));
  };

  const handleDeletePreset = () => {
    const saved = findUserPreset(eq.presetId);
    if (!saved) {
      return;
    }
    removeUserPreset(saved.id);
    setUserPresets(readUserPresets());
    onChange({ ...eq, presetId: '' });
    onCommit();
    setNotice(t('dsp.eqSave.deleted', { name: saved.name }));
  };

  const handleImport = (text: string) => {
    /**
     * A shared preset first, then APO text.
     *
     * One door for both, because from the outside they are the same errand:
     * somebody has a file and wants this equaliser to be what is in it. The
     * JSON is recognised by its own `format` key and answers undefined for
     * anything else, so this costs a parse attempt and never a wrong guess.
     */
    const shared = fromPresetFile(text);
    if (shared) {
      const saved = saveUserPreset(shared.name, shared.eq);
      setUserPresets(readUserPresets());
      setIsImporting(false);
      applyUserPreset(saved);
      setNotice(t('dsp.eqSave.imported', { name: saved.name }));
      return;
    }
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
    });
    onCommit();
    const notes = [
      skipped > 0
        ? t('dsp.eqPreset.importSkipped', { count: bands.length, skipped })
        : t('dsp.eqPreset.imported', { count: bands.length }),
    ];
    if (preampDb !== 0) {
      // Deliberately NOT applied. A file's `Preamp` line and this rack's
      // regulator are the same quantity — room for the curve's own boosts —
      // and applying both counts it twice: a headphone correction asking for
      // -5.6 dB alongside a measured -5.7 arrived 11.3 dB quiet, which reads
      // as the import having killed the bass rather than as double headroom.
      //
      // The regulator wins because it measures THESE filters at THIS rate,
      // while the file's figure was computed by whoever published it, against
      // a rack that may not have been the one it ends up in.
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
      {/* First in the row, because it is what the rest of the row is a
          consequence of: every entry sets the character, the topology and the
          protective filters as well as the curve. */}
      <div className="dsp-eq-preset dsp-eq-preset-first">
        <span className="dsp-eq-preset-label">{t('dsp.eqPreset.label')}</span>
        <Dropdown
          name={t('dsp.eqPreset.label')}
          value={eq.presetId}
          isDisabled={false}
          noSelectionPlaceholder={t('dsp.eqPreset.custom')}
          // Twenty-two factory entries and however many saved ones is past
          // what anybody scans: typing two letters beats reading a list.
          isFilterable
          menuClassName="dsp-preset-menu"
          options={[
            // Saved ones first. They are the ones somebody made on purpose,
            // and a list that puts them under twenty-two factory curves is a
            // list that hides them.
            ...userPresets.map((one) => ({
              value: one.id,
              label: one.name,
              display: one.name,
            })),
            ...EQ_PRESETS.map((one) => ({
              value: one.id,
              label: t(one.labelKey as TranslationKey),
              display: t(one.labelKey as TranslationKey),
            })),
          ]}
          handleChange={applyPreset}
        />
      </div>

      {/* Everything that acts on the preset itself, next to the picker rather
          than by the import buttons: reset is the same control — "Default"
          chosen without opening the list — and save, share and delete all
          answer "what about this one". */}
      <div className="dsp-eq-transfer dsp-eq-reset">
        <button
          type="button"
          className="button small subtle"
          onClick={() => applyPreset(EQ_DEFAULT_PRESET_ID)}
        >
          {t('dsp.eqPreset.reset')}
        </button>
        <button
          type="button"
          className="button small subtle"
          title={t('dsp.eqSave.hint')}
          onClick={() => setIsNaming(true)}
        >
          {t('dsp.eqSave.save')}
        </button>
        <button
          type="button"
          className="button small subtle"
          title={t('dsp.eqShare.hint')}
          onClick={handleShare}
        >
          {t('dsp.eqShare.share')}
        </button>
        {/* Only for a saved one: there is nothing to delete about a factory
            curve, and a button that is present but refuses is worse than one
            that is not there. */}
        {eq.presetId.startsWith(USER_PRESET_PREFIX) && (
          <button
            type="button"
            className="button small subtle"
            onClick={handleDeletePreset}
          >
            {t('dsp.eqSave.delete')}
          </button>
        )}
      </div>

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
      <div className="dsp-eq-preset">
        <span className="dsp-eq-preset-label">{t('dsp.eqModel.label')}</span>
        <SegmentedControl
          name={t('dsp.eqModel.label')}
          value={eq.model}
          options={EQ_MODELS.map((model) => ({
            value: model,
            label: t(`dsp.eqModel.${model}` as TranslationKey),
          }))}
          onChange={(next: string) => {
            onChange(eqEdited(eq, { model: next as TEqModel }));
            onCommit();
          }}
        />
      </div>

      {/* Orthogonal to both of the others, which is why it is its own control
          rather than a third engine: it is the same topology given room. */}
      <div className="dsp-eq-preset">
        <span className="dsp-eq-preset-label">
          {t('dsp.eqOversample.label')}
        </span>
        <SegmentedControl
          name={t('dsp.eqOversample.label')}
          value={String(eq.oversample)}
          // Nothing to offer linear phase, and saying so is better than leaving
          // a live control that does nothing: oversampling exists to move a
          // band away from where the bilinear transform squeezes it, and an FIR
          // built from an impulse response has no bilinear transform in it.
          isDisabled={eq.phase === 'linear'}
          options={OVERSAMPLE_FACTORS.map((factor) => ({
            value: String(factor),
            label: factor === 1 ? t('dsp.eqOversample.off') : `${factor}x`,
          }))}
          onChange={(next: string) => {
            onChange(eqEdited(eq, { oversample: Number(next) }));
            onCommit();
          }}
        />
      </div>

      {/* Which part of the image the bands act on. Mid and side are the one
          thing a stereo equaliser cannot do at all. */}
      <div className="dsp-eq-preset">
        <span className="dsp-eq-preset-label">{t('dsp.eqStereo.label')}</span>
        <SegmentedControl
          name={t('dsp.eqStereo.label')}
          value={eq.stereo}
          options={EQ_STEREO_MODES.map((mode) => ({
            value: mode,
            label: t(`dsp.eqStereo.${mode}` as TranslationKey),
          }))}
          onChange={(next: string) => {
            onChange(eqEdited(eq, { stereo: next as TEqStereo }));
            onCommit();
          }}
        />
      </div>

      {/* A different question from the character: not what shape each band is,
          but how the bands are put against the audio. */}
      <div className="dsp-eq-preset">
        <span className="dsp-eq-preset-label">{t('dsp.eqEngine.label')}</span>
        <SegmentedControl
          name={t('dsp.eqEngine.label')}
          value={eq.engine}
          options={EQ_ENGINES.map((engine) => ({
            value: engine,
            label: t(`dsp.eqEngine.${engine}` as TranslationKey),
          }))}
          onChange={(next: string) => {
            onChange(eqEdited(eq, { engine: next as TEqEngine }));
            onCommit();
          }}
        />
      </div>

      {/* Beside the engine, because the two answer the same question at
          different depths: one is how the bands are put against the audio, this
          is whether they are allowed to shift its phase at all. */}
      <div className="dsp-eq-preset dsp-eq-model">
        <span className="dsp-eq-preset-label">{t('dsp.eqPhase.label')}</span>
        <Dropdown
          name={t('dsp.eqPhase.label')}
          value={eq.phase}
          isDisabled={false}
          options={EQ_PHASE_MODES.map((phase) => {
            // The delay is the entire cost of the mode, so it is named on the
            // option rather than discovered afterwards.
            const label =
              phase === 'linear'
                ? t('dsp.eqPhase.linearLatency', {
                    ms: linearPhaseLatencyMs(sampleRate),
                  })
                : t(`dsp.eqPhase.${phase}` as TranslationKey);
            return { value: phase, label, display: label };
          })}
          handleChange={(next: string) => {
            onChange(eqEdited(eq, { phase: next as TEqPhase }));
            onCommit();
          }}
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

      {isNaming && (
        <DspPresetSaveDialog
          existing={userPresets.map((one) => one.name)}
          onSave={handleSave}
          onClose={() => setIsNaming(false)}
        />
      )}
    </div>
  );
};

export default DspEqBar;
