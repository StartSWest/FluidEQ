/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import { fromApoText, toApoText } from '../../common/dsp/apoEqFormat';
import { IEqSettings } from '../../common/dsp/chain';
import { EQ_PRESETS, isCompleteEqPreset } from '../../common/dsp/eqPresets';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';

interface IDspEqBarProps {
  eq: IEqSettings;
  onChange: (next: IEqSettings) => void;
  onCommit: () => void;
}

/**
 * The equaliser's toolbar: the preset, and the two ways a curve gets in or out.
 *
 * Lives in the card's header rather than above the graph, and that is the whole
 * reason it is its own component. The EQ page has no description line, so the
 * header was an empty band with the bypass switch stranded at the far right of
 * it — a strip of nothing wide enough to look like a bug, which is exactly how
 * it was reported. Putting this in the header fills that row with the controls
 * that were sitting underneath it, and the page starts at the graph.
 */
const DspEqBar = ({ eq, onChange, onCommit }: IDspEqBarProps) => {
  const { t } = useTranslation();
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const applyPreset = (id: string) => {
    const chosen = EQ_PRESETS.find((one) => one.id === id);
    if (!chosen || !isCompleteEqPreset(chosen)) {
      return;
    }
    // Whatever the last import had to say was about a curve this replaces.
    setNotice('');
    onChange({
      ...eq,
      presetId: id,
      // Gains only. A preset that also reset frequency, Q and shape would
      // silently throw away a band the user had moved somewhere on purpose.
      bands: eq.bands.map((one, index) => ({
        ...one,
        gainDb: chosen.gains[index],
      })),
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

  const handleImport = (file: File | undefined) => {
    if (!file) {
      return;
    }
    // Cleared first: the previous file's verdict standing beside a new one is
    // read as this file's.
    setNotice('');
    file
      .text()
      .then((text) => {
        const { bands, preampDb, skipped } = fromApoText(text);
        if (!bands.length) {
          // Says nothing was read rather than nothing at all. The likeliest
          // reason is that this is not a ParametricEQ file, and silence from a
          // button that was just pressed reads as a bug.
          setNotice(t('dsp.eqPreset.importEmpty'));
          return false;
        }
        onChange({
          ...eq,
          // An imported curve is nobody's preset, whatever it was made from.
          presetId: '',
          // Bands the file did not reach are switched off rather than left
          // holding whatever the previous curve had in them — otherwise a
          // four-filter import inherits eleven bands nobody asked for.
          bands: eq.bands.map((one, index) =>
            index < bands.length ? bands[index] : { ...one, enabled: false },
          ),
        });
        onCommit();
        const notes = [
          skipped > 0
            ? t('dsp.eqPreset.importSkipped', {
                count: bands.length,
                skipped,
              })
            : t('dsp.eqPreset.imported', { count: bands.length }),
        ];
        // This equaliser has no preamp of its own, so a file asking for one
        // loses it. Saying so beats letting the curve come out louder than
        // whoever published it intended.
        if (preampDb !== 0) {
          notes.push(t('dsp.eqPreset.importPreamp', { gain: preampDb }));
        }
        setNotice(notes.join(' '));
        return true;
      })
      .catch(() => setNotice(t('dsp.eqPreset.importFailed')));
  };

  return (
    <div className="dsp-eq-bar">
      {/* The label sits BESIDE the field, not stacked over it. Above it, the
          pair was two rows tall in a row that is one control high, and the
          header grew to fit a word. */}
      <div className="dsp-eq-preset">
        <span className="dsp-eq-preset-label" id="dsp-eq-preset-label">
          {t('dsp.eqPreset.label')}
        </span>
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
          onClick={() => fileRef.current?.click()}
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

      <input
        ref={fileRef}
        type="file"
        accept=".txt,text/plain"
        hidden
        onChange={(event) => {
          handleImport(event.target.files?.[0]);
          // Cleared so choosing the same file twice fires again — without
          // this, re-importing a file the user has just edited does nothing.
          event.target.value = '';
        }}
      />

      {notice !== '' && (
        <p className="dsp-eq-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
};

export default DspEqBar;
