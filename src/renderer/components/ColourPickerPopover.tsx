/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useId,
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

/** Where in `element` a pointer stands, 0 to 1 across and down. */
const shareOf = (element: HTMLElement, event: PointerEvent<HTMLElement>) => {
  const box = element.getBoundingClientRect();
  return {
    x: clamp01((event.clientX - box.left) / box.width),
    y: clamp01((event.clientY - box.top) / box.height),
  };
};

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
  /** Cancel, Escape or a press elsewhere: the colour it opened with again. */
  onCancel: () => void;
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
}: IColourPickerPopoverProps) {
  const { t } = useTranslation();
  const hexId = useId();
  const [hsv, setHsv] = useState<IHsv>(() => hsvOfHex(value));
  const [hexText, setHexText] = useState(value);
  // Opened again, from wherever the colour now stands.
  useEffect(() => {
    if (isOpen) {
      setHsv(hsvOfHex(value));
      setHexText(value);
    }
  }, [isOpen, value]);

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

  // A press anywhere else, or Escape, is Cancel; neither reaches the menu
  // underneath, which would close too.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const press = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (anchor?.contains(target) || isInsideAnchoredMenu(target)) {
        return;
      }
      cancel();
    };
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        cancel();
      }
    };
    document.addEventListener('mousedown', press, true);
    document.addEventListener('keydown', key, true);
    return () => {
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
          move(hsvOfHex(hex));
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
      setHsv(hsvOfHex(hex));
      // Typed, not dragged: one deliberate colour, applied at once, and
      // anything a drag left waiting is dropped behind it.
      drop();
      onChange(hex);
    }
  };

  const hueColour = hexOfHsv({ h: hsv.h, s: 1, v: 1 });
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
          <span style={{ background: value }} />
          <span style={{ background: current }} />
        </span>
      </div>
      <div
        className="colour-picker__field"
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
        <span
          className="colour-picker__mark"
          style={
            {
              left: `${hsv.s * 100}%`,
              top: `${(1 - hsv.v) * 100}%`,
              '--mark': current,
            } as CSSProperties
          }
        />
      </div>
      <div
        className="colour-picker__hue"
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
              '--mark': hueColour,
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
