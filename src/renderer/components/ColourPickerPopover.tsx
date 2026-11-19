/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { useTranslation } from '../utils/I18nContext';
import useLiveSlider from '../utils/useLiveSlider';
import {
  hexOfHsv,
  hsvOfHex,
  readHexColour,
  type IHsv,
} from '../utils/hsvColour';

/** The system's eyedropper (Chromium's EyeDropper), where the window has one. */
interface IEyeDropper {
  open: () => Promise<{ sRGBHex: string }>;
}
type TEyeDropperConstructor = new () => IEyeDropper;

const eyeDropperOf = (): TEyeDropperConstructor | undefined =>
  (window as unknown as { EyeDropper?: TEyeDropperConstructor }).EyeDropper;

/**
 * Painted frames between two of the window's restyles while a handle is
 * dragged: what a colour paints is often the whole window, one long frame
 * each, and the handle stuttered behind the pointer (Ivan, 2026-11-18:
 * "improve this component to be faster while dragging"). The field, the
 * hue bar, the hex and the new swatch move with every pointer step; the
 * window follows every few painted frames, and Accept or Cancel settle it
 * at once. Counted in frames the window paints (`useLiveSlider`), never in
 * milliseconds.
 */
const RESTYLE_REST_FRAMES = 4;

/** How far one arrow key moves a handle, and with Shift held. */
const STEP = 0.01;
const BIG_STEP = 0.1;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The cells a field shown through `shownAs` is painted in, across and down:
 * each is the window's rule run once, and the browser smooths them into the
 * field's size. Enough that a step between two never reads as a band.
 */
const FIELD_CELLS = { x: 28, y: 18 };

/** Stops of a hue bar shown through `shownAs`, one every ten degrees. */
const HUE_STOPS = 36;

/** `#rrggbb`'s channels, 0 to 255. */
const channelsOf = (hex: string): [number, number, number] => {
  const channel = (at: number) =>
    Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
  return [channel(0), channel(1), channel(2)];
};

/** Where in `element` a pointer stands, 0 to 1 across and down. */
const shareOf = (element: HTMLElement, event: PointerEvent<HTMLElement>) => {
  const box = element.getBoundingClientRect();
  return {
    x: clamp01((event.clientX - box.left) / box.width),
    y: clamp01((event.clientY - box.top) / box.height),
  };
};

/**
 * `next`, keeping `previous`'s hue where `next` has none to say. Black, a grey
 * and white read back from their hex with the hue at 0, so the bar jumped to
 * red whenever one was opened, typed or taken from the screen, and moving off
 * the grey into the field coloured it red, not with the hue the bar had stood
 * at (Ivan, 2026-11-18: "don't reset the tint ... so if the user wants to go
 * away from the start and into the colour zone, it tints on that colour").
 */
const keepingHue = (previous: IHsv, next: IHsv): IHsv =>
  next.s === 0 || next.v === 0 ? { ...next, h: previous.h } : next;

interface IColourPickerPopoverProps {
  /** The control it opens from. */
  anchor: HTMLElement | null;
  isOpen: boolean;
  /** What the colour is for, as its heading. */
  title: string;
  /** The colour when it opened, `#rrggbb`: what Cancel goes back to. */
  value: string;
  /** Every move, so what it colours follows the picker live. */
  onChange: (value: string) => void;
  /** Accept: the colour is kept. */
  onAccept: (value: string) => void;
  /** Cancel or Escape: the colour it opened with again. */
  onCancel: () => void;
  /**
   * Where the hue bar stands while the colour has no hue of its own (black,
   * a grey, white), in degrees: the hue the window still holds for it. Absent,
   * the bar keeps wherever it last stood.
   */
  hueWhenGrey?: number;
  /**
   * What each colour is shown as: the colour the window really paints for
   * it (Ivan, 2026-11-18: "we do need to keep in mind its brightness, that
   * needs to be controlled by the Brightness ... at 0 it should not show the
   * full bright spectrum"). The field, the hue bar and the swatches show
   * that; the hex is still the colour picked, which is what is kept. Absent,
   * every colour is shown as itself.
   */
  shownAs?: (hex: string) => string;
}

/**
 * The colour picker of FluidEQ's own (Ivan, 2026-11-18: "mejorar la
 * ventanita ... que maché con el estilo de Fluid, los bordes redondeados como
 * Fluid, y que tenga un botón de aceptar"): it opens from its swatch on the
 * menus' material, with the colour as a field of saturation and brightness,
 * a hue bar, the system's eyedropper to take a colour from anywhere on the
 * screen, the hex, the colour it opened with beside the new one, and Cancel
 * and Accept. The system's own picker it replaces was a grey box of the
 * operating system's with no way to say "keep it" or "never mind".
 */
export default function ColourPickerPopover({
  anchor,
  isOpen,
  title,
  value,
  onChange,
  onAccept,
  onCancel,
  hueWhenGrey,
  shownAs,
}: IColourPickerPopoverProps) {
  const { t } = useTranslation();
  const hexId = useId();
  const [hsv, setHsv] = useState<IHsv>(() =>
    keepingHue({ h: hueWhenGrey ?? 0, s: 1, v: 1 }, hsvOfHex(value)),
  );
  const [hexText, setHexText] = useState(value);
  // Opened again, from wherever the colour now stands.
  useEffect(() => {
    if (isOpen) {
      setHsv((previous) =>
        keepingHue(
          { ...previous, h: hueWhenGrey ?? previous.h },
          hsvOfHex(value),
        ),
      );
      setHexText(value);
    }
  }, [isOpen, value, hueWhenGrey]);

  const current = hexOfHsv(hsv);
  const live = useLiveSlider<string | undefined>(
    undefined,
    (hex) => {
      if (hex !== undefined) {
        onChange(hex);
      }
    },
    RESTYLE_REST_FRAMES,
  );
  const { set: follow, flush, drop } = live;
  const move = useCallback(
    (next: IHsv) => {
      setHsv(next);
      const hex = hexOfHsv(next);
      setHexText(hex);
      follow(hex);
    },
    [follow],
  );
  // Accept lands the newest colour now; Cancel forgets any still waiting,
  // so it cannot arrive after the colour it opened with is put back.
  const accept = useCallback(
    (hex: string) => {
      flush();
      onAccept(hex);
    },
    [flush, onAccept],
  );
  const cancel = useCallback(() => {
    drop();
    onCancel();
  }, [drop, onCancel]);

  // Only Accept and Cancel close it (Ivan, 2026-11-18: "the colour picker
  // closes by itself, this cannot happen, it only closes with Accept or
  // Cancel"): a press anywhere else used to be Cancel, so a drag that started
  // a hair outside the field, or a press beside it, threw the colour away.
  // Now a press outside is held back from everything under it, the menu the
  // picker opened from included, which would close and take it along.
  // Escape is still Cancel, the same answer from the keyboard.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const press = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (anchor?.contains(target) || isInsideAnchoredMenu(target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        cancel();
      }
    };
    // Both: the menus underneath close on `pointerdown` (`ActionsMenu`,
    // `RichPick`), others on `mousedown`.
    document.addEventListener('pointerdown', press, true);
    document.addEventListener('mousedown', press, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', press, true);
      document.removeEventListener('mousedown', press, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [isOpen, anchor, cancel]);

  const dragField = (event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) {
      return;
    }
    const { x, y } = shareOf(event.currentTarget, event);
    move({ ...hsv, s: x, v: 1 - y });
  };
  const dragHue = (event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) {
      return;
    }
    move({ ...hsv, h: shareOf(event.currentTarget, event).x * 360 });
  };
  const fieldKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? BIG_STEP : STEP;
    const moves: Record<string, Partial<IHsv>> = {
      ArrowLeft: { s: clamp01(hsv.s - step) },
      ArrowRight: { s: clamp01(hsv.s + step) },
      ArrowUp: { v: clamp01(hsv.v + step) },
      ArrowDown: { v: clamp01(hsv.v - step) },
    };
    const change = moves[event.key];
    if (change) {
      event.preventDefault();
      move({ ...hsv, ...change });
    }
  };
  const hueKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = (event.shiftKey ? BIG_STEP : STEP) * 360;
    const sign = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[
      event.key
    ];
    if (sign !== undefined) {
      event.preventDefault();
      move({ ...hsv, h: (hsv.h + sign * step + 360) % 360 });
    }
  };

  const EyeDropper = eyeDropperOf();
  const pickFromScreen = () => {
    if (!EyeDropper) {
      return;
    }
    new EyeDropper()
      .open()
      .then(({ sRGBHex }) => {
        const hex = readHexColour(sRGBHex);
        if (hex) {
          move(keepingHue(hsv, hsvOfHex(hex)));
        }
        return undefined;
      })
      // Escape while the eyedropper is out: nothing was picked, nothing to do.
      .catch(() => undefined);
  };

  const typeHex = (text: string) => {
    setHexText(text);
    const hex = readHexColour(text);
    if (hex) {
      setHsv((previous) => keepingHue(previous, hsvOfHex(hex)));
      // Typed, not dragged: one deliberate colour, applied at once, and
      // anything a drag left waiting is dropped behind it.
      drop();
      onChange(hex);
    }
  };

  const hueColour = hexOfHsv({ h: hsv.h, s: 1, v: 1 });
  const show = shownAs ?? ((hex: string) => hex);
  // The field as the window wears it: painted cell by cell on the hue's
  // square, again whenever the hue or the rule moves - not while the mark
  // moves over it. Held as state, not a ref: the menu puts its contents in
  // only once it has measured where to stand, a render after it opens.
  const [paint, setPaint] = useState<HTMLCanvasElement | null>(null);
  useLayoutEffect(() => {
    const context = paint?.getContext('2d');
    if (!shownAs || !context) {
      return;
    }
    const cells = context.createImageData(FIELD_CELLS.x, FIELD_CELLS.y);
    for (let y = 0; y < FIELD_CELLS.y; y += 1) {
      for (let x = 0; x < FIELD_CELLS.x; x += 1) {
        const hex = shownAs(
          hexOfHsv({
            h: hsv.h,
            s: x / (FIELD_CELLS.x - 1),
            v: 1 - y / (FIELD_CELLS.y - 1),
          }),
        );
        const at = (y * FIELD_CELLS.x + x) * 4;
        const [r, g, b] = channelsOf(hex);
        cells.data[at] = r;
        cells.data[at + 1] = g;
        cells.data[at + 2] = b;
        cells.data[at + 3] = 255;
      }
    }
    context.putImageData(cells, 0, 0);
  }, [paint, shownAs, hsv.h]);
  const hueBar = useMemo(() => {
    if (!shownAs) {
      return undefined;
    }
    const stops = Array.from({ length: HUE_STOPS + 1 }, (_, index) =>
      shownAs(hexOfHsv({ h: (index / HUE_STOPS) * 360, s: 1, v: 1 })),
    );
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [shownAs]);
  return (
    <AnchoredMenu
      anchor={anchor}
      isOpen={isOpen}
      className="colour-picker"
      role="dialog"
      ariaLabel={title}
      align="left"
    >
      <div className="colour-picker__head">
        <span className="colour-picker__title">{title}</span>
        <span className="colour-picker__compare" aria-hidden>
          <span style={{ background: show(value) }} />
          <span style={{ background: show(current) }} />
        </span>
      </div>
      <div
        className={`colour-picker__field${shownAs ? ' is-worn' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label={t('graph.sceneColours.field')}
        aria-valuetext={current.toUpperCase()}
        aria-valuenow={Math.round(hsv.s * 100)}
        style={{ '--hue': hueColour } as CSSProperties}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragField(event);
        }}
        onPointerMove={dragField}
        onKeyDown={fieldKeys}
      >
        {shownAs && (
          <canvas
            ref={setPaint}
            className="colour-picker__paint"
            width={FIELD_CELLS.x}
            height={FIELD_CELLS.y}
            aria-hidden
          />
        )}
        <span
          className="colour-picker__mark"
          style={
            {
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
              '--mark': show(current),
            } as CSSProperties
          }
        />
      </div>
      <div
        className="colour-picker__hue"
        style={hueBar ? { background: hueBar } : undefined}
        role="slider"
        tabIndex={0}
        aria-label={t('graph.sceneColours.hue')}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragHue(event);
        }}
        onPointerMove={dragHue}
        onKeyDown={hueKeys}
      >
        <span
          className="colour-picker__hue-mark"
          style={
            {
              left: `${(hsv.h / 360) * 100}%`,
              '--mark': show(hueColour),
            } as CSSProperties
          }
        />
      </div>
      <div className="colour-picker__row">
        {EyeDropper && (
          <button
            type="button"
            className="colour-picker__dropper"
            onClick={pickFromScreen}
            title={t('graph.sceneColours.dropper')}
            aria-label={t('graph.sceneColours.dropper')}
          >
            <svg viewBox="0 0 16 16" aria-hidden focusable="false">
              <path d="M10.4 2.6a1.9 1.9 0 0 1 2.7 2.7l-1.3 1.3.6.6-1 1-.6-.6-4.6 4.6H4.4v-1.8L9 5.8l-.6-.6 1-1 .6.6Z" />
              <path d="M2.8 13.6l1.6-1.6" />
            </svg>
          </button>
        )}
        <label className="colour-picker__hex" htmlFor={hexId}>
          <span>{t('graph.sceneColours.hex')}</span>
          <input
            id={hexId}
            value={hexText.toUpperCase()}
            spellCheck={false}
            maxLength={7}
            aria-invalid={readHexColour(hexText) === undefined}
            onChange={(event) => typeHex(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && readHexColour(hexText)) {
                accept(current);
              }
            }}
          />
        </label>
      </div>
      <div className="colour-picker__actions">
        <button type="button" className="button small subtle" onClick={cancel}>
          {t('graph.sceneColours.cancel')}
        </button>
        <button
          type="button"
          className="button small"
          onClick={() => accept(current)}
        >
          {t('graph.sceneColours.accept')}
        </button>
      </div>
    </AnchoredMenu>
  );
}
