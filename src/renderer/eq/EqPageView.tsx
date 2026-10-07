/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  DEFAULT_QUALITY,
  FilterTypeEnum,
  IFilter,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_NUM_FILTERS,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_NUM_FILTERS,
  MIN_QUALITY,
} from 'common/constants';
import { CSSProperties } from 'react';
import Spinner from '../icons/Spinner';
import BandMenu from '../components/BandMenu';
import OutputRate from '../components/OutputRate';
import OutputEditingNotice from '../OutputEditingNotice';
import VoicingQuickPick from '../components/VoicingQuickPick';
import Button from '../widgets/Button';
import {
  isContinuousMode,
  setSmartEqMode,
  SMART_EQ_MODES,
} from '../utils/smartEqMode';
import { setContinuousEq } from '../utils/continuousEq';
import {
  cancelSmartEq,
  endSmartEqStatus,
  runSmartEq,
} from '../utils/smartEqRun';
import MenuIcon from '../icons/MenuIcon';
import Chevron from '../icons/Chevron';
import AnchoredMenu from '../widgets/AnchoredMenu';
import { PetArt } from '../SupportPet';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { endCorrectionFlash } from '../utils/correctionFlash';
import SongEqSaveSwitch from '../components/SongEqSaveSwitch';
import EqPageModeSelect from '../components/eqMode/EqPageModeSelect';
import BandLayoutMenu from '../components/BandLayoutMenu';
import CurvesPicker from '../components/CurvesPicker';
import ClearEqButton from '../components/ClearEqButton';
import BandLevels from '../components/BandLevels';
import { attachRail } from './bandsRail';
import OverflowArrow from '../components/OverflowArrow';
import FrequencyBand from '../components/FrequencyBand';
import { EQ_SCALE_MARKS, eqScaleLabel, eqScaleMarkClass } from './eqScaleMarks';
import Dropdown from '../widgets/Dropdown';
import Knob from '../widgets/Knob';
import Switch from '../widgets/Switch';
import TrashIcon from '../icons/TrashIcon';
import ConfirmIcon from '../icons/ConfirmIcon';
import EqCutKnob from './EqCutKnob';
import { TONE_CONTROLS } from './useTone';
import { TONE_MAX_DB } from '../../common/tone';
import { type TEqPageBands } from './useEqPageBands';
import { type TEqPageActions } from './useEqPageActions';

type TEqPageViewProps = {
  bands: TEqPageBands;
  actions: TEqPageActions;
};

/**
 * The EQ page's markup: its heading and toolbar, the band rail with its
 * scale, sliders and menus, the band editor or the Tone row under it, and
 * the notices. Holds no state and runs no hooks; everything it shows comes
 * from the bands and the actions.
 */
const EqPageView = ({ bands, actions }: TEqPageViewProps) => {
  const {
    filters,
    isLoading,
    isBlockingError,
    selectedFilterIds,
    hoveredFilterId,
    bypassed,
    t,
    filterOptions,
    isTitleInHead,
    placeTitle,
    isBalancing,
    balanceStatus,
    isContinuousOn,
    smartEqMode,
    isModeMenuOpen,
    setIsModeMenuOpen,
    modeMenuHolder,
    modeMenuTrigger,
    attachModeMenuEntry,
    closeModeMenu,
    isContinuousRunning,
    correctionFlash,
    bubbleText,
    bubbleRef,
    bubbleSpot,
    modeLabel,
    modeNote,
    frequencySortedFilters,
    density,
    bandLayout,
    selectedFilter,
    isSelectedGainDisabled,
    selectedFilters,
    selectedCount,
    isGroupEdit,
    isSelectionEnabled,
    bandsElement,
    attachBands,
    canScrollBands,
    isPlaced,
    selectionBox,
    updateSelectedGroup,
    handleBandGainChange,
    handleBandGainPreview,
    handleBandSelect,
    handleBandHover,
  } = bands;
  const {
    handleBandsPointerDown,
    handleBandsPointerMove,
    finishBandSelection,
    isDeleteArmed,
    setIsDeleteArmed,
    deleteCellRef,
    deleteLabel,
    deleteSelectedFilter,
    resetSelectedGain,
    tone,
    isToneDisabled,
    turnTone,
    resetTone,
    setSelectedType,
    addFilter,
    addFilterBeside,
    setFiltersEnabled,
    resetFilters,
    bandMenu,
    setBandMenu,
  } = actions;
  const bandMenuFilter = bandMenu ? filters[bandMenu.filterId] : undefined;
  // The EQ layer switched off from its chip: the bands stay where they are
  // and edit nothing until it is back on.
  const isEqOff = bypassed.includes('eq');
  // An enabled continuous mode still needs a Stop while its layer is
  // bypassed, or restoring the layer could silently resume a forgotten run.
  const isSmartEqActive =
    isBalancing || (isContinuousMode(smartEqMode) && isContinuousOn);
  // The bands the menu acts on: the whole selection when the clicked band is
  // in it, otherwise just the clicked band.
  let bandMenuFilters: IFilter[] = [];
  if (bandMenuFilter) {
    bandMenuFilters = selectedFilterIds.includes(bandMenuFilter.id)
      ? selectedFilterIds.map((id) => filters[id]).filter(Boolean)
      : [bandMenuFilter];
  }

  return isLoading ? (
    <div className="center full row">
      <Spinner />
    </div>
  ) : (
    <>
      {bandMenu && bandMenuFilter && (
        // Keyed on where it was asked for, so a right-click on the same band
        // somewhere else closes this one and opens a fresh one there rather
        // than leaving the old one where it was.
        <BandMenu
          key={`${bandMenu.filterId}:${bandMenu.x}:${bandMenu.y}`}
          filter={bandMenuFilter}
          filters={bandMenuFilters}
          x={bandMenu.x}
          y={bandMenu.y}
          onReset={resetFilters}
          onSetEnabled={setFiltersEnabled}
          onAddBeside={addFilterBeside}
          onClose={() => setBandMenu(undefined)}
        />
      )}
      {placeTitle(
        // One row: the page's name and rate on the left, its tools on the
        // right, the path's delay among them (Ivan, 2026-09-27: "Parametric
        // EQ title back on the left of the EQ toolbar row"). The applied
        // layers are the "Curves" dropdown at the end of the section pills'
        // line (`CurvesPicker`), so the row that listed them is gone and the
        // curve has its height. Above the graph the eyebrow goes too.
        <div
          className={`main-content-title${isTitleInHead ? ' is-in-head' : ''}`}
        >
          <div>
            {!isTitleInHead && (
              <span className="eyebrow">{t('eq.eyebrow')}</span>
            )}
            <div className="main-content-title__heading">
              <h2>
                {t('eq.title')}
                <OutputRate />
              </h2>
            </div>
            <OutputEditingNotice />
          </div>
          <div className="eq-toolbar">
            <VoicingQuickPick />
            {/* One action at a time: choose a mode while idle, Stop while
              measuring. Stopping keeps the correction already applied. */}
            {/* The quiet face, like every other tool in the row (Ivan,
              2026-09-27: "make smart eq button same as the others, no
              fill"); running, it keeps its breathing outline. */}
            <span
              className={`eq-mode is-subtle${isModeMenuOpen ? ' is-open' : ''}`}
              ref={modeMenuHolder}
            >
              <button
                type="button"
                ref={modeMenuTrigger}
                aria-label={
                  isSmartEqActive
                    ? t('eq.smart.stopAria')
                    : t('eq.smart.modeAria')
                }
                aria-expanded={isSmartEqActive ? undefined : isModeMenuOpen}
                aria-haspopup={isSmartEqActive ? undefined : 'menu'}
                // Never greyed out: the measurement opens its own tap on the
                // source and says in the bubble if it cannot. It used to wait
                // on the graph's loopback, which is not what it listens to.
                // Running gets the breathing outline and nothing else. It keeps
                // the Smart EQ button's own look, because it is that button.
                className={`button small subtle eq-mode__main${isBalancing || isContinuousRunning ? ' is-running' : ''}`}
                // Nothing here runs the measurement — it asks the host that owns
                // it to. That indirection is what lets a run outlive this panel:
                // the button is a way of reaching the measurement, not the place
                // it lives.
                onKeyDown={(event) => {
                  if (
                    !isSmartEqActive &&
                    (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsModeMenuOpen(true);
                  }
                }}
                onClick={() => {
                  if (!isSmartEqActive) {
                    setIsModeMenuOpen((wasOpen) => !wasOpen);
                    return;
                  }
                  setIsModeMenuOpen(false);
                  setContinuousEq(false);
                  if (isBalancing) {
                    cancelSmartEq();
                  }
                }}
              >
                <MenuIcon
                  name={isSmartEqActive ? 'stop' : 'smart'}
                  className="eq-toolbar__icon"
                />
                {isSmartEqActive ? modeLabel(smartEqMode) : t('eq.smart')}
                {!isSmartEqActive && <Chevron />}
              </button>
              {/* Include the remembered mode: selecting it is how a stopped
                run starts again. The menu is outside the panel that clips. */}
              <AnchoredMenu
                anchor={modeMenuHolder.current}
                isOpen={isModeMenuOpen && !isSmartEqActive}
                className="eq-mode__menu"
                ariaLabel={t('eq.smart.modeAria')}
              >
                {SMART_EQ_MODES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    role="menuitemradio"
                    aria-checked={entry === smartEqMode}
                    ref={
                      entry === smartEqMode ? attachModeMenuEntry : undefined
                    }
                    // The menu opens only while nothing runs
                    // (\`isSmartEqActive\`), so nothing here is running yet.
                    onClick={() => {
                      closeModeMenu();
                      if (entry === smartEqMode) {
                        if (isContinuousMode(entry)) {
                          setContinuousEq(true);
                        } else {
                          runSmartEq();
                        }
                        return;
                      }
                      // A different mode starts through the engine's own
                      // mode transition; asking it to run again would toggle
                      // the freshly started one-shot back off.
                      setSmartEqMode(entry);
                    }}
                  >
                    <MenuIcon name="smart" className="eq-toolbar__icon" />
                    <span className="eq-mode__menu-name">
                      {modeLabel(entry)}
                    </span>
                    {/* Each says what it overrides, because the names alone
                      cannot: three of them do the same job to three different
                      depths, and which depth is the whole choice being made
                      here. */}
                    <span className="eq-mode__menu-note">
                      {modeNote(entry)}
                    </span>
                  </button>
                ))}
              </AnchoredMenu>
              {/* What it is doing, said by the pet, from the button itself.
                It was a bare run of text sitting in the row, which put a
                sentence that changes among a line of controls that do not and
                made the toolbar reflow every time the wording changed. Hung off
                the button it belongs to, it is obviously about that button —
                and the creature saying it is the same one that reacts to the
                music everywhere else in the app, so the app has one voice
                rather than a label here and a character there. */}
              {bubbleText && (
                <span
                  // Green for a moment after a write reaches Equalizer APO, which
                  // is the moment the sound changes. It is the one thing in here
                  // that is not a sentence about what will happen: it means it
                  // just did.
                  className={`eq-mode__bubble${
                    correctionFlash ? ' is-applied' : ''
                  }${bubbleSpot?.isBelow ? ' is-below' : ''}`}
                  role="status"
                  ref={bubbleRef}
                  style={
                    bubbleSpot
                      ? ({
                          left: bubbleSpot.offsetLeft,
                          top: bubbleSpot.offsetTop,
                          right: 'auto',
                          bottom: 'auto',
                          '--bubble-tail': `${bubbleSpot.tailX}px`,
                          '--bubble-stem': `${bubbleSpot.stem}px`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  <span className="eq-mode__bubble-pet" aria-hidden>
                    <PetArt />
                  </span>
                  {/* Keyed on the landing, so a second correction arriving
                      while the first is still green holds the colour for its
                      own full moment rather than for what the first had left.
                      The text's hold (`eq-bubble-applied`) is that moment, and
                      its end is what ends the flash. */}
                  <span
                    key={correctionFlash?.id ?? 'resting'}
                    className="eq-mode__bubble-text"
                    onAnimationEnd={(event) => {
                      if (
                        correctionFlash &&
                        isOwnAnimationEnd(event, 'eq-bubble-applied')
                      ) {
                        endCorrectionFlash(correctionFlash.id);
                      }
                    }}
                  >
                    {balanceStatus ? (
                      // Keyed on the remark, so each new one is held for its
                      // own full moment; the hold's end is what ends it.
                      <span
                        key={balanceStatus.id}
                        className="eq-mode__bubble-status"
                        onAnimationEnd={(event) => {
                          if (
                            isOwnAnimationEnd(event, 'smart-eq-status-hold')
                          ) {
                            endSmartEqStatus(balanceStatus.id);
                          }
                        }}
                      >
                        {balanceStatus.text}
                      </span>
                    ) : (
                      bubbleText
                    )}
                  </span>
                </span>
              )}
            </span>
            {/* Only while an automatic mode is actually measuring. Saving a song
              means filing the Smart EQ layer being refined for it, and nothing
              but that measurement ever writes one — so with the loop stopped
              the switch was a promise the app had no way to keep: it could be
              ticked on, it counted out the two minutes, and it committed
              nothing at the end of them. */}
            {isContinuousRunning && <SongEqSaveSwitch id="songEqSave" />}
            <EqPageModeSelect />
            {/* The band count and its plus, as one "15 bands, +". Its word
              stays under the page's own title and goes above the graph,
              where the glyph beside the count says it (`MainContent.scss`). */}
            <BandLayoutMenu />
            <Button
              ariaLabel={t('eq.addBandAria')}
              title={t('eq.addBandAria')}
              isDisabled={frequencySortedFilters.length >= MAX_NUM_FILTERS}
              className="small subtle eq-toolbar__add"
              handleChange={addFilter}
            >
              <MenuIcon name="plus" className="eq-toolbar__icon" />
              <span className="eq-toolbar__word">{t('eq.addBand')}</span>
            </Button>
            {/* Every line the graph draws besides the bands, behind one
              dropdown (Ivan, 2026-09-27: "make applied filters always on
              curves dropdown"). */}
            <CurvesPicker />
            {/* Last: the one tool that undoes everything the others did. */}
            <ClearEqButton />
          </div>
        </div>,
      )}
      <div
        className={`main-content main-content--${density}${
          isEqOff ? ' is-eq-bypassed' : ''
        }${isPlaced ? ' is-placed' : ''}`}
      >
        {/* The rail scrolls when the bands stop fitting, with an arrow at
            each end — the same pair the workspace tabs use. Thirty-one bands
            in a narrow window were nine pixels each: a row of slivers with
            their frequencies overprinted on one another, and nothing anybody
            could aim at. Each band keeps a floor of its own instead and the
            row runs past the edge, which is a thing you can scroll. */}
        <BandLevels row={bandsElement} />
        {/* With the EQ layer off its bands edit nothing, by pointer or by
            key: `inert`, where the stylesheet alone left every slider a
            tab stop that still moved its band. */}
        <div
          className="bands-rail"
          ref={attachRail}
          inert={isEqOff || undefined}
        >
          {/* No arrows while the bands are placed across the plot: every one
              of them is inside its width by construction, and the few pixels
              the outermost may hang into the page's padding are not a row to
              scroll. */}
          {!isPlaced && canScrollBands.canScrollBack && (
            <OverflowArrow
              direction="back"
              onPress={() => canScrollBands.scrollBy(-1)}
            />
          )}
          <div
            className="bands-rail__viewport"
            ref={canScrollBands.ref}
            onScroll={canScrollBands.onScroll}
          >
            <div
              ref={attachBands}
              className={`bands bands--${density} bands--${bandLayout}${
                isPlaced ? ' is-placed' : ''
              }`}
              onPointerDown={handleBandsPointerDown}
              onPointerMove={handleBandsPointerMove}
              onPointerUp={finishBandSelection}
              onPointerCancel={finishBandSelection}
              style={
                {
                  '--band-count': frequencySortedFilters.length,
                } as CSSProperties
              }
            >
              {selectionBox && (
                <div
                  className="bands__selection-box"
                  style={{
                    left: Math.min(selectionBox.startX, selectionBox.currentX),
                    top: Math.min(selectionBox.startY, selectionBox.currentY),
                    width: Math.abs(
                      selectionBox.currentX - selectionBox.startX,
                    ),
                    height: Math.abs(
                      selectionBox.currentY - selectionBox.startY,
                    ),
                  }}
                />
              )}
              {frequencySortedFilters.map((filter, index) => (
                <FrequencyBand
                  key={filter.id}
                  filter={filter}
                  colorProgress={
                    frequencySortedFilters.length > 1
                      ? index / (frequencySortedFilters.length - 1)
                      : 0
                  }
                  density={density}
                  flatLayout
                  isSelected={selectedFilterIds.includes(filter.id)}
                  onSelect={handleBandSelect}
                  isHovered={hoveredFilterId === filter.id}
                  onHover={handleBandHover}
                  isMinSliderCount={
                    frequencySortedFilters.length <= MIN_NUM_FILTERS
                  }
                  onGainChange={handleBandGainChange}
                  onGainPreview={handleBandGainPreview}
                />
              ))}
            </div>
          </div>
          {!isPlaced && canScrollBands.canScrollForward && (
            <OverflowArrow
              direction="forward"
              onPress={() => canScrollBands.scrollBy(1)}
            />
          )}
        </div>
        {/* The dB scale beside the sliders, numbered the way a console prints
            one beside a fader (Ivan, 2026-09-27: "add the 10 and other that
            pro console has"). After the rail rather than before it: it is
            placed against the first band's own travel (`.eq-scale`), and a
            box can only be placed on one laid out before it. The grid still
            puts it in the first column. */}
        <div className="eq-scale" aria-hidden="true">
          {EQ_SCALE_MARKS.map((gain) => (
            <span
              key={gain}
              className={`eq-scale__mark${eqScaleMarkClass(gain)}`}
              style={
                {
                  '--at': (MAX_GAIN - gain) / (MAX_GAIN - MIN_GAIN),
                } as CSSProperties
              }
            >
              {eqScaleLabel(gain)}
            </span>
          ))}
        </div>
        {selectedFilter && (
          <div className="eq-flat-editor" inert={isEqOff || undefined}>
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
            <div className="eq-flat-editor__control eq-flat-editor__control--wide">
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
              className="eq-flat-editor__control eq-flat-editor__control--centred"
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
              className="eq-flat-editor__control eq-flat-editor__control--centred"
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
                <div
                  className="eq-flat-editor__gain-na"
                  title={t('eq.gainNaHint')}
                >
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
                  handleChange={(newValue) =>
                    updateSelectedGroup('gain', newValue)
                  }
                />
              )}
            </div>
            <div className="eq-flat-editor__control eq-flat-editor__control--centred">
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
                handleChange={(newValue) =>
                  updateSelectedGroup('quality', newValue)
                }
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
            <div className="eq-flat-editor__control eq-flat-editor__control--centred">
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
        )}
        {/* With nothing selected, the same row carries the whole rack instead
            of one band: Bass, Mid and Treble, the way an amplifier has them.
            It stands where the band editor stands rather than somewhere of its
            own, because it is the same question — what is being shaped, and
            with what — asked of everything instead of one thing. */}
        {!selectedFilter && (
          <div className="eq-flat-editor eq-flat-editor--tone">
            {/* The row's name where a band's frequency stands, with nothing
                over it: the band count it used to carry said the dials were
                spread across the bands, and they are a curve of their own
                now (`tone.ts`). */}
            <div className="eq-flat-editor__identity">
              <span aria-hidden="true" />
              <strong>{t('eq.tone')}</strong>
            </div>
            {/* The two cuts either side of the three tone dials, the low one
                on the left and the high one on the right, as they sit on
                the graph. */}
            <EqCutKnob cut="low" />
            {TONE_CONTROLS.map(({ knob, labelKey }) => (
              <div
                key={knob}
                className="eq-flat-editor__control eq-flat-editor__control--centred"
              >
                <span>{t(labelKey)}</span>
                <Knob
                  name={t(labelKey)}
                  value={tone[knob]}
                  min={-TONE_MAX_DB}
                  max={TONE_MAX_DB}
                  isDisabled={isToneDisabled}
                  step={0.1}
                  unit="dB"
                  defaultValue={0}
                  onReset={() => resetTone(knob)}
                  handleChange={(newValue) => turnTone(knob, newValue)}
                />
              </div>
            ))}
            <EqCutKnob cut="high" />
          </div>
        )}
      </div>
    </>
  );
};

export default EqPageView;
