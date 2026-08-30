/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { fromApoText } from '../../common/dsp/apoEqFormat';
import {
  EQ_ENGINES,
  EQ_MODELS,
  EQ_PHASE_MODES,
  EQ_RACK_SIZES,
  EQ_STEREO_MODES,
  OVERSAMPLE_FACTORS,
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
  eqSettingsForPreset,
  isCompleteEqPreset,
} from '../../common/dsp/eqPresets';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import VoicingIcon from '../icons/VoicingIcon';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import RichPick from '../widgets/RichPick';
import SegmentedControl from '../widgets/SegmentedControl';
import { eqPresetEntries, eqPresetGroupLabel } from './presetPickEntries';
import DspEqImportDialog from './DspEqImportDialog';
import DspBarIcon from './DspBarIcon';
import DspPresetSaveDialog from './DspPresetSaveDialog';
import { fromPresetFile, toPresetFile } from '../../common/dsp/presetFile';
import { exportEqPreset } from '../utils/equalizerApi';
import {
  IUserPreset,
  USER_PRESET_NAME_MAX,
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
  const [isRackMenuOpen, setIsRackMenuOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const rackMenuHolder = useRef<HTMLSpanElement>(null);
  /**
   * The saved list, held in state so saving one shows it at once.
   *
   * Read from storage rather than subscribed to: nothing else in the app
   * writes these, so there is no second writer to keep in step with.
   */
  const [userPresets, setUserPresets] = useState<IUserPreset[]>(() =>
    readUserPresets(),
  );

  // The menu is portalled out of the clipped DSP card, so its own surface has
  // to count as inside when deciding whether an outside click closes it.
  useEffect(() => {
    if (!isRackMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !rackMenuHolder.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsRackMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRackMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isRackMenuOpen]);

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

  /**
   * Every preset as the picker shows it: saved first, then group by group.
   *
   * Built once and read by both the menu and the arrows, because the two have
   * to agree about what "next" means. Two lists in two places is how a button
   * and a list end up disagreeing about the same order.
   */
  const entries = eqPresetEntries(userPresets, t);
  const ordered = entries.map((one) => one.id);

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
    // One deterministic state, including the canonical band shapes. The only
    // value retained from the previous rack is whether the processor is on.
    onChange(eqSettingsForPreset(eq, chosen));
    onCommit();
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
  /**
   * Step through the list without opening it.
   *
   * Auditioning presets is the one thing anybody does with this control
   * repeatedly, and doing it through a menu means open, aim, click, open,
   * aim, click. Wrapping rather than stopping at the ends: a list of forty
   * seven with a dead button at each end is a list somebody has to remember
   * their place in.
   *
   * A hand-made curve has no place in the order, so the first step from one
   * lands on the first entry rather than nowhere.
   */
  const step = (by: number) => {
    if (ordered.length === 0) {
      return;
    }
    const at = ordered.indexOf(eq.presetId);
    const next =
      at < 0
        ? ordered[by > 0 ? 0 : ordered.length - 1]
        : ordered[(at + by + ordered.length) % ordered.length];
    applyPreset(next);
  };

  const handleShare = async () => {
    const saved = eq.presetId.startsWith(USER_PRESET_PREFIX)
      ? findUserPreset(eq.presetId)
      : undefined;
    const name = saved?.name ?? t('dsp.eqPreset.custom');
    setNotice('');
    setIsSharing(true);
    try {
      const exported = await exportEqPreset(name, toPresetFile(name, eq));
      if (exported) {
        setNotice(t('dsp.eqShare.saved'));
      }
    } catch {
      setNotice(t('dsp.eqShare.failed'));
    } finally {
      setIsSharing(false);
    }
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
    const { bands, skipped } = fromApoText(text);
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
        {/* The same menu the Band tab's voicing pick opens, because it is the
            same errand: a long list where every entry needs a glyph, a name
            and a line saying what it does, searched by typing rather than
            scanned. What each side DOES with the chosen id is its own. */}
        <RichPick
          entries={entries}
          groupLabel={(group) => eqPresetGroupLabel(group, t)}
          activeId={eq.presetId}
          onPick={applyPreset}
          placeholder={t('dsp.eqPreset.custom')}
          placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
          triggerAriaLabel={t('dsp.eqPreset.label')}
          triggerTitle={t('dsp.eqPreset.label')}
        />
        {/* Either side of the field, pointing the way they move through the
            list, so auditioning is one click rather than open-aim-click. */}
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.previous')}
          title={t('dsp.eqPreset.previous')}
          onClick={() => step(-1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <button
          type="button"
          className="dsp-eq-step"
          aria-label={t('dsp.eqPreset.next')}
          title={t('dsp.eqPreset.next')}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>

      {/* Everything that acts on the preset itself, in one group beside the
          picker. Reset is the same control — "Default" chosen without opening
          the list — and save, share, import and delete all answer "what about
          this one". */}
      <div className="dsp-eq-transfer dsp-eq-reset">
        <button
          type="button"
          className="button small subtle"
          onClick={() => applyPreset(EQ_DEFAULT_PRESET_ID)}
        >
          <DspBarIcon name="reset" />
          {t('dsp.eqPreset.reset')}
        </button>
        <button
          type="button"
          className="button small subtle"
          title={t('dsp.eqSave.hint')}
          onClick={() => setIsNaming(true)}
        >
          <DspBarIcon name="save" />
          {t('dsp.eqSave.save')}
        </button>
        <button
          type="button"
          className="button small subtle dsp-eq-share"
          title={t('dsp.eqShare.hint')}
          onClick={handleShare}
          disabled={isSharing}
        >
          <DspBarIcon name="share" />
          {t('dsp.eqShare.share')}
        </button>
        {/* The other half of the same door as the button above it: one takes
            a rack out as a file and this brings one in, and it reads either a
            shared preset or a published APO curve. */}
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            setNotice('');
            setIsImporting(true);
          }}
        >
          <DspBarIcon name="import" />
          {t('dsp.eqPreset.import')}
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
            <DspBarIcon name="delete" />
            {t('dsp.eqSave.delete')}
          </button>
        )}
      </div>

      {/* The Bands page already solved this exact question: one quiet split
          picker that names the active layout and puts every alternative in an
          anchored menu. Reusing its classes keeps the same control looking and
          behaving the same in both equalizers. */}
      <span
        className={`dsp-eq-rack eq-mode is-subtle quick-layouts${
          isRackMenuOpen ? ' is-open' : ''
        }`}
        ref={rackMenuHolder}
      >
        <button
          type="button"
          className="button small subtle eq-mode__main"
          aria-label={t('dsp.eq.rack')}
          aria-expanded={isRackMenuOpen}
          aria-haspopup="menu"
          onClick={() => setIsRackMenuOpen((wasOpen) => !wasOpen)}
        >
          <MenuIcon name="layout" className="eq-toolbar__icon" />
          {t('eq.bandCount', { count: eq.bands.length })}
        </button>
        <button
          type="button"
          className="eq-mode__caret"
          aria-label={t('dsp.eq.rack')}
          aria-expanded={isRackMenuOpen}
          onClick={() => setIsRackMenuOpen((wasOpen) => !wasOpen)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6.5l4 4 4-4" />
          </svg>
        </button>
        <AnchoredMenu
          anchor={rackMenuHolder.current}
          isOpen={isRackMenuOpen}
          className="eq-mode__menu quick-layouts__menu"
          ariaLabel={t('dsp.eq.rack')}
        >
          {rackOptions
            .filter((size) => Number(size) !== eq.bands.length)
            .map((size) => (
              <button
                key={`${size}-band`}
                type="button"
                onClick={() => {
                  applyRack(size);
                  setIsRackMenuOpen(false);
                }}
              >
                <MenuIcon name="layout" className="eq-toolbar__icon" />
                <span className="eq-mode__menu-name">
                  {t('eq.bandCount', { count: Number(size) })}
                </span>
              </button>
            ))}
        </AnchoredMenu>
      </span>

      {/* One centred settings row, separate from the preset actions above. A
          wrapper makes the alignment explicit and prevents one setting from
          becoming a third header line when the toolbar gets tight. */}
      <div className="dsp-eq-settings">
        {/* The same curve through different machinery. First of the settings row
          because the character decides how every dial below is rendered rather
          than what it is set to. */}
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
        <div className="dsp-eq-preset">
          <span className="dsp-eq-preset-label">{t('dsp.eqPhase.label')}</span>
          <SegmentedControl
            name={t('dsp.eqPhase.label')}
            value={eq.phase}
            options={EQ_PHASE_MODES.map((phase) => ({
              value: phase,
              label: t(`dsp.eqPhase.${phase}` as TranslationKey),
              // The latency moved into the tooltip when this stopped being a
              // dropdown: "Lineal (+181 ms)" is twice the width of every other
              // segment on the row, and a row of segments that are not the same
              // size stops reading as one control.
              title:
                phase === 'linear'
                  ? t('dsp.eqPhase.linearLatency', {
                      ms: linearPhaseLatencyMs(sampleRate),
                    })
                  : undefined,
            }))}
            onChange={(next: string) => {
              onChange(eqEdited(eq, { phase: next as TEqPhase }));
              onCommit();
            }}
          />
        </div>
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
          titleKey="dsp.eqSave.title"
          hintKey="dsp.eqSave.hint"
          placeholderKey="dsp.eqSave.placeholder"
          nameMax={USER_PRESET_NAME_MAX}
          onSave={handleSave}
          onClose={() => setIsNaming(false)}
        />
      )}
    </div>
  );
};

export default DspEqBar;
