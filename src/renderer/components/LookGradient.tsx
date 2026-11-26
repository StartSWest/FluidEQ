/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import {
  PALETTE_PRESETS,
  PALETTE_PRESET_IDS,
  type TPalettePresetId,
} from 'common/scenePalette';
import {
  type ILookStop,
  LOOK_GRADIENT_STEPS,
  MAX_LOOK_STOPS,
  MIN_LOOK_STOPS,
  addLookStop,
  lookRampCss,
  lookRampFromStops,
  lookStopsFromColours,
  moveLookStop,
  recolourLookStop,
  removeLookStop,
  sameLookStops,
  stepOf,
} from 'common/lookGradient';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import LookColourPane from './LookColourPane';

// The look editor's colours (Ivan, 2026-11-26: "simplify so they can pick
// gradients easily instead of colour by colour, still with customizable
// keypoints"): ready-made gradients a click away, and the chosen one as one
// bar whose points can be added, moved, recoloured and taken away.

/** The Studio's stock palettes, laid on the bar as evenly spaced points. */
const PRESET_STOPS: ReadonlyArray<{
  id: TPalettePresetId;
  stops: ILookStop[];
}> = PALETTE_PRESET_IDS.map((id) => ({
  id,
  stops: lookStopsFromColours(PALETTE_PRESETS[id]),
}));

interface ILookGradientChipsProps {
  /** The window's colours as they are now, for the first chip. */
  windowStops: readonly ILookStop[];
  /** The look's own points, or none while it follows the window. */
  stops: readonly ILookStop[] | undefined;
  onFollowWindow: () => void;
  onPick: (stops: ILookStop[]) => void;
}

/**
 * Every ready-made gradient on screen at once, one click each, the window's
 * colours first: choosing is comparing, and a list behind a menu makes every
 * comparison an open and a close.
 */
export const LookGradientChips = ({
  windowStops,
  stops,
  onFollowWindow,
  onPick,
}: ILookGradientChipsProps) => {
  const { t } = useTranslation();
  const windowName = t('look.windowColours');
  return (
    <div
      className="look-gradient-chips"
      role="group"
      aria-label={t('look.gradients')}
    >
      <button
        type="button"
        className={`look-gradient-chips__chip look-gradient-chips__chip--window${
          stops ? '' : ' is-on'
        }`}
        style={{ backgroundImage: lookRampCss(lookRampFromStops(windowStops)) }}
        aria-label={windowName}
        aria-pressed={!stops}
        title={windowName}
        onClick={onFollowWindow}
      >
        {/* A window, so the chip says whose colours these are. */}
        <svg viewBox="0 0 12 10" aria-hidden focusable="false">
          <rect x="0.75" y="0.75" width="10.5" height="8.5" rx="1.5" />
          <path d="M0.75 3.25h10.5" />
        </svg>
      </button>
      {PRESET_STOPS.map((preset) => {
        const name = t(`studioPalette.preset.${preset.id}` as TranslationKey);
        const isOn = Boolean(stops && sameLookStops(stops, preset.stops));
        return (
          <button
            key={preset.id}
            type="button"
            className={`look-gradient-chips__chip${isOn ? ' is-on' : ''}`}
            style={{
              backgroundImage: lookRampCss(lookRampFromStops(preset.stops)),
            }}
            aria-label={name}
            aria-pressed={isOn}
            title={name}
            onClick={() => onPick(preset.stops)}
          />
        );
      })}
    </div>
  );
};

/** What the two ends of the bar mean on the graph, where they mean one thing. */
export type TLookGradientAxis = 'frequency' | 'loudness' | undefined;

const AXIS_ENDS: Record<
  'frequency' | 'loudness',
  readonly [TranslationKey, TranslationKey]
> = {
  frequency: ['look.axis.bass', 'look.axis.treble'],
  loudness: ['look.axis.quiet', 'look.axis.loud'],
};

/** How far one arrow press moves a point, and one with Shift held. */
const KEY_STEP = 1;
const SHIFT_KEY_STEP = 6;
/** Travel before a press on a point counts as a drag, not a click. */
const DRAG_SLOP_PX = 3;

interface ILookGradientBarProps {
  stops: readonly ILookStop[];
  axis: TLookGradientAxis;
  onChange: (stops: ILookStop[]) => void;
}

interface IOpenPane {
  index: number;
  anchor: HTMLElement;
  isOpen: boolean;
  colour: string;
  canRemove: boolean;
}

interface IDrag {
  index: number;
  from: readonly ILookStop[];
  startX: number;
  moved: boolean;
  /** Pressed on the bar, which added this point: a click opens its colours. */
  added: boolean;
}

const shareAcross = (track: HTMLElement, clientX: number) => {
  const box = track.getBoundingClientRect();
  return Math.max(
    0,
    Math.min(1, (clientX - box.left) / Math.max(1, box.width)),
  );
};

/**
 * The gradient as one bar, with its points hanging under it.
 *
 * Pressing the bar adds a point there, in the colour the gradient already
 * has at that place, and opens its colours; dragging moves a point, never
 * past its neighbours; a click on a point opens its colours, with Remove
 * among them while there are more than two. The bar is painted from the
 * very ramp the graph is handed (`lookRampFromStops`), so it cannot show one
 * gradient while the figure draws another.
 */
export const LookGradientBar = ({
  stops,
  axis,
  onChange,
}: ILookGradientBarProps) => {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<IDrag | undefined>(undefined);
  // What the pane shows is kept as it was opened and as it was last coloured,
  // so it closes looking the way it was rather than changing as it fades.
  const [pane, setPane] = useState<IOpenPane>();
  const isFull = stops.length >= MAX_LOOK_STOPS;
  const close = useCallback(
    () => setPane((current) => current && { ...current, isOpen: false }),
    [],
  );
  const openPane = (index: number, anchor: HTMLElement, from = stops) =>
    setPane({
      index,
      anchor,
      isOpen: true,
      colour: from[index].colour,
      canRemove: from.length > MIN_LOOK_STOPS,
    });

  const handleAt = (index: number) =>
    trackRef.current?.parentElement?.querySelector<HTMLElement>(
      `[data-stop="${index}"]`,
    ) ?? null;

  const moveTo = (event: PointerEvent<HTMLElement>) => {
    const { current } = drag;
    const track = trackRef.current;
    if (!current || !track) {
      return;
    }
    if (
      !current.moved &&
      Math.abs(event.clientX - current.startX) < DRAG_SLOP_PX
    ) {
      return;
    }
    current.moved = true;
    close();
    onChange(
      moveLookStop(
        current.from,
        current.index,
        shareAcross(track, event.clientX),
      ),
    );
  };

  const endDrag = () => {
    const { current } = drag;
    if (current?.added && !current.moved) {
      const anchor = handleAt(current.index);
      if (anchor) {
        openPane(current.index, anchor, current.from);
      }
    }
  };

  const pressTrack = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || event.button !== 0) {
      return;
    }
    const added = addLookStop(stops, shareAcross(track, event.clientX));
    if (!added) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      index: added.index,
      from: added.stops,
      startX: event.clientX,
      moved: false,
      added: true,
    };
    onChange(added.stops);
  };

  const pressStop = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      index,
      from: stops,
      startX: event.clientX,
      moved: false,
      added: false,
    };
  };

  const stopKeys = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    const by = event.shiftKey ? SHIFT_KEY_STEP : KEY_STEP;
    const step = stepOf(stops[index].at);
    const go = (to: number) => {
      event.preventDefault();
      onChange(moveLookStop(stops, index, to / LOOK_GRADIENT_STEPS));
    };
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      go(step - by);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      go(step + by);
    } else if (event.key === 'Home') {
      go(0);
    } else if (event.key === 'End') {
      go(LOOK_GRADIENT_STEPS);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      close();
      onChange(removeLookStop(stops, index));
    }
  };

  const ends = axis ? AXIS_ENDS[axis] : undefined;

  return (
    <div className="look-gradient">
      <div
        ref={trackRef}
        className={`look-gradient__track${isFull ? ' is-full' : ''}`}
        style={{ backgroundImage: lookRampCss(lookRampFromStops(stops)) }}
        title={
          isFull
            ? t('look.gradientFull', { count: MAX_LOOK_STOPS })
            : t('look.gradientHint')
        }
        aria-hidden
        onPointerDown={pressTrack}
        onPointerMove={moveTo}
        onPointerUp={endDrag}
        onLostPointerCapture={() => {
          drag.current = undefined;
        }}
      />
      <div className="look-gradient__stops">
        {stops.map((stop, index) => {
          const percent = Math.round(stop.at * 100);
          return (
            <button
              // Keyed by place: points never pass each other, so a point's
              // place in the list is which point it is.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              type="button"
              role="slider"
              data-stop={index}
              className={`look-gradient__stop${
                pane?.isOpen && pane.index === index ? ' is-open' : ''
              }`}
              style={{ left: `${stop.at * 100}%`, color: stop.colour }}
              aria-label={t('look.colourValue', {
                number: index + 1,
                colour: stop.colour,
              })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={`${stop.colour} ${percent}%`}
              onPointerDown={(event) => pressStop(index, event)}
              onPointerMove={moveTo}
              onLostPointerCapture={() => {
                // Read in the click that follows the release.
                if (drag.current && !drag.current.moved) {
                  drag.current = undefined;
                }
              }}
              onClick={(event) => {
                // `detail` is 0 for Enter and Space, which are never a drag
                // whatever a pointer left behind.
                const wasDrag = event.detail > 0 && drag.current?.moved;
                drag.current = undefined;
                if (wasDrag) {
                  return;
                }
                if (pane?.isOpen && pane.index === index) {
                  close();
                } else {
                  openPane(index, event.currentTarget);
                }
              }}
              onKeyDown={(event) => stopKeys(index, event)}
            />
          );
        })}
      </div>
      {ends && (
        <div className="look-gradient__ends" aria-hidden>
          <span>{t(ends[0])}</span>
          <span>{t(ends[1])}</span>
        </div>
      )}
      <LookColourPane
        anchor={pane?.anchor ?? null}
        isOpen={Boolean(pane?.isOpen)}
        title={
          pane
            ? t('look.colourValue', {
                number: pane.index + 1,
                colour: pane.colour,
              })
            : ''
        }
        colour={pane?.colour ?? '#000000'}
        onChange={(colour) => {
          if (pane) {
            setPane({ ...pane, colour });
            onChange(recolourLookStop(stops, pane.index, colour));
          }
        }}
        onClose={close}
        onRemove={
          pane?.canRemove
            ? () => onChange(removeLookStop(stops, pane.index))
            : undefined
        }
        removeLabel={
          pane ? t('look.removeColour', { number: pane.index + 1 }) : ''
        }
      />
    </div>
  );
};

interface ILookFlatColourProps {
  colour: string;
  onChange: (colour: string) => void;
}

/** A flat figure's one colour: the same pane, from one wide swatch. */
export const LookFlatColour = ({ colour, onChange }: ILookFlatColourProps) => {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  const name = t('look.colourValue', { number: 1, colour });
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className="look-gradient__flat"
        style={{ background: colour }}
        aria-label={name}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={colour}
        onClick={() => setIsOpen((current) => !current)}
      />
      <LookColourPane
        anchor={anchor}
        isOpen={isOpen}
        title={name}
        colour={colour}
        onChange={onChange}
        onClose={close}
      />
    </>
  );
};
