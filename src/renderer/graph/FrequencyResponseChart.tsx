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
  IFiltersMap,
  IFilter,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_QUALITY,
  TApoLayer,
} from 'common/constants';
import { ErrorDescription } from 'common/errors';
import { GRAPH_PALETTES, GraphPalette } from 'common/graphStyles';
import { TranslationKey } from 'common/i18n';
import {
  CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Spinner from 'renderer/icons/Spinner';
import LookIcon from 'renderer/icons/LookIcon';
import {
  FilterActionEnum,
  useFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import { setFrequency, setGain, setQuality } from 'renderer/utils/equalizerApi';
import { useThrottleAndExecuteLatest } from 'renderer/utils/utils';
import Chart, { ChartDimensions } from './Chart';
import {
  IChartLineDataPointsById,
  IChartPointData,
  IEditableChartPoint,
  ILiveCurveData,
} from './ChartController';
import { getLineGainAtFrequency } from './utils';
import { plotTopMargin } from './plotMargins';
import { ColorEnum } from '../styles/color';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { getBandColor } from '../utils/bandColors';
import {
  cycleGraphLook,
  cycleWaveOrientation,
  exitGraphFullScreen,
  getSelectableLooks,
  setGraphLook,
  setGraphPalette,
  setGraphView,
  toggleGraphExpanded,
  toggleGraphFullScreen,
  toggleGraphCoverage,
  toggleGraphMeter,
  toggleTitlebarWave,
  toggleGraphGrid,
  toggleGraphStretch,
  toggleFullScreenTopBar,
  cycleGraphContents,
  useGraphContents,
  useGraphFullScreen,
  useGraphCoverageHidden,
  useGraphMeterHidden,
  useTitlebarWaveHidden,
  useGraphGridHidden,
  useGraphWaveHidden,
  useHiddenCurves,
  useGraphModeAnnouncement,
  useGraphEqQuiet,
  toggleGraphCurve,
  TGraphCurve,
  toggleGraphWave,
  useGraphStretched,
  useGraphWaveSize,
  useWaveOrientation,
  useGraphView,
  useFullScreenTopBar,
  useLiveOutputSolo,
  useGraphLook,
  useGraphPalette,
  useIsPaletteSelectable,
  useSelectedLookId,
} from '../utils/graphStyle';
import { setChromeHeld, useIsChromeIdle } from '../utils/idleChrome';
import {
  MAX_OVERLAY_BLUR,
  MIN_OVERLAY_OPACITY,
  setOverlayBlur,
  setOverlayOpacity,
  useOverlayBlur,
  useOverlayOpacity,
} from '../utils/graphOverlay';
import { useCustomLooks } from '../utils/customLooks';
import { useTranslation } from '../utils/I18nContext';
import LookDesigner from '../components/LookDesigner';
import Dropdown from '../widgets/Dropdown';
import GraphViewMenu from './GraphViewMenu';
import { hasHeadphoneLayer } from '../../common/headphone';
import { hasSmartEqLayer } from '../../common/smartEq';
import { hasCustomFxCurve } from '../../common/customFx';
import {
  buildChartData,
  IGraphData,
  SUPPORTING_CURVE_OPACITY,
} from './buildChartData';
import '../styles/MultiSelect.scss';
import '../styles/GraphTheme.scss';

type PendingPointEdit = Partial<
  Pick<IFilter, 'frequency' | 'gain' | 'quality'>
>;

/**
 * How present the layers under the response are.
 *
 * Voicing, driver compensation, a measured correction and the live output are
 * all context for reading the curve being edited, not the subject of the
 * graph. At full strength five curves of similar weight read as a tangle with
 * no obvious answer in it.
 */

/**
 * How tall the compact size draws the wave, as a fraction of its full depth.
 *
 * Half, so it reads as the same drawing along the edge of the screen rather
 * than as a different one. The orientation still decides which edge.
 */
const COMPACT_WAVE_SCALE = 0.5;

/**
 * How long silence has to last before the graph believes the music stopped.
 *
 * Long enough to ride out a track change or a stream stalling, short enough
 * that pausing something and looking back at the EQ does not feel like waiting.
 */
const SILENCE_GRACE_MS = 2000;

/**
 * How long the look designer is kept mounted after being told to close.
 *
 * Must match the exit animation in LookDesigner.scss. Shorter and the panel
 * disappears mid-flight; longer and there is a pause between the animation
 * finishing and the panel going, which reads as the app hesitating.
 */
const DESIGNER_EXIT_MS = 170;

/**
 * What each palette is called, for the toggle that cycles them.
 *
 * The designer's own names, so the same three things are called the same
 * three words in both places somebody meets them.
 */
const PALETTE_LABEL_KEYS: Record<GraphPalette, TranslationKey> = {
  signal: 'look.palette.flat',
  rainbow: 'look.palette.frequency',
  level: 'look.palette.level',
  heat: 'look.palette.heat',
};

/** How long the look's name stays up after it changes. */
const LOOK_ANNOUNCEMENT_MS = 2000;

/**
 * The look's name, shown for a moment whenever it changes.
 *
 * The same idea as the titlebar wave's: the form is cycled by clicking the
 * plot and by two arrows that carry no label, so without this the only way
 * to know which of the fifty-seven you just landed on is to open the picker
 * and read it — by which point you are no longer looking at the drawing.
 *
 * Its own subscriber, so a name that is absent almost all of the time does
 * not wake the chart to say so. Silent on mount: the look has not changed,
 * it is simply what was already there.
 */
const LookAnnouncement = () => {
  const { t } = useTranslation();
  const look = useGraphLook();
  const [shown, setShown] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const knownRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const name = look.isCustom
    ? look.label
    : [
        t(`graph.styleName.${look.style}` as TranslationKey),
        look.palette === 'signal' ? '' : t(PALETTE_LABEL_KEYS[look.palette]),
      ]
        .filter(Boolean)
        .join(' · ');

  useEffect(() => {
    if (knownRef.current === null) {
      knownRef.current = name;
      return undefined;
    }
    if (knownRef.current === name) {
      return undefined;
    }
    knownRef.current = name;
    // The name stays through the fade, or there would be nothing left to
    // fade away — clearing it when the timer fires cuts the animation at
    // the instant it starts.
    setShown(name);
    setIsVisible(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      timerRef.current = null;
    }, LOOK_ANNOUNCEMENT_MS);
    return undefined;
  }, [name]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return (
    <span
      className={`graph-look-announcement${isVisible ? ' is-visible' : ''}`}
      role="status"
      aria-hidden={!isVisible}
    >
      {shown}
    </span>
  );
};

/**
 * WHY TWO COMPONENTS IN THIS FILE DRAW ALMOST NOTHING.
 *
 * The analyser publishes about twenty-two times a second, and a component that
 * reads those frames re-renders every time one lands. This one used to: it took
 * the frame at the top and handed the points down to the canvas that draws them,
 * which meant fourteen hundred lines of chart — and every d3 axis, grid and
 * curve effect underneath it — running twenty-two times a second for as long as
 * music was playing. Measured, that was a leak of roughly twenty megabytes a
 * minute, in Blink's heaps rather than the JS one, which is what a d3 transition
 * rebuilt per frame looks like from the outside. It grew for as long as the
 * window stayed open, and hiding the wave did not stop it: the chart was
 * re-rendering for a drawing it was not even making.
 *
 * So the subscriptions moved down to the leaves that actually want a frame —
 * these two, the coverage overlay in `Chart`, and `LiveTraceCanvas`, which is
 * the only one that draws anything substantial and does it outside React
 * entirely. Each reads one field and renders one small thing or nothing at all.
 * What travels down the tree instead is what somebody chose: which look, which
 * way up, whether the wave is shown. That changes when a control is used, and
 * the chart re-renders then, which is exactly when it should.
 */

/**
 * Which stored curve each of the chart's curves is, so the legend and the store
 * can name the same line without either having to use the other's words.
 */
const CURVE_BY_CHART_ID: Record<string, TGraphCurve> = {
  'Headphone Convolution': 'convolution',
  'EQ Response': 'eq',
  Voicing: 'voicing',
  Driver: 'driver',
  // Spelled out rather than left as `Headphone`, which would sit one line under
  // the impulse response's `Headphone Convolution` and read as its abbreviation.
  // They are different layers with different colours and either can hide the
  // other's chip if the two ids are confused.
  'Headphone Correction': 'headphone',
  'Smart EQ': 'smart',
  'Custom FX': 'custom',
  'Total Response': 'total',
};

/**
 * One legend chip: the name of a curve, its colour, and the switch that shows
 * or hides it.
 *
 * A component rather than six copies of the same markup because the pressed
 * state, the title and the class all move together — and because every one of
 * them subscribes to the same store, which is a line of hook per chip if they
 * are written out by hand.
 */
const CurveLegend = ({
  curve,
  label,
}: {
  curve: TGraphCurve;
  label: string;
}) => {
  const { t } = useTranslation();
  const hiddenCurves = useHiddenCurves();
  const isHidden = hiddenCurves.includes(curve);
  return (
    <button
      type="button"
      className={`graph-legend graph-legend--${curve}${
        isHidden ? ' is-hidden' : ''
      }`}
      aria-pressed={!isHidden}
      title={t(isHidden ? 'graph.show' : 'graph.hide', { item: label })}
      onClick={() => toggleGraphCurve(curve)}
    >
      {label}
    </button>
  );
};

interface ICurveChip {
  curve: TGraphCurve;
  label: string;
}

/**
 * The curve switches, when the row is too narrow to hold them.
 *
 * Six chips is a hundred and eighty pixels more than the strip has in a
 * half-width window, and the row is right-aligned over the plot, so the
 * overflow does not simply stop at an edge — it pushes the picker and the menu
 * off the left of the card. Behind one button they cost the width of the word.
 *
 * The same `CurveLegend` inside, not a second rendering of the same idea: the
 * pressed state, the colour and the hidden styling are the chip's, and a menu
 * that reimplemented them would be a menu that drifts.
 */
const CurveLegendMenu = ({ chips }: { chips: ICurveChip[] }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <span className="graph-legend-menu" ref={holder}>
      <button
        type="button"
        className={`graph-legend-menu__trigger${isOpen ? ' is-on' : ''}`}
        aria-expanded={isOpen}
        title={t('graph.curvesHint')}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M1.5 11c2.2 0 3-6 5.2-6s3 6 5.2 6 2.6-3 2.6-3" />
        </svg>
        {t('graph.curves')}
      </button>
      {isOpen && (
        <span className="graph-legend-menu__list">
          {chips.map((chip) => (
            <CurveLegend
              key={chip.curve}
              curve={chip.curve}
              label={chip.label}
            />
          ))}
        </span>
      )}
    </span>
  );
};

/**
 * The clip indication.
 *
 * Reads `isClipping` and only `isClipping` — a boolean that is true for a few
 * hundred milliseconds after the output rails and false the rest of the time, so
 * this renders the same nothing on almost every frame and React has nothing to
 * do with it.
 */
const LiveClipWarning = () => {
  const { t } = useTranslation();
  const { isClipping } = useLiveAudioFrame();
  return isClipping ? (
    <span className="graph-clip-warning" role="status">
      {t('graph.clip')}
    </span>
  ) : null;
};

/**
 * Whether audio was playing recently enough to still count as playing.
 *
 * Silence empties the frame, and an empty frame brings the EQ curves back —
 * which is the right thing to do when the music has stopped and a blink when it
 * merely dipped. Tracks change, a stream buffers, a passage goes quiet for a
 * fifth of a second; every one of those flashed the whole EQ across the graph
 * and took it away again.
 *
 * So silence has to persist before it is believed. Coming back is immediate: the
 * moment there is a frame there is a trace, and delaying *that* would be a graph
 * that lags the music.
 *
 * Renders nothing and reports upward, because the answer is needed by the chart
 * — it decides whether the EQ curves are drawn — while the question can only be
 * answered by watching every frame. Mounted only in solo, which is the only mode
 * where the answer changes anything, and it reports `false` on the way out so
 * that a stale "yes" cannot outlive the subscription and leave the graph empty
 * for two seconds the next time solo is switched on in a quiet room.
 */
const SilenceWatch = ({
  onChange,
}: {
  onChange: (hasRecentAudio: boolean) => void;
}) => {
  const { points } = useLiveAudioFrame();
  const hasFrame = points.length > 0;
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (hasFrame) {
      if (silenceTimer.current !== undefined) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = undefined;
      }
      onChange(true);
      return;
    }
    if (silenceTimer.current === undefined) {
      silenceTimer.current = setTimeout(() => {
        silenceTimer.current = undefined;
        onChange(false);
      }, SILENCE_GRACE_MS);
    }
  }, [hasFrame, onChange]);

  useEffect(
    () => () => {
      if (silenceTimer.current !== undefined) {
        clearTimeout(silenceTimer.current);
      }
      onChange(false);
    },
    [onChange],
  );

  return null;
};

// The look list is no longer a module constant: it now depends on the looks the
// user has saved, so it is built inside the component from `getSelectableLooks`
// and memoised on that list instead.
interface IFrequencyResponseChartProps {
  /** Controlled visibility for the active workspace tab. */
  isVisible?: boolean;
}

const FrequencyResponseChart = ({
  isVisible,
}: IFrequencyResponseChartProps) => {
  const { t } = useTranslation();
  // The selection, not the resolved look: while the designer is open the chart
  // is drawing an unsaved draft whose id is in no list, and a picker handed
  // that id would show nothing.
  const selectedLookId = useSelectedLookId();
  const graphPalette: GraphPalette = useGraphPalette();
  const isPaletteSelectable = useIsPaletteSelectable();
  const customLooks = useCustomLooks();
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  /**
   * Closing, but not yet gone.
   *
   * React unmounts the moment the condition turns false, which is why the panel
   * arrived with an animation and left by vanishing. Nothing in CSS can hold an
   * element that is no longer in the tree, so the wait has to live here: the
   * class goes on, the panel plays its exit, and only then is it dropped.
   */
  const [isDesignerClosing, setIsDesignerClosing] = useState(false);
  const designerExitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const closeDesigner = useCallback(() => {
    setIsDesignerClosing(true);
    clearTimeout(designerExitTimer.current);
    designerExitTimer.current = setTimeout(() => {
      designerExitTimer.current = undefined;
      setIsDesignerClosing(false);
      setIsDesignerOpen(false);
    }, DESIGNER_EXIT_MS);
  }, []);

  const openDesigner = useCallback(() => {
    // A reopen mid-exit is somebody changing their mind, and it must not be
    // followed a moment later by the timer that was closing it.
    clearTimeout(designerExitTimer.current);
    designerExitTimer.current = undefined;
    setIsDesignerClosing(false);
    setIsDesignerOpen(true);
  }, []);

  // A pending close must not fire into an unmounted component, and leaving the
  // graph is itself a reason for the panel to be gone.
  useEffect(() => () => clearTimeout(designerExitTimer.current), []);

  // The toolbar stays while the designer is open — the panel was opened from
  // it, sits beside it, and every control in it is judged against the drawing
  // behind. Fading the strip out from under it takes the controls away at the
  // exact moment somebody has stopped moving the mouse to look at a change.
  useEffect(() => {
    setChromeHeld(isDesignerOpen);
    return () => setChromeHeld(false);
  }, [isDesignerOpen]);
  const isSolo = useLiveOutputSolo();
  const graphView = useGraphView();
  const isGridHidden = useGraphGridHidden();
  const isCoverageHidden = useGraphCoverageHidden();
  const isMeterHidden = useGraphMeterHidden();
  const isTitlebarWaveHidden = useTitlebarWaveHidden();
  const isWaveHidden = useGraphWaveHidden();
  const hiddenCurves = useHiddenCurves();
  // Which of the five arrangements the switches add up to, so the View menu's
  // cycle row can name it instead of only offering to move on from it.
  const graphContents = useGraphContents();
  const modeAnnouncement = useGraphModeAnnouncement();
  // The dots go with the line they draw. A handle you can drag over a curve
  // that is not on screen gives no feedback at all — the whole point of
  // dragging one is watching the response follow it.
  const isEqQuiet = useGraphEqQuiet();
  // The dots go when the curve does, and when it is drawn quietly: the reading
  // state is exactly the one where they are in the way, and a handle dragged
  // over a hairline gives nothing back.
  const areHandlesHidden = hiddenCurves.includes('eq') || isEqQuiet;

  const isStretched = useGraphStretched();
  const waveSize = useGraphWaveSize();
  const waveOrientation = useWaveOrientation();

  /**
   * The whole picker: what ships, then what the user made.
   *
   * The order comes from `getSelectableLooks` rather than being assembled here,
   * because clicking the plot walks that same list. Two places building "the
   * looks, in order" is two places to disagree, and the symptom would be the
   * plot click skipping an entry the menu shows.
   *
   * Rebuilt only when their list changes — a save or a delete — rather than per
   * render, which would hand the dropdown a new array twenty-two times a second
   * while the live curve is updating.
   */
  const graphLookOptions = useMemo(
    () =>
      getSelectableLooks(customLooks, graphPalette).map((look) => {
        // The form's name and nothing else. The palette used to be appended
        // here, back when the list held every form three times; with one row
        // per form the suffix would be the same word on all forty-seven and
        // the toggle beside the list already says which is on.
        const builtInLabel = look.isCustom
          ? look.label
          : t(`graph.styleName.${look.style}` as TranslationKey);
        return {
          value: look.id,
          label: builtInLabel,
          // The name is wrapped rather than handed over as a bare string, because
          // the dropdown renders `display` straight into the trigger — a loose
          // text node with nothing to hang a rule on. Styling the closed control
          // needs an element.
          //
          // A look the user made is marked on the row rather than in the label,
          // so the search still matches the name they typed instead of the word
          // "custom".
          //
          // The glyph goes in front of it, in both places `display` is used —
          // every row of the open list and the closed trigger. A hundred and
          // thirty-eight rows of "Terrace", "Crown" and "Truss" say nothing
          // about what any of them draws, and the only way to find out was to
          // select one and look; the icon answers the shape and the colouring at
          // once, since it is painted by the same resolver as the trace itself.
          display: (
            <span className="graph-look-option">
              <LookIcon
                className="graph-look-option__icon"
                style={look.style}
                palette={look.palette}
                colours={look.colours}
              />
              <span
                className={`graph-look-name${
                  look.isCustom ? ' graph-look-name--custom' : ''
                }`}
              >
                {builtInLabel}
              </span>
            </span>
          ),
        };
      }),
    // The palette is passed to the resolver rather than left for it to read,
    // which is what makes this dependency a real one. Every row is drawn in
    // whichever palette is on, so without it the menu froze in the previous
    // one and its ids went stale with it — the list still held `bars` while
    // the selection had become `bars-rainbow`, so the dropdown matched
    // nothing and cycling walked a list nobody could see.
    [customLooks, graphPalette, t],
  );
  const isFullScreen = useGraphFullScreen();
  const isChromeIdle = useIsChromeIdle();
  const hasTopBar = useFullScreenTopBar();
  const overlayOpacity = useOverlayOpacity();
  const overlayBlur = useOverlayBlur();
  const {
    filters,
    isGraphViewOn: isGlobalGraphViewOn,
    isEngineUsable,
    isLoading,
    globalError,
    isAutoPreAmpOn,
    isSmartHeadroomOn,
    convolution,
    preAmp,
    eqFormat,
    graphicEq,
    setGlobalError,
    setPreAmp,
    dispatchFilter,
    selectedFilterIds,
    setSelectedFilterIds,
    hoveredFilterId,
    setHoveredFilterId,
    voicing,
    driver,
    headphone,
    smartEq,
    bypassed,
    customFx,
  } = useFluidEqContext();
  const isGraphViewOn = isVisible ?? isGlobalGraphViewOn;
  const isBypassed = (layer: TApoLayer) => bypassed.includes(layer);
  // A boolean rather than the two tests written out at each of the three places
  // that need them — the curve, its legend chip, and the sum they both feed.
  // Switched off, the impulse is not in the config and so is not on the plot,
  // which is the rule every other layer already followed.
  const hasConvolution =
    Boolean(convolution) && !bypassed.includes('convolution');

  /**
   * The curve switches the legend is currently offering, as data.
   *
   * One list, two renderings — inline along the strip, or stacked behind a
   * button when the strip is too narrow for them. Written out twice, the
   * conditions deciding which layers have a chip would be the thing that
   * drifted, and the narrow window is the one nobody is looking at while they
   * work.
   *
   * A chip is here only when its layer is in the Equalizer APO chain: a hidden
   * curve can always be brought back, and a bypassed one is gone from the
   * legend rather than sitting in it pretending it could be shown. Solo has no
   * curves at all, so it has no list.
   */
  const curveChips: ICurveChip[] = [];
  if (!isSolo) {
    if (hasConvolution) {
      curveChips.push({
        curve: 'convolution',
        label: t('graph.curve.convolution'),
      });
    }
    if (driver?.profileId && !isBypassed('driver')) {
      curveChips.push({ curve: 'driver', label: t('graph.curve.driver') });
    }
    // Beside the driver, because it is written beside it and because it is the
    // same kind of thing: a correction for the hardware rather than for taste.
    //
    // The word is the one the chip row above the editor uses for this layer —
    // `eq.layers.headphone` — but written out, like every other label here. The
    // legend is not translated: `Driver`, `Voicing`, `Smart EQ` and `Final
    // output` are all English in the source, and one translated chip among six
    // would be the odd one rather than the start of anything.
    if (hasHeadphoneLayer(headphone) && !isBypassed('headphone')) {
      curveChips.push({
        curve: 'headphone',
        label: t('graph.curve.headphone'),
      });
    }
    if (!isBypassed('eq')) {
      curveChips.push({ curve: 'eq', label: t('graph.curve.eq') });
    }
    if (voicing?.profileId && !isBypassed('voicing')) {
      curveChips.push({ curve: 'voicing', label: t('graph.curve.voicing') });
    }
    if (hasSmartEqLayer(smartEq) && !isBypassed('smart')) {
      curveChips.push({ curve: 'smart', label: t('graph.curve.smart') });
    }
    if (customFx && !isBypassed('custom') && hasCustomFxCurve(customFx)) {
      curveChips.push({ curve: 'custom', label: t('graph.curve.custom') });
    }
    // The output curve is drawn whenever there is more than one layer to add
    // up, switched on or not — see the note by `hasExtraLayers` — so its chip
    // follows that rule rather than the others, or the line would be on the
    // plot with nothing naming it.
    if (
      convolution ||
      Math.abs(preAmp) > 0.01 ||
      voicing?.profileId ||
      driver?.profileId ||
      hasHeadphoneLayer(headphone) ||
      hasSmartEqLayer(smartEq) ||
      hasCustomFxCurve(customFx)
    ) {
      curveChips.push({ curve: 'total', label: t('graph.curve.total') });
    }
  }

  /**
   * Whether the chips fit, measured rather than guessed at a breakpoint.
   *
   * A media query would have to assume how wide six of them are, and that
   * changes with the layers in the chain and with the window: this row is
   * right-aligned over the plot, and the plot is whatever is left after the
   * sidebar. So the natural width is remembered from the last time they were
   * laid out and compared against the room there is now — which is also what
   * stops it oscillating, since the collapsed row is narrower than the
   * threshold that collapsed it.
   */
  const legendGroup = useRef<HTMLSpanElement>(null);
  const naturalLegendWidth = useRef(0);
  const [areChipsCollapsed, setAreChipsCollapsed] = useState(false);
  /**
   * How tall the floating strip actually is, so the plot can keep out from
   * under it. Measured by the observer that already watches this row, because
   * what changes the height is the row wrapping — the case no constant could
   * have covered.
   */
  const [controlsHeight, setControlsHeight] = useState(0);
  const chipKey = curveChips.map((chip) => chip.curve).join(',');

  useLayoutEffect(() => {
    const group = legendGroup.current;
    const row = group?.parentElement;
    if (!group || !row || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = () => {
      if (!areChipsCollapsed) {
        naturalLegendWidth.current = group.scrollWidth;
      }
      setAreChipsCollapsed(naturalLegendWidth.current > row.clientWidth);
      setControlsHeight(row.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(group);
    return () => observer.disconnect();
    // `chipKey` rather than the array: a new array every render would rebuild
    // the observer every render, and what actually changes the width is which
    // chips there are.
  }, [areChipsCollapsed, chipKey]);
  const prevFilters = useRef<IFiltersMap>({});
  // Read by the window key handler, which is registered once and must not be
  // torn down and rebuilt every time a band moves.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const prevFilterLines = useRef<IChartLineDataPointsById>({});
  const pendingPointEdits = useRef<Record<string, PendingPointEdit>>({});
  const pointEditTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  /**
   * What a drag is measured from: the pointer, and every band's starting value.
   *
   * IT USED TO BE MEASURED FROM THE CURVE, and that was two bugs in one line.
   * Each band recorded the height of the drawn response at its own frequency,
   * and a move applied the difference between the pointer and that height.
   *
   * The first bug is that the two were not the same curve. The dot is drawn on
   * a response built with no preamp; the origin was built with the real one, so
   * the very first move — before the cursor had travelled a pixel — produced a
   * gain delta of exactly minus the preamp. Auto-normalise makes that negative
   * whenever the chain boosts, so a band jumped UP by the whole headroom the
   * instant it was touched. Two commits drifted apart: one aligned the origin
   * with the drawn curve, a later one changed the drawn curve and left the
   * origin behind.
   *
   * The second is that a handle is thirteen pixels across and only its centre
   * sits on the curve. Grabbing an edge snapped the band by the difference,
   * every time, because nothing recorded where the grab actually landed.
   *
   * Both go away by measuring the drag against the pointer instead. `grab` is
   * where the press happened in chart units; a move applies the difference from
   * there to each band's own starting frequency and gain. The rendered curve is
   * not consulted at all, so it cannot disagree with anything, and grabbing an
   * edge simply means the cursor stays on that edge.
   */
  const pointDragState = useRef<
    | {
        sourceId: string;
        ids: string[];
        grab: IChartPointData;
        origins: Record<string, Pick<IFilter, 'frequency' | 'gain'>>;
      }
    | undefined
  >(undefined);

  const handlePointSelect = useCallback(
    (filterId: string, additive: boolean, grab: IChartPointData) => {
      let ids = [filterId];
      if (additive) {
        ids = selectedFilterIds.includes(filterId)
          ? selectedFilterIds.filter((id) => id !== filterId)
          : [...selectedFilterIds, filterId];
      } else if (selectedFilterIds.includes(filterId)) {
        ids = selectedFilterIds;
      }
      pointDragState.current = {
        sourceId: filterId,
        ids,
        grab,
        origins: Object.fromEntries(
          ids
            .map((id) => filters[id])
            .filter(Boolean)
            .map((filter) => [
              filter.id,
              { frequency: filter.frequency, gain: filter.gain },
            ]),
        ),
      };
      setSelectedFilterIds(ids);
    },
    [filters, selectedFilterIds, setSelectedFilterIds],
  );

  const flushPointEdit = useCallback(
    async (filterId: string) => {
      const timer = pointEditTimers.current[filterId];
      if (timer) {
        clearTimeout(timer);
        delete pointEditTimers.current[filterId];
      }
      const edit = pendingPointEdits.current[filterId];
      if (!edit) {
        return;
      }
      delete pendingPointEdits.current[filterId];

      try {
        // Send the latest values in one ordered batch so APO never sees a
        // half-updated point while it is being dragged.
        if (edit.frequency !== undefined) {
          await setFrequency(filterId, edit.frequency);
        }
        if (edit.gain !== undefined) {
          await setGain(filterId, edit.gain);
        }
        if (edit.quality !== undefined) {
          await setQuality(filterId, edit.quality);
        }
      } catch (error) {
        setGlobalError(error as ErrorDescription);
      }
    },
    [setGlobalError],
  );

  const queuePointEdit = useCallback(
    (filterId: string, edit: PendingPointEdit) => {
      pendingPointEdits.current[filterId] = {
        ...pendingPointEdits.current[filterId],
        ...edit,
      };
      if (!pointEditTimers.current[filterId]) {
        pointEditTimers.current[filterId] = setTimeout(() => {
          flushPointEdit(filterId);
        }, 90);
      }
    },
    [flushPointEdit],
  );

  const handlePointMove = useCallback(
    (filterId: string, point: IChartPointData) => {
      // Every band moves by how far the pointer has travelled since the press,
      // applied to what that band was when the press happened. See
      // `pointDragState` for why it is not measured against the drawn curve.
      const drag = pointDragState.current;
      if (!filters[filterId] || drag?.sourceId !== filterId) {
        // No press was recorded for this handle, so there is no distance to
        // measure and nothing safe to guess. Bailing out loses one frame of a
        // drag that cannot happen; the fallbacks that used to stand here
        // rebuilt an origin from the live filter on every move, which turned a
        // constant error into one that compounded.
        return;
      }
      const frequencyDelta =
        Math.max(MIN_FREQUENCY, Math.min(MAX_FREQUENCY, Math.round(point.x))) -
        drag.grab.x;
      const gainDelta =
        Math.round(Math.max(MIN_GAIN, Math.min(MAX_GAIN, point.y)) * 100) /
          100 -
        drag.grab.y;
      drag.ids.forEach((id) => {
        const filter = filters[id];
        const origin = drag.origins[id];
        if (!filter || !origin) {
          return;
        }
        const frequency = Math.round(
          Math.max(
            MIN_FREQUENCY,
            Math.min(MAX_FREQUENCY, origin.frequency + frequencyDelta),
          ),
        );
        const gain =
          Math.round(
            Math.max(MIN_GAIN, Math.min(MAX_GAIN, origin.gain + gainDelta)) *
              100,
          ) / 100;
        dispatchFilter({
          type: FilterActionEnum.FREQUENCY,
          id,
          newValue: frequency,
        });
        dispatchFilter({
          type: FilterActionEnum.GAIN,
          id,
          newValue: gain,
        });
        queuePointEdit(id, { frequency, gain });
      });
    },
    // No `preAmp`. It was here because the old arithmetic rebuilt the response
    // curve on every move; a drag measured from the pointer never asks what the
    // headroom is, which is the whole reason it cannot disagree with the dot.
    [dispatchFilter, filters, queuePointEdit],
  );

  const handlePointQualityWheel = useCallback(
    (filterId: string, direction: number) => {
      const filter = filters[filterId];
      if (!filter) {
        return;
      }
      let step = 1;
      if (filter.quality < 1) {
        step = 0.05;
      } else if (filter.quality < 10) {
        step = 0.1;
      }
      const ids = selectedFilterIds.includes(filterId)
        ? selectedFilterIds
        : [filterId];
      ids.forEach((id) => {
        const selectedFilter = filters[id];
        if (!selectedFilter) {
          return;
        }
        const quality =
          Math.round(
            Math.max(
              MIN_QUALITY,
              Math.min(MAX_QUALITY, selectedFilter.quality + direction * step),
            ) * 100,
          ) / 100;
        dispatchFilter({
          type: FilterActionEnum.QUALITY,
          id,
          newValue: quality,
        });
        queuePointEdit(id, { quality });
      });
    },
    [dispatchFilter, filters, queuePointEdit, selectedFilterIds],
  );

  const { chartData, autoPreAmpValue }: IGraphData = useMemo(
    () =>
      buildChartData({
        bypassed,
        convolution,
        customFx,
        driver,
        eqFormat,
        filters,
        graphicEq,
        hasConvolution,
        headphone,
        isAutoPreAmpOn,
        isSmartHeadroomOn,
        isEqQuiet,
        preAmp,
        prevFilterLines,
        prevFilters,
        smartEq,
        t,
        voicing,
      }),
    [
      bypassed,
      convolution,
      customFx,
      driver,
      eqFormat,
      filters,
      graphicEq,
      hasConvolution,
      headphone,
      isAutoPreAmpOn,
      isSmartHeadroomOn,
      isEqQuiet,
      preAmp,
      smartEq,
      t,
      voicing,
    ],
  );

  useEffect(() => {
    // The config writer owns automatic gain staging. Every edit that changes a
    // layer already ends in a flush, and flush.ts derives the final-chain
    // Preamp from the exact commands it is about to write. Sending this value
    // back through SET_PREAMP used to start a second full profile save and APO
    // flush for the same edit, whose writer then calculated the same value
    // again. During a quick drag those redundant async writes could also finish
    // against different revisions of the chain, making the displayed level
    // appear to keep walking down.
    //
    // The renderer has one job here: mirror the derived value into the disabled
    // slider and the final-output curve. It must not feed an automatic result
    // back into the state that produced it. When automatic mode is disabled the
    // user's manual preamp remains untouched.
    if (isAutoPreAmpOn && !isLoading && !globalError) {
      setPreAmp(autoPreAmpValue);
    }
  }, [autoPreAmpValue, globalError, isAutoPreAmpOn, isLoading, setPreAmp]);

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);

  const updateDimensions = useCallback(() => {
    const newWidth = ref.current?.clientWidth;
    if (newWidth && newWidth > 0) {
      setWidth(newWidth);
    }
    const newHeight = ref.current?.clientHeight;
    if (newHeight && newHeight > 0) {
      setHeight(newHeight);
    }
  }, []);

  const throttle = useThrottleAndExecuteLatest(updateDimensions, 100);

  useEffect(() => {
    window.addEventListener('resize', throttle);
    return () => window.removeEventListener('resize', throttle);
  }, [throttle]);

  /**
   * Watch the box itself, not the things thought to change it.
   *
   * The graph takes the height the editor above it does not want, so its box
   * moves whenever that content does — folding the reference picker, switching
   * to a tab whose panel is a different size, a dropdown opening. None of those
   * resize the window and none of them change the height in the store, so every
   * trigger this had missed them, and the plot stayed the size it was while its
   * card grew underneath it.
   */
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(throttle);
    observer.observe(element);
    return () => observer.disconnect();
  }, [throttle]);

  useLayoutEffect(() => {
    // Compute dimensions on initial render, when graph view is toggled, when
    // the pane grows to fill the window, and on every step of a drag on the
    // divider above — the box changes without the window ever firing a resize,
    // so nothing else would tell it.
    updateDimensions();
  }, [isFullScreen, isGraphViewOn, updateDimensions]);

  // Ctrl+S expands, Ctrl+F fills the screen, Ctrl+W swaps between the wave and
  // the EQ curves. Space walks the looks; Ctrl or Shift with it walks back.
  // Escape comes all the way back from either size.
  //
  // Every one of them is listed in the view menu, because a shortcut bound to
  // the window is fast once known and completely invisible until then.
  //
  // Bound to the window rather than to the graph, because the graph is an SVG
  // nobody has clicked and a key handler that only works after you have found
  // the right thing to focus is a key handler nobody discovers. The guards are
  // the price of that reach: a control that already does something with Space
  // — a button, a checkbox, an open menu — keeps it, and so does anything you
  // can type into. Missing one of those turns Space into "corrupt the field
  // you were editing".
  useEffect(() => {
    if (!isGraphViewOn) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Not while something is open in front of it.
        //
        // These are window-level handlers, so an Escape meant for the dialog on
        // screen — Report a problem, Fix audio problems, the view menu itself —
        // reached this as well and did both things at once: the dialog closed
        // and the graph dropped out of full screen behind it. Escape means
        // "close the nearest thing", and the nearest thing is whatever is over
        // the top.
        //
        // Matched on the elements that only exist while something is open, not
        // on `[role="menu"]`: the style picker puts that role on its *trigger*,
        // which is on screen the whole time, so testing for it blocked Escape
        // permanently and full screen became a mode with no way out.
        if (
          document.querySelector('.graph-view-menu__list, .dropdown--open') ||
          // Every one of these also has its own key handling, and a text field
          // in particular treats Escape as "cancel this edit".
          (event.target as HTMLElement | null)?.closest?.(
            'input, textarea, [contenteditable]',
          )
        ) {
          return;
        }
        // The look designer is a dialog of ours, so it is closed here rather
        // than left to the guard below. That guard only declines to act, which
        // for our own panel would mean Escape doing nothing at all — and it is
        // the innermost thing on screen, so it is what Escape means. Closing it
        // rather than the mode also matters because it holds an unsaved draft.
        if (isDesignerOpen) {
          closeDesigner();
          return;
        }
        if (document.querySelector('[role="dialog"]')) {
          return;
        }
        exitGraphFullScreen();
        return;
      }

      // The modified trio. Alt held is somebody reaching for a menu, and a
      // repeat is a key being leant on — neither should toggle a mode twice.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.repeat) {
        const key = event.key.toLowerCase();
        // Ctrl+A takes every band, so the whole tuning can be moved, retyped or
        // deleted in one gesture — the marquee already does this for a region
        // and there was no way to ask for all of it.
        //
        // Guarded on the target, unlike the toggles below, and that difference
        // is deliberate: in a text field Ctrl+A means "select this text", and
        // taking it would make the frequency and gain boxes the two places in
        // the app where the most reflexive shortcut there is quietly does
        // something else.
        if (key === 'a') {
          const typing = event.target as HTMLElement | null;
          if (
            typing?.isContentEditable ||
            typing?.closest('input, textarea, [contenteditable]')
          ) {
            return;
          }
          event.preventDefault();
          setSelectedFilterIds(Object.keys(filtersRef.current));
          return;
        }
        if (
          key === 's' ||
          key === 'f' ||
          key === 'w' ||
          key === 'g' ||
          key === 'b' ||
          key === 'i'
        ) {
          // Ctrl+S is Save and Ctrl+W is Close Window everywhere else, and
          // Chromium will do both from a renderer given the chance. There is
          // nothing to save here and closing the window is the titlebar's
          // business, so both are taken.
          event.preventDefault();
          if (key === 's') {
            toggleGraphExpanded();
          } else if (key === 'f') {
            toggleGraphFullScreen();
          } else if (key === 'g') {
            toggleGraphGrid();
          } else if (key === 'b') {
            toggleGraphStretch();
          } else if (key === 'i') {
            cycleWaveOrientation();
          } else {
            // Ctrl+W walks the five things the plot can show rather than
            // toggling one of two switches that each turn the other off. One of
            // the five is reachable no other way, which is why the View menu's
            // row for this names the state rather than only the action.
            cycleGraphContents();
          }
          return;
        }
      }

      if (event.code !== 'Space' || event.altKey || event.repeat) {
        return;
      }
      // Karaoke uses Space for its transport, including inside the Maker.
      // The response graph can remain visible below that tab, but it is not
      // the active keyboard context and must not cycle looks behind playback.
      if (
        document.querySelector(
          '.karaoke-workspace:not(.is-hidden):not([aria-hidden="true"])',
        )
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.closest(
          'input, textarea, select, button, [role="menu"], [role="menuitem"], [contenteditable]',
        )
      ) {
        return;
      }
      // Space scrolls by default, and the graph is the whole point of the pane
      // being looked at.
      event.preventDefault();
      cycleGraphLook(event.ctrlKey || event.metaKey || event.shiftKey ? -1 : 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isGraphViewOn, isDesignerOpen, closeDesigner, setSelectedFilterIds]);

  const dimensions: ChartDimensions = {
    width,
    height,
    margins: {
      // Headroom above the plot: enough that a curve at +20 dB is not shaved
      // off, and enough that the controls strip floating over the top does not
      // sit on the band handles.
      //
      // It was a flat thirty pixels, and the strip is taller than that before
      // it even wraps — so the top row of handles was underneath a row of
      // buttons that take pointer events, present on screen and impossible to
      // grab. See `plotTopMargin` for why this is measured rather than stated.
      top: plotTopMargin(isStretched, controlsHeight),
      // Air at the sides, so a curve running off the edge of the plot is not
      // cut flush against the card. With the grid hidden there is nothing to
      // read at the edges and the wave is better for having them.
      right: isGridHidden ? 0 : 30,
      // The frequency labels live down here, and with the grid hidden there is
      // nothing to leave room for.
      bottom: isStretched && isGridHidden ? 0 : 10,
      left: isGridHidden ? 0 : 30,
    },
  };

  /**
   * Whether the frames are still arriving, watched on the chart's behalf.
   *
   * Only solo consults it — see `SilenceWatch`, which is mounted only in that
   * mode, and which is the only thing here that sees a frame at all.
   */
  const [hasRecentAudio, setHasRecentAudio] = useState(false);

  /**
   * The curves the user is editing, or nothing.
   *
   * Soloing drops the EQ layers rather than hiding them with an opacity: a curve
   * at zero alpha is still a path being rebuilt whenever a band moves, and the
   * point of this mode is to be left with the one drawing and nothing else. They
   * come back when the music has been gone long enough to believe.
   */
  const displayData = useMemo(
    () =>
      isSolo && hasRecentAudio
        ? []
        : // Anything switched off in the legend is dropped rather than drawn
          // transparent, for the same reason solo drops these wholesale: a path
          // at zero alpha is still rebuilt every time a band moves.
          //
          // The scale is still built from the full list further down, so hiding
          // a curve does not rescale the axis under the ones left. A grid that
          // moves when you take a line off it makes the remaining lines look
          // like they changed.
          chartData.filter(
            (curve) => !hiddenCurves.includes(CURVE_BY_CHART_ID[curve.id]),
          ),
    [chartData, hasRecentAudio, hiddenCurves, isSolo],
  );

  /**
   * How to draw the live trace — not what to draw, which the canvas reads for
   * itself.
   *
   * Nothing at all when the wave is hidden, because hidden means gone rather
   * than transparent: an empty list takes the canvas out of the document, where
   * a zero opacity would leave every frame of work being done for a drawing
   * nobody can see.
   *
   * Rebuilt only when one of these choices changes, which is when somebody uses
   * a control. That is the whole trick — this array is what used to carry three
   * hundred points and change twenty-two times a second.
   */
  const liveCurves = useMemo<ILiveCurveData[]>(() => {
    if (isWaveHidden) {
      return [];
    }
    // Held back only while there is something to hold it back for.
    //
    // The live trace is dimmed because it is context for the curve being edited
    // — one of four layers under the response, and at full strength they fight.
    // Solo removes every one of them, so the reason to dim it goes with them:
    // what was left was the one drawing on screen, drawn at half strength for
    // the benefit of curves that are no longer there.
    const opacity = isSolo ? 1 : SUPPORTING_CURVE_OPACITY;
    const isHalfHeight =
      waveOrientation === 'mirrored' || waveOrientation === 'centred';
    // The compact size draws the wave at half its amplitude against whichever
    // edge the orientation anchors it to — along the bottom of the screen
    // upright, along the top hanging, and a smaller pair at both edges for the
    // two-copy orientations.
    const heightScale = waveSize === 'compact' ? COMPACT_WAVE_SCALE : 1;
    return [
      // Hanging from the top, or mirrored below as well. Drawn first so the
      // upright copy lands over it.
      ...(isHalfHeight
        ? [
            {
              isFlipped: true,
              isHalfHeight: true,
              isFromCentre: waveOrientation === 'centred',
              heightScale,
              colour: ColorEnum.ANALOGOUS2,
              opacity,
            },
          ]
        : []),
      {
        isFlipped: waveOrientation === 'down',
        isHalfHeight,
        isFromCentre: waveOrientation === 'centred',
        heightScale,
        colour: ColorEnum.ANALOGOUS2,
        opacity,
      },
    ];
  }, [isSolo, isWaveHidden, waveOrientation, waveSize]);

  const editablePoints: IEditableChartPoint[] = useMemo(() => {
    // Sliders are ordered by frequency, so use the exact same ordering when
    // assigning the spectrum palette to graph points. The point and its
    // corresponding slider therefore always share one color.
    const sortedFilters = Object.values(filters).sort(
      (a, b) => a.frequency - b.frequency,
    );
    const colorsById = new Map(
      sortedFilters.map((filter, index) => {
        const progress =
          sortedFilters.length > 1 ? index / (sortedFilters.length - 1) : 0;
        return [filter.id, getBandColor(progress)] as const;
      }),
    );
    const eqCurve = chartData.find((curve) => curve.id === 'EQ Response')?.line
      .points;

    return Object.values(filters).map((filter) => {
      const bandColor = colorsById.get(filter.id) || getBandColor(0);
      // Where the curve puts it, or — when there is no curve, because the EQ is
      // switched off or hidden — where the band itself sits. Plain gain rather
      // than gain plus preamp, matching the curve now that the curve is drawn
      // from zero; the old fallback jumped every handle by the headroom on any
      // frame the curve was missing.
      const curveGain = eqCurve
        ? getLineGainAtFrequency(eqCurve, filter.frequency)
        : filter.gain;
      return {
        id: filter.id,
        name: `${filter.type} band`,
        color: bandColor.color,
        mutedColor: bandColor.muted,
        // Place each dot on the rendered EQ response at its frequency. This
        // keeps dots aligned after converting between 6/10/15/31-band layouts.
        data: { x: filter.frequency, y: curveGain },
        selected: selectedFilterIds.includes(filter.id),
        hovered: hoveredFilterId === filter.id,
        onSelect: (additive: boolean, grab: IChartPointData) =>
          handlePointSelect(filter.id, additive, grab),
        onHover: (isHovered: boolean) =>
          setHoveredFilterId(isHovered ? filter.id : ''),
        onChange: (point: IChartPointData) => handlePointMove(filter.id, point),
        onCommit: () => {
          const drag = pointDragState.current;
          const ids = drag?.sourceId === filter.id ? drag.ids : [filter.id];
          ids.forEach((id) => flushPointEdit(id));
          if (drag?.sourceId === filter.id) {
            pointDragState.current = undefined;
          }
        },
        onQualityWheel: (direction: number) =>
          handlePointQualityWheel(filter.id, direction),
      };
    });
  }, [
    filters,
    chartData,
    flushPointEdit,
    handlePointMove,
    handlePointQualityWheel,
    handlePointSelect,
    hoveredFilterId,
    selectedFilterIds,
    setHoveredFilterId,
  ]);

  return isGraphViewOn ? (
    <div
      className={`graph-wrapper${!isEngineUsable ? ' is-engine-disabled' : ''}${
        bypassed.includes('eq') ? ' is-eq-bypassed' : ''
      }${areHandlesHidden ? ' is-handles-hidden' : ''}${
        isGridHidden ? ' is-gridless' : ''
      }${isStretched ? ' is-stretched' : ''}${
        isDesignerOpen ? ' is-designing' : ''
      }`}
      aria-disabled={!isEngineUsable}
      // Read by the full-screen rules only. Handed down as variables rather
      // than as a style on the card itself, because what they actually apply to
      // is the surface layer behind the drawing — see GraphTheme.
      style={
        {
          // The euphoria border used to be handed down here as a custom
          // property, because the trace was a path and its attributes were
          // rewritten every frame. The trace draws itself now and reads the
          // width straight off the look, so there is nothing left to inherit.
          '--graph-overlay-opacity': overlayOpacity,
          // The whole filter, so that no blur is the keyword `none` rather than
          // `blur(0px)` — which is still a filter, and still costs a
          // compositing layer re-composited every frame to change nothing.
          '--graph-overlay-filter':
            overlayBlur > 0 ? `blur(${overlayBlur}px)` : 'none',
        } as CSSProperties
      }
    >
      {/* `is-idle` only ever does anything in full screen — the store that sets
          it is not watching in any other mode, so the class is simply never on
          elsewhere. Kept unconditional here rather than gated on the mode as
          well, because two things deciding the same question is how they come
          to disagree. */}
      <div className={`live-output-controls${isChromeIdle ? ' is-idle' : ''}`}>
        {/* One pane for the whole right-hand cluster.

            The card used to be on the style picker alone, which left the
            legends naming the curves — EQ response, Voicing, Driver — floating
            on the grid beside it, so half the row had a surface and half did
            not. They belong together: they are all captions and controls for
            the same drawing. */}
        {/* THE WAY OUT, ON SCREEN RATHER THAN ONLY ON A KEY.
            Escape has always left this mode and still does, but a full-screen
            graph over a video hides every other exit — the tab strip is gone
            and the View menu is a dropdown somebody has to open to discover
            what it does. First in the row, where a back control belongs. */}
        {isFullScreen && (
          <button
            type="button"
            className="graph-fullscreen-exit"
            onClick={exitGraphFullScreen}
            title={t('graph.view.exitFullscreen')}
            aria-label={t('graph.view.exitFullscreen')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
        )}
        <span className="graph-legend-group" ref={legendGroup}>
          {/* First in the cluster rather than alone at the left of the strip.

              Out there it shared the corner with the creature in full screen
              and the two were drawn over each other — and pushing one or the
              other around by a fixed amount is a fix that lasts until something
              else changes width. In the group it travels with the controls and
              cannot collide with anything that is not in the group.

              Only while there is something to drag: solo and a hidden EQ curve
              both take the band handles off the plot, so every one of these
              gestures does nothing, and instructions for controls that are not
              on screen read as controls that have stopped working. */}
          {!isSolo && !areHandlesHidden && !areChipsCollapsed && (
            <span className="graph-edit-hint">
              Drag points · Ctrl/Shift select · Ctrl+scroll: Q
            </span>
          )}
          {/* Every chip is its curve's switch.

              The legend already had the two things a control needs — it names
              the curve and it carries its colour — and it sat there inert while
              the plot got to six lines. Six is a tangle, and the question being
              asked of it is almost always about two of them.

              This hides a drawing and nothing else. Taking a layer *out* is the
              chip in the row above the editor, which rewrites the Equalizer APO
              config and is audible; the two are deliberately at opposite ends of
              the screen.

              Behind one button when the strip runs out of room. The row is
              right-aligned over the plot, so chips that do not fit do not stop
              at an edge — they push the picker and the menu off the left of the
              card. */}
          {areChipsCollapsed && curveChips.length > 0 ? (
            <CurveLegendMenu chips={curveChips} />
          ) : (
            curveChips.map((chip) => (
              <CurveLegend
                key={chip.curve}
                curve={chip.curve}
                label={chip.label}
              />
            ))
          )}
          {/* The legend is the control.
            
            Clicking the plot itself drags bands, so the picker needed its own
            place — and the label that already names the live output is the
            honest one, because it says what the choice changes. Forty looks is
            more than a cycle can reasonably walk, hence a searchable list. */}
          <span
            className={`graph-legend graph-legend--live graph-legend--picker${
              isWaveHidden ? ' is-hidden' : ''
            }`}
          >
            {/* Named separately from the value so the two can look like what
              they are: a caption, and the thing it captions. Run together they
              read as one long legend nobody realises is clickable.

              The caption is the switch, like every chip to its left — the one
              curve on the plot that could not be turned off from the legend was
              the only one that moves. Its swatch is a wave rather than a rule,
              because a straight line is what all six other curves are drawn as
              and this is the one that never is. */}
            <button
              type="button"
              className="graph-legend__label"
              aria-pressed={!isWaveHidden}
              title={t(isWaveHidden ? 'graph.show' : 'graph.hide', {
                item: t('graph.item.wave'),
              })}
              onClick={toggleGraphWave}
            >
              <svg
                className="graph-legend__wave"
                viewBox="0 0 16 12"
                aria-hidden
              >
                <path d="M1 6c1.4 0 1.4-4 2.8-4s1.4 8 2.8 8 1.4-8 2.8-8 1.4 4 2.8 4" />
              </svg>
              {t('graph.liveOutput')}
            </button>
            {/* Arrows either side of the name, so walking the looks never
                depends on where the keyboard is pointing.

                Space and Ctrl+Space still do it, and stop the moment somebody
                clicks the video: the guest takes focus and every key after that
                belongs to the page, so Space pauses the video instead of
                changing the drawing. That is exactly when somebody is most
                likely to want a different one, and a mouse is already in their
                hand. */}
            <button
              type="button"
              className="graph-look-step"
              aria-label={t('graph.style.previous')}
              title={`${t('graph.style.previous')} (Ctrl+Space)`}
              disabled={isWaveHidden}
              onClick={() => cycleGraphLook(-1)}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M10 3.5l-4 4.5 4 4.5" />
              </svg>
            </button>
            {/* The selection, not the resolved look: while the designer is open
                the chart draws an unsaved draft whose id is in no list, and a
                picker handed that id would go blank. */}
            <Dropdown
              name="live-output-style"
              menuClassName="graph-look-menu"
              options={graphLookOptions}
              value={selectedLookId}
              isDisabled={isWaveHidden}
              isFilterable
              filterPlaceholder={t('graph.style.search')}
              placement="down"
              handleChange={setGraphLook}
            />
            <button
              type="button"
              className="graph-look-step"
              aria-label={t('graph.style.next')}
              title={`${t('graph.style.next')} (Space)`}
              disabled={isWaveHidden}
              onClick={() => cycleGraphLook(1)}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M6 3.5l4 4.5-4 4.5" />
              </svg>
            </button>
            {/* How the chosen form is coloured.

                It used to be three rows of every form in the list itself, so
                the picker was a hundred and forty-one entries and stepping to
                the next FORM took three clicks. One control cycling the three
                palettes says the same thing in the space of a button.

                Disabled on a look somebody built, which carries the palette it
                was designed with — a control that quietly did nothing when it
                was pressed would be worse than one that says it cannot. */}
            <button
              type="button"
              className="graph-look-step graph-look-step--toggle"
              aria-pressed={graphPalette !== 'signal'}
              aria-label={`${t('look.palette.cycle')}: ${t(
                PALETTE_LABEL_KEYS[graphPalette],
              )}`}
              title={`${t('look.palette.cycle')}: ${t(
                PALETTE_LABEL_KEYS[graphPalette],
              )}`}
              disabled={isWaveHidden || !isPaletteSelectable}
              onClick={() =>
                setGraphPalette(
                  GRAPH_PALETTES[
                    (GRAPH_PALETTES.indexOf(graphPalette) + 1) %
                      GRAPH_PALETTES.length
                  ],
                )
              }
            >
              {/* A ramp: three bars climbing in weight, which is what all
                  three palettes are — one flat, one across the axis, one up
                  it. Opacity rather than colour, so it takes the button's
                  own lit and dimmed states like every other glyph here. */}
              <svg viewBox="0 0 16 16" aria-hidden>
                <rect x="2" y="9" width="3" height="5" opacity="0.4" />
                <rect x="6.5" y="6" width="3" height="8" opacity="0.7" />
                <rect x="11" y="2.5" width="3" height="11.5" />
              </svg>
            </button>
            {/* Make one of your own.

                Next to the picker because it is the same decision carried one
                step further: the list answers "which of these", and this answers
                "none of these, quite". The label says which of the two things it
                will do, since opening it on a look somebody made edits that look
                rather than starting another. */}
            <button
              type="button"
              className={`graph-solo${isDesignerOpen ? ' is-on' : ''}`}
              // There is nothing to design against with the wave switched off:
              // every control in the panel is judged by what it does to a
              // drawing that is not there.
              disabled={isWaveHidden}
              onClick={() =>
                isDesignerOpen ? closeDesigner() : openDesigner()
              }
              aria-pressed={isDesignerOpen}
              title={(() => {
                if (isWaveHidden) {
                  return t('graph.design.showWave');
                }
                return isDesignerOpen
                  ? t('graph.design.closeHint')
                  : t('graph.design.createHint');
              })()}
            >
              {(() => {
                if (isDesignerOpen) {
                  return t('graph.design.close');
                }
                return customLooks.some((look) => look.id === selectedLookId)
                  ? t('graph.design.edit')
                  : t('graph.design.new');
              })()}
            </button>
            {/* Solo — the wave with every curve dropped — had a button here and
              no longer does. It is the last stop of Ctrl+W, and as a control
              of its own it was the odd one in a row where everything else names
              a single drawing and switches that: this one took away five and
              was labelled for the one it kept. The row is also the thing that
              runs out of width first, and this was a whole pill of it. */}
            {/* The see-through and blur sliders used to sit here, between this
              and the menu. They are in the menu now — they only exist in full
              screen, they are the widest things the row ever held, and the row
              is right-aligned, so arriving in the mode shoved everything else
              left and on a narrow window pushed it under the waveform. */}
            {/* The two washes over the plot, switchable without opening the
              menu — the same pair of questions as the wave chip at the other
              end of the row, and asked just as often while watching.

              Icon only, and deliberately. The notes above record that this row
              is the first thing to run out of width and that the sliders were
              moved into the menu for exactly that reason; two more labelled
              pills would be the same mistake with different words. The drawing
              is the label: columns for the listening bands, because they are
              blocks standing on the axis rather than a line, and a ruled square
              for the grid.

              They stay in the menu as well. This is a shortcut to the two that
              change what the plot looks like most, not a move. */}
            <button
              type="button"
              className="graph-look-step graph-look-step--toggle"
              aria-pressed={!isCoverageHidden}
              aria-label={t(isCoverageHidden ? 'graph.show' : 'graph.hide', {
                item: t('graph.item.bands'),
              })}
              title={t(isCoverageHidden ? 'graph.show' : 'graph.hide', {
                item: t('graph.item.bands'),
              })}
              onClick={toggleGraphCoverage}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M3 13V8.5M6.3 13V5M9.7 13V6.8M13 13V3.5" />
              </svg>
            </button>
            <button
              type="button"
              className="graph-look-step graph-look-step--toggle"
              aria-pressed={!isGridHidden}
              aria-label={t(isGridHidden ? 'graph.show' : 'graph.hide', {
                item: t('graph.item.grid'),
              })}
              title={t(isGridHidden ? 'graph.show' : 'graph.hide', {
                item: t('graph.item.grid'),
              })}
              onClick={toggleGraphGrid}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" />
              </svg>
            </button>
            {/* Last, at the right-hand end of the row, in every mode. Both sizes
              live here, and every shortcut that reaches them; Escape gets back
              from either. */}
            <GraphViewMenu
              view={graphView}
              onChangeView={setGraphView}
              onCycleLook={cycleGraphLook}
              isWaveHidden={isWaveHidden}
              onToggleWave={toggleGraphWave}
              curveToggles={curveChips}
              hiddenCurves={hiddenCurves}
              onToggleCurve={toggleGraphCurve}
              contents={graphContents}
              onCycleContents={cycleGraphContents}
              isGridHidden={isGridHidden}
              onToggleGrid={toggleGraphGrid}
              isCoverageHidden={isCoverageHidden}
              onToggleCoverage={toggleGraphCoverage}
              isMeterHidden={isMeterHidden}
              onToggleMeter={toggleGraphMeter}
              isTitlebarWaveHidden={isTitlebarWaveHidden}
              onToggleTitlebarWave={toggleTitlebarWave}
              waveSize={waveSize}
              onToggleStretch={toggleGraphStretch}
              waveOrientation={waveOrientation}
              onCycleOrientation={cycleWaveOrientation}
              overlayOpacity={overlayOpacity}
              onChangeOverlayOpacity={setOverlayOpacity}
              overlayBlur={overlayBlur}
              onChangeOverlayBlur={setOverlayBlur}
              minOverlayOpacity={MIN_OVERLAY_OPACITY}
              maxOverlayBlur={MAX_OVERLAY_BLUR}
              hasTopBar={hasTopBar}
              onToggleTopBar={toggleFullScreenTopBar}
            />
          </span>
        </span>
        {/* Its own subscriber, so that a badge which is absent almost all of the
            time does not wake the graph up to say so. */}
        <LiveClipWarning />
      </div>
      {/* Its own subscriber, in the wrapper rather than the control strip:
          the strip's height sets the plot's headroom, and a badge that comes
          and goes must not be able to move the drawing. */}
      <LookAnnouncement />
      {/* Only solo cares whether the music stopped, because it is the only mode
          where silence puts something back on the graph. Outside it nothing here
          watches the frames at all, and the chart re-renders when a band moves
          and at no other time. */}
      {isSolo && <SilenceWatch onChange={setHasRecentAudio} />}
      {/* The measured box, and the card around it are now two different things.
          They used to be one, which is fine while the plot fills the card and
          wrong the moment it should not: in full screen the card covers the
          whole column so the frosting sits over all of the video, while the
          drawing keeps a sensible height in the middle of it. Measuring the
          card there would stretch the plot to the full height of the window,
          which is the one thing a frequency response should not do. */}
      {/* What Ctrl+W just did, over the middle of the plot for a moment.
          A shortcut that rearranges five things at once is quick to use and
          impossible to learn: the drawing changes and nothing says which of the
          five you are now in. Keyed on the announcement rather than its words,
          so cycling back to a mode you were in a second ago animates again
          instead of reusing an element whose entrance is already over. */}
      {modeAnnouncement.label && (
        <div
          key={modeAnnouncement.id}
          className="graph-mode-announce"
          role="status"
        >
          {modeAnnouncement.label}
        </div>
      )}
      <div className="graph-plot" ref={ref}>
        {isLoading ? (
          <div className="center full row">
            <Spinner />
          </div>
        ) : (
          <Chart
            data={displayData}
            // The band curves, which are also the only curves: the live trace
            // is not in `data` at all any more, so nothing the analyser does can
            // make the y-extent memos rescan every point.
            scaleData={chartData}
            dimensions={dimensions}
            editablePoints={isSolo ? [] : editablePoints}
            liveCurves={liveCurves}
            onMarqueeSelect={(ids, additive) =>
              setSelectedFilterIds(
                additive ? [...new Set([...selectedFilterIds, ...ids])] : ids,
              )
            }
          />
        )}
      </div>
      {/* Inside the graph card, alongside the plot rather than over in a
          dialog of its own — what the panel is for is watching this chart
          change while the sliders move. Unmounted when closed, so the draft it
          holds is dropped with it. */}
      {isDesignerOpen && (
        <LookDesigner onClose={closeDesigner} isClosing={isDesignerClosing} />
      )}
    </div>
  ) : null;
};

export default FrequencyResponseChart;
