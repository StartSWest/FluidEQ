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
import { CSSProperties, useEffect, useRef } from 'react';
import Dropdown from '../widgets/Dropdown';
import Knob from '../widgets/Knob';
import Switch from '../widgets/Switch';
import TrashIcon from '../icons/TrashIcon';
import ConfirmIcon from '../icons/ConfirmIcon';
import { type TEqPageBands } from './useEqPageBands';
import { type TEqPageActions } from './useEqPageActions';
import useBandPopoverPlace from './useBandPopoverPlace';
import frequencyText from '../utils/frequencyText';

/**
 * The selected band's settings, in a popover on its slider (Ivan,
 * 2026-11-16: "el 4, el pop over" — option 4 of the board): which band and
 * its filter with the way out at its head, its frequency, gain and Q on
 * dials, then in or out of the chain and the bin. It opens when a band is
 * selected and goes with the selection: a press elsewhere, Escape (the
 * panel's, `EqPageView`) or its own close empty it. Placed beside the
 * handle, never over it (`useBandPopoverPlace`), and in the panel's own
 * markup rather than portalled, so the keyboard reaches it after the tab row
 * and before the sliders.
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
    setSelectedFilterIds,
  } = bands;
  const {
    isDeleteArmed,
    setIsDeleteArmed,
    deleteCellRef,
    deleteLabel,
    deleteSelectedFilter,
    resetSelectedGain,
    layoutDefaults,
    resetBandFrequency,
    resetSelectedQuality,
    setSelectedType,
    setFiltersEnabled,
  } = actions;
  const isEqOff = bypassed.includes('eq');
  const popover = useRef<HTMLDivElement>(null);
  const place = useBandPopoverPlace(
    popover,
    selectedFilter?.id,
    `${selectedFilter?.gain}|${selectedFilter?.frequency}|${frequencySortedFilters.length}`,
  );
  const at = frequencySortedFilters.findIndex(
    ({ id }) => id === selectedFilter?.id,
  );
  /**
   * The band beside the selected one, low to high, selected in its place —
   * the popover moves to it — and brought into view where the row scrolls.
   * Stops at either end rather than wrapping round: Tab past the last band
   * goes on to the next control, so the keyboard is never held in here.
   */
  const step = (by: -1 | 1) => {
    const target = frequencySortedFilters[at + by];
    if (at < 0 || !target) {
      return false;
    }
    setSelectedFilterIds([target.id]);
    popover.current?.offsetParent
      ?.querySelector(`.bandWrapper[data-filter-id="${CSS.escape(target.id)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  };
  const stepRef = useRef(step);
  stepRef.current = step;
  // Tab and Shift+Tab inside the popover go to the next and the previous
  // band (Ivan, 2026-11-16: "Tab changes to the next band"), the focus
  // staying on the control it was on, now the next band's. Not while the
  // filter list is open: its keys are its own.
  useEffect(() => {
    const element = popover.current;
    if (!element) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Tab' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target as HTMLElement | null)?.closest?.('.dropdown--open')
      ) {
        return;
      }
      if (stepRef.current(event.shiftKey ? -1 : 1)) {
        event.preventDefault();
      }
    };
    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [selectedFilter?.id]);
  if (!selectedFilter) {
    return null;
  }
  const index = at + 1;
  return (
    <div
      ref={popover}
      className={`eq-flat-editor eq-flat-editor--popover is-${
        place?.side ?? 'right'
      }`}
      role="dialog"
      aria-label={
        isGroupEdit
          ? t('eq.selectedCount', { count: selectedCount })
          : t('eq.popover.title', {
              index,
              frequency: frequencyText(selectedFilter.frequency),
            })
      }
      inert={isEqOff || undefined}
      style={
        place
          ? ({
              left: place.left,
              top: place.top,
              '--popover-arrow': `${place.arrow}px`,
              '--popover-reach': `${place.reach}px`,
            } as CSSProperties)
          : { visibility: 'hidden' }
      }
    >
      {/* Which band, or how many — a group edit moves everything selected,
        so naming one frequency would be a lie about what the dials are
        about to do — its filter, and the way out. */}
      <div className="eq-band-popover__head">
        {/* The band before and after it, low to high: the popover stands
          over neighbours, and these reach them (Ivan, 2026-11-16). */}
        <button
          type="button"
          className="eq-band-popover__step"
          aria-label={t('eq.popover.previous')}
          title={t('eq.popover.previous')}
          disabled={at <= 0}
          onClick={() => step(-1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M10 3.5l-4 4.5 4 4.5" />
          </svg>
        </button>
        <strong className="eq-band-popover__title">
          {isGroupEdit
            ? t('eq.selectedCount', { count: selectedCount })
            : t('eq.popover.title', {
                index,
                frequency: frequencyText(selectedFilter.frequency),
              })}
        </strong>
        <button
          type="button"
          className="eq-band-popover__step"
          aria-label={t('eq.popover.next')}
          title={t('eq.popover.next')}
          disabled={at >= frequencySortedFilters.length - 1}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M6 3.5l4 4.5-4 4.5" />
          </svg>
        </button>
        <div className="eq-band-popover__filter" title={t('eq.filter')}>
          <Dropdown
            name="selected-band-filter-type"
            value={selectedFilter.type}
            options={filterOptions}
            isDisabled={isBlockingError}
            placement="down"
            handleChange={(newValue) =>
              setSelectedType(newValue as FilterTypeEnum)
            }
          />
        </div>
        <button
          type="button"
          className="eq-band-popover__close"
          aria-label={t('eq.popover.close')}
          title={t('eq.popover.close')}
          onClick={() => setSelectedFilterIds([])}
        >
          <ConfirmIcon variant="cancel" />
        </button>
      </div>
      <div className="eq-band-popover__dials">
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
            // Ctrl+click or a double-click: back to the frequency the band
            // layout gave it. A band Add band made has none, and keeps its own.
            onReset={
              layoutDefaults.get(selectedFilter.id)?.frequency === undefined
                ? undefined
                : () => resetBandFrequency(selectedFilter.id)
            }
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
            // Ctrl+click or a double-click puts every selected band back to
            // its layout's Q, each its own (`bandLayoutDefaults.ts`); it was
            // one fixed width whatever the layout.
            defaultValue={
              layoutDefaults.get(selectedFilter.id)?.quality ?? DEFAULT_QUALITY
            }
            onReset={() => {
              resetSelectedQuality().catch(() => undefined);
            }}
            handleChange={(newValue) =>
              updateSelectedGroup('quality', newValue)
            }
          />
        </div>
      </div>
      <div className="eq-band-popover__foot">
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
    </div>
  );
};

export default EqBandEditor;
