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
  IFilter,
  MAX_GAIN,
  MAX_NUM_FILTERS,
  MIN_GAIN,
  MIN_NUM_FILTERS,
} from 'common/constants';
import { CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import Spinner from '../icons/Spinner';
import BandMenu from '../components/BandMenu';
import OutputEditingNotice from '../OutputEditingNotice';
import Button from '../widgets/Button';
import MenuIcon from '../icons/MenuIcon';
import EqPageModeSelect from '../components/eqMode/EqPageModeSelect';
import BandLayoutMenu from '../components/BandLayoutMenu';
import CurvesPicker from '../components/CurvesPicker';
import ClearEqButton from '../components/ClearEqButton';
import SaveEqMenu from './autoEq/SaveEqMenu';
import BandLevels from '../components/BandLevels';
import { attachRail } from './bandsRail';
import OverflowArrow from '../components/OverflowArrow';
import FrequencyBand from '../components/FrequencyBand';
import { EQ_SCALE_MARKS, eqScaleLabel, eqScaleMarkClass } from './eqScaleMarks';
import { type TEqPageBands } from './useEqPageBands';
import { type TEqPageActions } from './useEqPageActions';
import { type TEqLayerTab } from './eqLayerTab';
import EqLayerTabs, { eqLayerPanelId, eqLayerTabId } from './EqLayerTabs';
import { useEqRowSlot } from './eqRowSlot';
import AutoEqButton from './autoEq/AutoEqButton';
import EqToolGroup from './EqToolGroup';
import {
  EqBandPopoverOnBand,
  EqBandPopoverOnGraph,
  useBandPopoverState,
} from './EqBandPopovers';
import EqPresetTab, { EqPresetSearch } from './EqPresetTab';
import EqToneTab from './EqToneTab';
import NewPresetButton from './ownPresets/NewPresetButton';
import NewPresetDialog from './ownPresets/NewPresetDialog';
import PresetCurveRail from './ownPresets/PresetCurveRail';
import PresetEditStrip from './ownPresets/PresetEditStrip';
import { useNewPresetDialogOpen } from './ownPresets/newPresetDialogState';
import { usePresetEditSession } from './ownPresets/presetEditSession';

type TEqPageViewProps = {
  bands: TEqPageBands;
  actions: TEqPageActions;
  /** Which of the three tabs under the graph is open (`eqLayerTab.ts`). */
  tab: TEqLayerTab;
};

/**
 * The EQ page's markup, under its graph and divider (Ivan, 2026-11-16, "One
 * pane, inset cards"): the row of three tabs — Your EQ, Preset, Tone — with
 * the open tab's tools, and that tab's page. Your EQ is the band rail with
 * its scale and the selected band's editor beside it; Preset browses the
 * presets; Tone holds the cuts and the three dials. Holds no state of its
 * own; everything it shows comes from the bands, the actions and the tab.
 */
const EqPageView = ({ bands, actions, tab }: TEqPageViewProps) => {
  // Whether the band popover is up and on which anchor, decided once for
  // the slider's and the graph's (`useBandPopoverState`).
  const popover = useBandPopoverState(bands);
  // On the EQ page the row stands above the scrolling page, on the graph's
  // surface (`eqRowSlot.ts`); elsewhere it stays inline over the bands.
  const rowSlot = useEqRowSlot();
  // One of the listener's presets open: its strip stands where the tab row
  // stood and its bands where the open tab's page was (own presets,
  // Direction A). Your EQ's bands, hooks and all, wait untouched underneath.
  const isEditingPreset = usePresetEditSession() !== undefined;
  const isNewPresetOpen = useNewPresetDialogOpen();
  const {
    filters,
    isLoading,
    selectedFilterIds,
    hoveredFilterId,
    bypassed,
    t,
    frequencySortedFilters,
    density,
    bandsElement,
    attachBands,
    canScrollBands,
    isPlaced,
    selectionBox,
    handleBandGainChange,
    handleBandGainPreview,
    handleBandSelect,
    handleBandQualityWheel,
    handleBandHover,
  } = bands;
  const {
    handleBandsPointerDown,
    handleBandsPointerMove,
    finishBandSelection,
    isToneDisabled,
    handleBandFrequencyReset,
    resetToneTab,
    isToneTabInUse,
    toneCutCorners,
    addFilter,
    addFilterBeside,
    setFiltersEnabled,
    setFiltersChannel,
    deleteFilters,
    canDeleteFilters,
    resetFilters,
    bandMenu,
    setBandMenu,
  } = actions;
  const bandMenuFilter = bandMenu ? filters[bandMenu.filterId] : undefined;
  // The EQ layer switched off from its chip: the bands stay where they are
  // and edit nothing until it is back on.
  const isEqOff = bypassed.includes('eq');
  // The bands the menu acts on: the whole selection when the clicked band is
  // in it, otherwise just the clicked band.
  let bandMenuFilters: IFilter[] = [];
  if (bandMenuFilter) {
    bandMenuFilters = selectedFilterIds.includes(bandMenuFilter.id)
      ? selectedFilterIds.map((id) => filters[id]).filter(Boolean)
      : [bandMenuFilter];
  }

  // Each tab's tools, flat (Ivan, 2026-11-17, B1 "grouped by job"). Your
  // EQ's are in two groups under captions — BANDS: how many, add one, clear
  // them; VIEW: the curves the graph draws, the EQ mode — and Auto EQ alone
  // at the end, the one filled button, the action the page recommends. Clear
  // EQ clears the bands, so it is Your EQ's alone (Ivan, 2026-11-26: "remove
  // clear EQ on tone page and on preset page"): the Tone has Reset Tone, and
  // a preset is taken off by picking None.
  const rule = <span className="eq-layer-tabs__rule" aria-hidden="true" />;
  const tools: Record<TEqLayerTab, ReactElement> = {
    bands: (
      <>
        <EqToolGroup caption={t('eq.tools.bands')}>
          {/* How many, and the layout menu with its reset. */}
          <BandLayoutMenu formatLabel={String} />
          <Button
            ariaLabel={t('eq.addBandAria')}
            title={t('eq.addBandAria')}
            isDisabled={frequencySortedFilters.length >= MAX_NUM_FILTERS}
            className="small subtle eq-toolbar__add"
            handleChange={addFilter}
          >
            <MenuIcon name="plus" className="eq-toolbar__icon" />
            <span className="eq-toolbar__word">{t('eq.tools.add')}</span>
          </Button>
          <ClearEqButton label={t('eq.tools.clear')} />
          {/* Keep what plays as a saved EQ, update it, put one on (Ivan,
            2026-11-20: "we have it next to Clear"). */}
          <SaveEqMenu />
        </EqToolGroup>
        {rule}
        <EqToolGroup caption={t('eq.tools.view')}>
          {/* Every line the graph draws besides the bands, behind one
            dropdown (Ivan, 2026-09-27: "make applied filters always on
            curves dropdown"). */}
          <CurvesPicker />
          <EqPageModeSelect />
        </EqToolGroup>
        <AutoEqButton />
      </>
    ),
    preset: (
      <>
        <EqPresetSearch />
        <NewPresetButton />
      </>
    ),
    tone: (
      <Button
        ariaLabel={t('eq.tone.reset')}
        title={t('eq.tone.reset')}
        isDisabled={isToneDisabled || !isToneTabInUse}
        className="small subtle"
        handleChange={() => {
          resetToneTab().catch(() => undefined);
        }}
      >
        <MenuIcon name="reset" className="eq-toolbar__icon" />
        <span>{t('eq.tone.reset')}</span>
      </Button>
    ),
  };
  const row = isEditingPreset ? (
    <PresetEditStrip page="eq" />
  ) : (
    <EqLayerTabs
      active={tab}
      bandCount={frequencySortedFilters.length}
      isToneOn={isToneTabInUse}
      toneCutCorners={toneCutCorners}
      tools={tools[tab]}
    />
  );

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
          onDelete={
            canDeleteFilters
              ? (targets) => {
                  deleteFilters(targets).catch(() => undefined);
                }
              : undefined
          }
          onSetChannel={(targets, side) => {
            setFiltersChannel(
              targets.map((one) => one.id),
              side,
            ).catch(() => undefined);
          }}
          onClose={() => setBandMenu(undefined)}
        />
      )}
      <OutputEditingNotice />
      {/* The same popover beside a handle on the graph, whichever layer tab is
          open: the graph's handles are the bands on every one of them. */}
      {!isEditingPreset && (
        <EqBandPopoverOnGraph
          bands={bands}
          actions={actions}
          popover={popover}
        />
      )}
      {rowSlot === undefined ? row : rowSlot && createPortal(row, rowSlot)}
      {isNewPresetOpen && <NewPresetDialog />}
      {isEditingPreset && <PresetCurveRail />}
      {!isEditingPreset && tab === 'bands' && (
        <div
          id={eqLayerPanelId('bands')}
          role="tabpanel"
          aria-labelledby={eqLayerTabId('bands')}
          className={`main-content main-content--${density}${
            isEqOff ? ' is-eq-bypassed' : ''
          }${isPlaced ? ' is-placed' : ''}`}
        >
          {/* The band popover against its slider, while Shift holds it
              (`bandPopover.ts`), first in the panel so the keyboard reaches
              it before the thirty-one sliders under it. */}
          <EqBandPopoverOnBand
            bands={bands}
            actions={actions}
            popover={popover}
          />
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
                className={`bands bands--${density}${
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
                      left: Math.min(
                        selectionBox.startX,
                        selectionBox.currentX,
                      ),
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
                    ear={filter.channel}
                    onSelect={handleBandSelect}
                    onQualityWheel={handleBandQualityWheel}
                    isHovered={hoveredFilterId === filter.id}
                    onHover={handleBandHover}
                    isMinSliderCount={
                      frequencySortedFilters.length <= MIN_NUM_FILTERS
                    }
                    onGainChange={handleBandGainChange}
                    onGainPreview={handleBandGainPreview}
                    onResetFrequency={handleBandFrequencyReset}
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
        </div>
      )}
      {!isEditingPreset && tab === 'preset' && (
        <div
          id={eqLayerPanelId('preset')}
          role="tabpanel"
          aria-labelledby={eqLayerTabId('preset')}
          className="eq-layer-panel eq-layer-panel--preset"
        >
          <EqPresetTab />
        </div>
      )}
      {!isEditingPreset && tab === 'tone' && (
        <div
          id={eqLayerPanelId('tone')}
          role="tabpanel"
          aria-labelledby={eqLayerTabId('tone')}
          className="eq-layer-panel"
        >
          <EqToneTab actions={actions} />
        </div>
      )}
    </>
  );
};

export default EqPageView;
