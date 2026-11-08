/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  MAX_PALETTE_STOPS,
  MIN_PALETTE_STOPS,
  PALETTE_PRESET_IDS,
  PALETTE_PRESETS,
  isEvenlySpaced,
  paletteColourAt,
  paletteCss,
  paletteStops,
  reversedPalette,
  type IScenePaletteValue,
} from 'common/scenePalette';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu from '../widgets/AnchoredMenu';
import Chevron from '../icons/Chevron';
import useChatPopover from './chat/useChatPopover';

/** A stop while the member has hold of it: its own key survives a reorder. */
interface IStop {
  key: number;
  colour: string;
  at: number;
}

/** Travel past this, in pixels, makes a press on a stop a drag. */
const PRESS_TRAVEL_PX = 3;
/** Dragged this far above or below the strip, a stop is let go to remove it. */
const TEAR_OFF_PX = 36;

const round = (value: number) => Math.round(value * 1000) / 1000;
const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

/** The stops in order, as a palette is saved: even spacing is said by nothing. */
const valueOf = (stops: readonly IStop[]): IScenePaletteValue => {
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  const positions = sorted.map((stop) => round(stop.at));
  return {
    stops: sorted.map((stop) => stop.colour),
    ...(isEvenlySpaced(positions) ? {} : { positions }),
  };
};

interface IStudioPaletteProps {
  label: string;
  value: IScenePaletteValue;
  disabled: boolean;
  canReset: boolean;
  /** Where Reset puts it, said on the button before it is pressed. */
  resetsTo: string;
  /** Live: the stage follows while a stop moves or a colour is picked. */
  onChange: (value: IScenePaletteValue) => void;
  /** Saved: a drag let go, a colour settled, a stop added or removed. */
  onCommit: (value: IScenePaletteValue) => void;
  onReset: () => void;
}

/**
 * A scene's palette in the Studio (contract 9, `scenePalette.ts`): its
 * gradient as the scene gets it, drawn from the same numbers, with a handle
 * at each stop. A press on the strip adds a stop of the colour already
 * there; a stop is dragged along to move it, pressed to pick its colour, and
 * removed by a right-click, by dragging it off the strip, or by Delete -
 * never below two. Presets, Reverse and Reset sit with its name.
 */
export default function StudioPalette({
  label,
  value,
  disabled,
  canReset,
  resetsTo,
  onChange,
  onCommit,
  onReset,
}: IStudioPaletteProps) {
  const { t } = useTranslation();
  const stripRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const keyed = (stop: { colour: string; at: number }): IStop => {
    nextKey.current += 1;
    return { key: nextKey.current, ...stop };
  };
  const [stops, setStops] = useState<IStop[]>(() =>
    paletteStops(value).map(keyed),
  );
  const [selected, setSelected] = useState<number | undefined>();
  const [tearing, setTearing] = useState<number | undefined>();
  const held = useRef<{
    key: number;
    pointer: number;
    startX: number;
    startY: number;
    moved: boolean;
    /** Dragged off the strip far enough to be removed when let go. */
    off: boolean;
  } | null>(null);
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const presets = useChatPopover();

  // The palette from outside - a save landing, a preset, Reset, the member's
  // AI - replaces the stops, except while a stop is held: the stage is
  // following the hand then, and the hand's stops are the newer ones.
  const outside = `${value.stops.join(',')}|${value.positions?.join(',') ?? ''}`;
  useEffect(() => {
    if (held.current) {
      return;
    }
    setStops(paletteStops(value).map(keyed));
    // `value` is read through its key: a parent's fresh object with the same
    // colours is the same palette.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by `outside`
  }, [outside]);

  const live = (next: IStop[]) => {
    setStops(next);
    onChange(valueOf(next));
  };
  const commit = (next: IStop[]) => {
    setStops(next);
    onCommit(valueOf(next));
  };

  const atOf = (clientX: number) => {
    const box = stripRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) {
      return 0;
    }
    return clampUnit((clientX - box.left) / box.width);
  };

  const canRemove = stops.length > MIN_PALETTE_STOPS;
  const canAdd = stops.length < MAX_PALETTE_STOPS;

  const remove = (key: number) => {
    if (!canRemove) {
      return;
    }
    setSelected(undefined);
    commit(stops.filter((stop) => stop.key !== key));
  };

  const openPicker = (key: number) => {
    setSelected(key);
    const picker = pickerRef.current;
    const stop = stops.find((each) => each.key === key);
    if (!picker || !stop) {
      return;
    }
    picker.value = stop.colour;
    picker.click();
  };

  // A press on the strip itself, not on a stop: a new stop there, of the
  // colour the gradient already has, so adding one changes nothing until it
  // is moved or recoloured.
  const onStripDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      disabled ||
      event.button !== 0 ||
      event.target !== event.currentTarget
    ) {
      return;
    }
    if (!canAdd) {
      return;
    }
    const at = atOf(event.clientX);
    const added = keyed({ colour: paletteColourAt(valueOf(stops), at), at });
    setSelected(added.key);
    commit([...stops, added]);
  };

  const onStopDown = (event: PointerEvent<HTMLButtonElement>, key: number) => {
    if (disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    held.current = {
      key,
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      off: false,
    };
    setSelected(key);
  };

  const onStopMove = (event: PointerEvent<HTMLButtonElement>) => {
    const hold = held.current;
    if (!hold || hold.pointer !== event.pointerId) {
      return;
    }
    if (
      !hold.moved &&
      Math.hypot(event.clientX - hold.startX, event.clientY - hold.startY) <
        PRESS_TRAVEL_PX
    ) {
      return;
    }
    hold.moved = true;
    const box = stripRef.current?.getBoundingClientRect();
    const off =
      box !== undefined &&
      canRemove &&
      (event.clientY < box.top - TEAR_OFF_PX ||
        event.clientY > box.bottom + TEAR_OFF_PX);
    hold.off = off;
    setTearing(off ? hold.key : undefined);
    live(
      stops.map((stop) =>
        stop.key === hold.key ? { ...stop, at: atOf(event.clientX) } : stop,
      ),
    );
  };

  const onStopUp = (event: PointerEvent<HTMLButtonElement>) => {
    const hold = held.current;
    if (!hold || hold.pointer !== event.pointerId) {
      return;
    }
    held.current = null;
    setTearing(undefined);
    if (!hold.moved) {
      openPicker(hold.key);
      return;
    }
    if (hold.off) {
      remove(hold.key);
      return;
    }
    commit(stops);
  };

  const onStopKey = (event: KeyboardEvent<HTMLButtonElement>, key: number) => {
    if (disabled) {
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove(key);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const step =
        (event.shiftKey ? 0.1 : 0.01) * (event.key === 'ArrowLeft' ? -1 : 1);
      live(
        stops.map((stop) =>
          stop.key === key ? { ...stop, at: clampUnit(stop.at + step) } : stop,
        ),
      );
    }
  };

  // The colour picker's own `change` is the moment a colour is settled; its
  // `input` (React's onChange) follows the pointer while it is chosen.
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) {
      return undefined;
    }
    const settle = () => onCommit(valueOf(stopsRef.current));
    picker.addEventListener('change', settle);
    return () => picker.removeEventListener('change', settle);
  }, [onCommit]);

  const onPicked = (colour: string) => {
    if (selected === undefined) {
      return;
    }
    live(
      stops.map((stop) =>
        stop.key === selected
          ? { ...stop, colour: colour.toLowerCase() }
          : stop,
      ),
    );
  };

  const drawn = valueOf(stops);
  const count = stops.length;
  const ordered = [...stops].sort((a, b) => a.at - b.at);

  return (
    <div className="studio-palette">
      <div className="studio-palette__head">
        <span className="studio-setting__label">{label}</span>
        <span className="studio-palette__tools">
          {/* The app's quiet outline buttons: Presets with the palette's own
              colours on it and the arrow every list-opener wears; Reverse and
              Reset as icons, named for the reader and the pointer. */}
          <button
            ref={presets.setAnchor}
            type="button"
            className="button small subtle studio-palette__tool studio-palette__tool--presets"
            aria-haspopup="dialog"
            aria-expanded={presets.isOpen}
            disabled={disabled}
            onClick={presets.toggle}
          >
            <span
              className="studio-palette__chip"
              style={{ background: paletteCss(drawn) }}
              aria-hidden
            />
            {t('studioPalette.presets')}
            <Chevron />
          </button>
          <button
            type="button"
            className="button small subtle studio-palette__tool"
            title={t('studioPalette.reverseHint')}
            aria-label={t('studioPalette.reverse')}
            disabled={disabled}
            onClick={() => onCommit(reversedPalette(drawn))}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13" />
            </svg>
          </button>
          <button
            type="button"
            className="button small subtle studio-palette__tool"
            title={resetsTo}
            aria-label={t('studio.settings.reset')}
            disabled={disabled || !canReset}
            onClick={onReset}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8a5 5 0 1 0 1.6-3.7" />
              <path d="M2.8 2.2v2.6h2.6" />
            </svg>
          </button>
        </span>
      </div>

      <div
        ref={stripRef}
        className={`studio-palette__strip${canAdd ? ' can-add' : ''}`}
        style={{ '--palette': paletteCss(drawn) } as CSSProperties}
        title={t('studioPalette.hint')}
        onPointerDown={onStripDown}
        role="group"
        aria-label={t('studioPalette.strip', { name: label, count })}
      >
        {ordered.map((stop, index) => (
          <button
            key={stop.key}
            type="button"
            className={`studio-palette__stop${stop.key === selected ? ' is-selected' : ''}${stop.key === tearing ? ' is-tearing' : ''}`}
            style={
              {
                '--at': stop.at,
                '--stop': stop.colour,
              } as CSSProperties
            }
            aria-label={t('studioPalette.stop', {
              index: index + 1,
              count,
              colour: stop.colour,
              percent: Math.round(stop.at * 100),
            })}
            disabled={disabled}
            onPointerDown={(event) => onStopDown(event, stop.key)}
            onPointerMove={onStopMove}
            onPointerUp={onStopUp}
            onPointerCancel={onStopUp}
            onKeyDown={(event) => onStopKey(event, stop.key)}
            onKeyUp={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                commit(stops);
              } else if (event.key === 'Enter' || event.key === ' ') {
                openPicker(stop.key);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              remove(stop.key);
            }}
          />
        ))}
        {/* Under the stop being recoloured, so the picker opens there. */}
        <input
          ref={pickerRef}
          type="color"
          className="studio-palette__picker"
          style={
            {
              '--at': stops.find((stop) => stop.key === selected)?.at ?? 0,
            } as CSSProperties
          }
          tabIndex={-1}
          aria-label={t('studioPalette.colour')}
          onChange={(event) => onPicked(event.target.value)}
        />
      </div>

      <AnchoredMenu
        anchor={presets.anchor}
        isOpen={presets.isOpen}
        role="dialog"
        className="studio-palette-presets"
        ariaLabel={t('studioPalette.presets')}
        align="left"
      >
        {PALETTE_PRESET_IDS.map((id) => {
          const preset = { stops: PALETTE_PRESETS[id] };
          return (
            <button
              key={id}
              type="button"
              className="studio-palette-presets__item"
              onClick={() => {
                presets.close();
                setSelected(undefined);
                onCommit(preset);
              }}
            >
              <span
                className="studio-palette-presets__swatch"
                style={{ background: paletteCss(preset) }}
                aria-hidden
              />
              <span className="studio-palette-presets__name">
                {t(`studioPalette.preset.${id}` as TranslationKey)}
              </span>
            </button>
          );
        })}
      </AnchoredMenu>
    </div>
  );
}
