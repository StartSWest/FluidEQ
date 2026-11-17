/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hasGraphTilt } from 'common/graphAnalysis';
import { useTranslation } from '../utils/I18nContext';
import {
  TGraphCurve,
  toggleGraphCurve,
  toggleGraphWave,
  useGraphLegendHidden,
  useGraphLook,
  useHiddenCurves,
  useSceneLook,
} from '../utils/graphStyle';
import { useGraphAnalyserSlope } from '../utils/graphScaleSettings';
import { holdSlopeLine, playSlopeLine } from './slopeLineStore';
import {
  noteCornerLegendMoved,
  setCornerLegendElement,
} from './cornerLegendPlace';
import '../styles/GraphCornerLegend.scss';

export interface ICurveChip {
  curve: TGraphCurve;
  label: string;
}

/**
 * One legend entry: the name of a curve, its colour, and the switch that
 * shows or hides it.
 *
 * A component rather than a copy per curve because the pressed state, the
 * title and the class all move together — and because every one of them
 * subscribes to the same store, which is a line of hook per entry if they are
 * written out by hand.
 */
const CurveLegend = ({ curve, label }: ICurveChip) => {
  const { t } = useTranslation();
  const isHidden = useHiddenCurves().includes(curve);
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

interface IGraphCornerLegendProps {
  /** The curves the plot draws, in the chain's order (`curveChips`). */
  chips: ICurveChip[];
  isWaveHidden: boolean;
  /** No usable engine: the wave cannot be switched from here. */
  isWaveLocked: boolean;
}

/**
 * Shorter than this, the graph folds the block to a key of its colours: on a
 * 900x700 window the graph is 196px, and five names stood over its bass.
 */
const FOLD_BELOW_PX = 300;

/**
 * THE CURVES' NAMES IN A CORNER OF THE PLOT (Ivan, 2026-11-16: "we need the
 * legend on the left or on the right top instead of that legend line on the
 * graph, and make a toggle setting for hiding it"). They were chips along the
 * options row, between the drag hint and the look picker, and the row grew
 * with every layer in the chain until it folded behind a "Curves" button.
 * Here they stand one under another, under the row's band and inside the
 * scales, each still the switch for its own line, with the live output — the
 * wave's switch — last. View › Legend hides the block (`useGraphLegendHidden`).
 *
 * A child of the options row and placed against it, so it fades with the row
 * when the pointer rests and moves down when the row folds onto two lines.
 */
const GraphCornerLegend = ({
  chips,
  isWaveHidden,
  isWaveLocked,
}: IGraphCornerLegendProps) => {
  const { t } = useTranslation();
  const isHidden = useGraphLegendHidden();
  const block = useRef<HTMLDivElement>(null);
  const isShown = !isHidden && chips.length > 0;
  const [isFolded, setIsFolded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // The analyser's slope, while one is set and the drawing is one it tips
  // (Ivan, 2026-11-17: "perhaps we can show the line too when the legend
  // opens"): the legend gets a row for it, and showing or opening the legend
  // plays the slope's line once (`SlopeLine`).
  const slope = useGraphAnalyserSlope();
  const look = useGraphLook();
  const scene = useSceneLook();
  const hasSlope = slope !== 0 && !scene && hasGraphTilt(look.style);
  const isListShown = isShown && (!isFolded || isOpen);
  const wasListShown = useRef(isListShown);
  useEffect(() => {
    if (isListShown && !wasListShown.current && hasSlope) {
      playSlopeLine();
    }
    wasListShown.current = isListShown;
  }, [isListShown, hasSlope]);
  // The row going away under the pointer lets the line go too.
  useEffect(() => {
    if (!hasSlope || !isShown) {
      holdSlopeLine(false);
    }
    return () => holdSlopeLine(false);
  }, [hasSlope, isShown]);

  // The block, for the band labels to keep off it (`cornerLegendPlace.ts`),
  // and word whenever its box may have moved: its own size, or the row it
  // hangs from folding onto a second line. And whether the graph is too
  // short for it unfolded (`FOLD_BELOW_PX`).
  useLayoutEffect(() => {
    const element = block.current;
    if (!isShown || !element) {
      setCornerLegendElement(undefined);
      return undefined;
    }
    setCornerLegendElement(element);
    const wrapper = element.closest('.graph-wrapper');
    const measureHeight = () =>
      setIsFolded(
        wrapper instanceof HTMLElement && wrapper.clientHeight < FOLD_BELOW_PX,
      );
    measureHeight();
    if (typeof ResizeObserver === 'undefined') {
      return () => setCornerLegendElement(undefined);
    }
    const moved = new ResizeObserver(noteCornerLegendMoved);
    moved.observe(element);
    if (element.parentElement) {
      moved.observe(element.parentElement);
    }
    const height = new ResizeObserver(measureHeight);
    if (wrapper) {
      height.observe(wrapper);
    }
    return () => {
      moved.disconnect();
      height.disconnect();
      setCornerLegendElement(undefined);
    };
  }, [isShown]);

  if (!isShown) {
    return null;
  }
  return (
    <div
      ref={block}
      className={`graph-corner-legend${isFolded ? ' is-folded' : ''}${
        isFolded && isOpen ? ' is-open' : ''
      }`}
      role="group"
      aria-label={t('graph.switch.legend')}
      // Folded, the names open under the pointer as well (the stylesheet's
      // hover): that is the legend opening too.
      onPointerEnter={() => {
        if (isFolded && !isOpen && hasSlope) {
          playSlopeLine();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsOpen(false);
        }
      }}
    >
      {/* Folded, the block is a key of the curves' colours, the names
          opening under it on the pointer, on a press or under the keyboard,
          over the plot rather than pushing anything down. No tooltip: the
          names it opens are the answer, and a tooltip stood over the first. */}
      {isFolded && (
        <button
          type="button"
          className="graph-corner-legend__key"
          aria-expanded={isOpen}
          aria-label={t('graph.switch.legend')}
          onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        >
          {chips.map((chip) => (
            <span
              key={chip.curve}
              className={`graph-corner-legend__dot graph-legend--${chip.curve}`}
            />
          ))}
          <span className="graph-corner-legend__dot graph-legend--live" />
        </button>
      )}
      <div className="graph-corner-legend__list">
        {chips.map((chip) => (
          <CurveLegend key={chip.curve} curve={chip.curve} label={chip.label} />
        ))}
        {/* The live output's entry is the wave's switch, its swatch a wave
            rather than a rule: a straight line is what every other curve is
            drawn as, and this is the one that never is. */}
        <button
          type="button"
          className={`graph-legend graph-legend--live graph-corner-legend__live${
            isWaveHidden ? ' is-hidden' : ''
          }`}
          aria-pressed={!isWaveHidden}
          title={t(isWaveHidden ? 'graph.show' : 'graph.hide', {
            item: t('graph.item.wave'),
          })}
          disabled={isWaveLocked}
          onClick={toggleGraphWave}
        >
          <svg
            className="graph-corner-legend__wave"
            viewBox="0 0 16 12"
            aria-hidden
          >
            <path d="M1 6c1.4 0 1.4-4 2.8-4s1.4 8 2.8 8 1.4-8 2.8-8 1.4 4 2.8 4" />
          </svg>
          {t('graph.liveOutput')}
        </button>
        {/* The slope the analyser is tipped by: a sloped dash in the live
            output's colour and its value. Under the pointer its line is
            drawn across the plot for as long as it stays. */}
        {hasSlope && (
          <span
            className="graph-legend graph-legend--live graph-corner-legend__slope"
            onPointerEnter={() => holdSlopeLine(true)}
            onPointerLeave={() => holdSlopeLine(false)}
          >
            <svg
              className="graph-corner-legend__wave"
              viewBox="0 0 16 12"
              aria-hidden
            >
              <path d="M1.5 10.5l13-9" />
            </svg>
            {t('graph.legend.slope', { value: String(slope) })}
          </span>
        )}
      </div>
    </div>
  );
};

export default GraphCornerLegend;
