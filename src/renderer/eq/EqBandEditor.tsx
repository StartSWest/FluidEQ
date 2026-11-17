/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DEFAULT_QUALITY,
  FilterTypeEnum,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_NUM_FILTERS,
  MIN_QUALITY,
} from 'common/constants';
import Dropdown from '../widgets/Dropdown';
import Knob from '../widgets/Knob';
import Switch from '../widgets/Switch';
import TrashIcon from '../icons/TrashIcon';
import ConfirmIcon from '../icons/ConfirmIcon';
import { type TEqPageBands } from './useEqPageBands';
import { type TEqPageActions } from './useEqPageActions';

/**
 * The selected band's editor on the Your EQ tab: which band, its filter, its
 * frequency, gain and Q on dials, in or out of the chain, and the bin. Moved
 * out of the page's view as it stood; the page shows it beside the bands.
 */
const EqBandEditor = ({
  bands,
  actions,
}: {
  bands: TEqPageBands;
  actions: TEqPageActions;
}) => {
  const {
    t,
    bypassed,
    isBlockingError,
    filterOptions,
    frequencySortedFilters,
    selectedFilter,
    isSelectedGainDisabled,
    selectedFilters,
    selectedCount,
    isGroupEdit,
    isSelectionEnabled,
    updateSelectedGroup,
  } = bands;
  const {
    isDeleteArmed,
    setIsDeleteArmed,
    deleteCellRef,
    deleteLabel,
    deleteSelectedFilter,
    resetSelectedGain,
    setSelectedType,
    setFiltersEnabled,
  } = actions;
  const isEqOff = bypassed.includes('eq');
  // The column keeps its place with nothing selected, so the bands beside
  // it do not widen and narrow as a band is picked and let go; it says how
  // to fill it.
  if (!selectedFilter) {
    return (
      <div className="eq-flat-editor eq-flat-editor--strip is-empty">
        <p className="eq-flat-editor__empty">{t('eq.band.none')}</p>
      </div>
    );
  }
  return (
    <div
      className="eq-flat-editor eq-flat-editor--strip"
      inert={isEqOff || undefined}
    >
      {/* Which band, or how many. A group edit moves everything
        selected, so naming one frequency would be a lie about what
        the controls beside it are about to do. */}
      <div className="eq-flat-editor__identity">
        <span>{t('eq.selected')}</span>
        <strong>
          {(() => {
            if (isGroupEdit) {
              return t('eq.selectedCount', { count: selectedCount });
            }
            return selectedFilter.frequency >= 1000
              ? `${Number((selectedFilter.frequency / 1000).toFixed(1))} kHz`
              : `${selectedFilter.frequency} Hz`;
          })()}
        </strong>
      </div>
      <div className="eq-flat-editor__control eq-flat-editor__control--wide eq-flat-editor__control--filter">
        <span>{t('eq.filter')}</span>
        <Dropdown
          name="selected-band-filter-type"
          value={selectedFilter.type}
          options={filterOptions}
          isDisabled={isBlockingError}
          placement="up"
          handleChange={(newValue) =>
            setSelectedType(newValue as FilterTypeEnum)
          }
        />
      </div>
      {/* The one parameter a group cannot share.
        Gain and Q move by the same amount and the selection keeps its
        shape, but frequency is what tells the bands apart: nudging
        every one of them by the same number of hertz squeezes the top
        of the range flat and lets bands land on top of each other, and
        a single box cannot express what was actually wanted. Left
        visible rather than hidden so the row does not reshuffle, with
        the reason on the row itself. */}
      <div
        className="eq-flat-editor__control eq-flat-editor__control--centred eq-flat-editor__control--frequency"
        title={isGroupEdit ? t('eq.frequencyPerBand') : undefined}
      >
        <span>{t('eq.frequency')}</span>
        {/* A dial, like Q beside it. The knob reads a range that starts
          above zero as a ratio and sweeps it logarithmically, which is
          the only honest way to turn 1 Hz to 20 kHz with one hand: on
          an even sweep everything below 2 kHz — which is most of what
          a band is ever placed on — would sit inside a tenth of the
          travel. */}
        <Knob
          name={t('eq.frequency')}
          value={selectedFilter.frequency}
          min={MIN_FREQUENCY}
          max={MAX_FREQUENCY}
          sensitivity={0.2}
          isDisabled={isGroupEdit}
          // Whole hertz: what a band is stored as and what Equalizer APO
          // is written in.
          step={1}
          unit="Hz"
          handleChange={(newValue) =>
            updateSelectedGroup('frequency', newValue)
          }
        />
      </div>
      <div
        className="eq-flat-editor__control eq-flat-editor__control--centred eq-flat-editor__control--gain"
        // The gesture that replaced the reset button, said out loud:
        // Ctrl+click is invisible, and the button it stands in for was
        // the only thing announcing that a band could be put back.
        title={isSelectedGainDisabled ? undefined : t('eq.gainReset')}
      >
        <span>
          {isSelectedGainDisabled ? t('eq.gainDisabled') : t('eq.gain')}
        </span>
        {/* Band pass, notch, low pass and high pass have no gain
          parameter in Equalizer APO at all — they shape by frequency
          and Q alone. Showing the band's stale gain in a greyed-out
          box read as "this value is set but ignored", so the field is
          replaced by an explicit note instead. */}
        {isSelectedGainDisabled ? (
          <div className="eq-flat-editor__gain-na" title={t('eq.gainNaHint')}>
            {t('eq.setByQ')}
          </div>
        ) : (
          /* Bipolar, so the dial grows its arc from the centre and rests
           with the notch straight up at flat — a boost and a cut of the
           same size are mirror images of each other.

           The reset button that used to stand beside it is gone: it was
           the companion of a text box, which had no other way to say
           "back to flat", and beside a dial it was an unlabelled square
           parked between two circles. Its job moved onto the dial's own
           Ctrl+click, where every other dial in the app already keeps
           it — and got better in the move, because `onReset` flattens
           the whole selection absolutely instead of nudging it by the
           shown band's distance from zero. */
          <Knob
            name={t('eq.gain')}
            value={selectedFilter.gain}
            min={MIN_GAIN}
            max={MAX_GAIN}
            isDisabled={false}
            // The resolution the gain sliders already move in.
            step={0.01}
            unit="dB"
            defaultValue={0}
            onReset={resetSelectedGain}
            handleChange={(newValue) => updateSelectedGroup('gain', newValue)}
          />
        )}
      </div>
      <div className="eq-flat-editor__control eq-flat-editor__control--centred eq-flat-editor__control--quality">
        <span>{t('eq.quality')}</span>
        <Knob
          name={t('eq.quality')}
          value={selectedFilter.quality}
          min={MIN_QUALITY}
          max={MAX_QUALITY}
          isDisabled={false}
          step={0.01}
          unit="Q"
          // Ctrl+click puts the band back to the width every band
          // starts at.
          defaultValue={DEFAULT_QUALITY}
          handleChange={(newValue) => updateSelectedGroup('quality', newValue)}
        />
      </div>
      {/* In or out of the chain, without losing what the band was set
        to. Next to Delete because the two are the same kind of thing —
        what happens to the band itself, rather than what shape it has
        — and in that order because this is the reversible one.

        A mixed selection reads as on and switches everything off, which
        is the only reading that makes the second press undo the first.
        Deriving it per band would make the control mean "flip each of
        these", and a switch nobody can predict the result of is worse
        than no switch. */}
      <div
        className="eq-flat-editor__control eq-flat-editor__control--centred eq-flat-editor__control--active"
        title={t('eq.active')}
      >
        <span>{t('eq.active')}</span>
        <div className="eq-flat-editor__switch">
          <Switch
            id="selected-band-enabled"
            ariaLabel={
              isGroupEdit
                ? t('eq.activeGroupAria', { count: selectedCount })
                : t('eq.activeAria')
            }
            isOn={isSelectionEnabled}
            isDisabled={isBlockingError}
            handleToggle={() =>
              setFiltersEnabled(selectedFilters, !isSelectionEnabled)
            }
          />
        </div>
      </div>
      {/* A bin and nothing else (Ivan, 2026-09-26: "delete band make a
        icon only"): beside the dials a worded button was the widest
        thing in the row for the control used least. The title is what
        says what it does — the full sentence, armed or not. */}
      <div className="eq-flat-editor__delete-cell" ref={deleteCellRef}>
        <button
          type="button"
          aria-label={deleteLabel}
          title={deleteLabel}
          className={`eq-flat-editor__delete${
            isDeleteArmed ? ' is-armed' : ''
          }`}
          disabled={frequencySortedFilters.length <= MIN_NUM_FILTERS}
          // Arms rather than deletes. There is no undo anywhere in this
          // app, and this button sits one control along from the on/off
          // switch it is easiest to have meant instead.
          onClick={() => {
            if (isDeleteArmed) {
              setIsDeleteArmed(false);
              deleteSelectedFilter();
              return;
            }
            setIsDeleteArmed(true);
          }}
        >
          {/* `currentColor` so it dims with the button when there is
            only one band left and deleting is not allowed. */}
          <TrashIcon
            className="eq-flat-editor__delete-icon"
            fill="currentColor"
          />
        </button>
        {/* The way out, said rather than implied. Pressing elsewhere and
          Escape both stand the button down, but neither is on screen,
          and a control that has turned red with no visible way back is
          a control people press again to find out. */}
        {isDeleteArmed && (
          <button
            type="button"
            className="eq-flat-editor__keep"
            aria-label={t('eq.delete.keepAria')}
            title={t('eq.delete.keepAria')}
            onClick={() => setIsDeleteArmed(false)}
          >
            <span className="eq-flat-editor__keep-icon">
              <ConfirmIcon variant="cancel" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default EqBandEditor;
