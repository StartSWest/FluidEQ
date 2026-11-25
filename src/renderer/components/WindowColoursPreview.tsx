/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createContext,
  useContext,
  useId,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { useTranslation } from '../utils/I18nContext';
import { useThemeShade } from '../utils/theme';
import {
  partWearers,
  previewPaintOf,
  type TOnSource,
  type TPreviewPart,
} from '../utils/windowColoursPreview';

/** Who says "on" in the small window, and whether its run is its own. */
const PaintContext = createContext<{ on: TOnSource; ownRun: boolean }>({
  on: 'second',
  ownRun: false,
});

/**
 * A part of the small window: which part of the big one it is, which of the
 * three colours it wears, and which one it stands in for - what the swatch
 * over it lights up (`WindowColoursPreview.scss`) and what the tests read.
 */
function Part({
  part,
  className,
  style,
  children,
}: {
  part: TPreviewPart;
  className: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const { on, ownRun } = useContext(PaintContext);
  const { wears, standsIn } = partWearers(part, on, ownRun);
  return (
    <span
      className={className}
      style={style}
      data-part={part}
      data-wears={wears.join(' ')}
      data-stands-in={standsIn.length > 0 ? standsIn.join(' ') : undefined}
    >
      {children}
    </span>
  );
}

/** The rail's processors, two on and one off: a lamp, a name, a switch. */
const RAIL = [
  { key: 'eq', isOn: true },
  { key: 'punch', isOn: true },
  { key: 'room', isOn: false },
] as const;

/** The spectrum's top edge, and the same closed down to the floor to fill. */
const SPECTRUM =
  'M0 15 C6 11 10 9 16 12 S26 8 32 10 S42 15 50 13 S60 9 68 14 S80 17 88 18 S96 20 100 21';

/**
 * A small FluidEQ painted in `colours` the way the real one would be at the
 * Brightness it is at now (Ivan, 2026-11-14, the tuning mockup's "live mini
 * window"; 2026-11-25: "this preview doesn't really show where the second
 * colour may be used"). Each part is a part of the window that wears its
 * colour (`windowColoursPreview.ts`): the floor, the panes and the graph's
 * field in the surface; a filled button, the chosen tab, the switches that
 * are on and the stage's curve in the accent; the rail's lamps, an ON badge,
 * the live dot and the spectrum in the second colour, which also ends the
 * title bar's wave and the meters' run from the accent. Where the second
 * colour cannot say "on", those parts wear what does instead. The colours
 * are worked out with the window's own rules, never a look-alike, so what
 * it shows is what pressing the colour will do.
 */
export default function WindowColoursPreview({
  colours,
  named,
  run,
}: {
  colours: ISceneWindowColours;
  /** Whether the window wears `colours` as named. */
  named: boolean;
  /**
   * What the window's colourful marks run through instead of the accent to
   * the second colour: the scene's own wave palette (`sceneAppColours.ts`),
   * or the window's own pair while these colours are only measured.
   */
  run?: readonly string[];
}) {
  const { t } = useTranslation();
  const shade = useThemeShade();
  const id = useId();
  const paint = useMemo(
    () => previewPaintOf(colours, named, shade, run),
    [colours, named, shade, run],
  );
  const context = useMemo(
    () => ({ on: paint?.on ?? 'second', ownRun: paint?.ownRun ?? false }),
    [paint],
  );
  if (!paint) {
    return null;
  }
  const floor = partWearers('floor', paint.on, paint.ownRun);
  const style = {
    '--preview-floor': paint.floor,
    '--preview-pane': paint.pane,
    '--preview-field': paint.field,
    '--preview-well': paint.well,
    '--preview-accent': paint.accent,
    '--preview-on-accent': paint.onAccent,
    '--preview-active': paint.active,
    '--preview-on-active': paint.onActive,
    '--preview-ink': paint.ink,
    '--preview-run': `linear-gradient(to top, ${paint.run.join(', ')})`,
  } as CSSProperties;
  const waveId = `${id}-wave`;
  const last = paint.run.length - 1;
  return (
    <PaintContext.Provider value={context}>
      <div
        className={`window-colours-preview${paint.isLight ? ' is-light' : ''}`}
        style={style}
        role="img"
        aria-label={t('graph.sceneColours.preview')}
        data-on={paint.on}
        data-part="floor"
        data-wears={floor.wears.join(' ')}
      >
        <span className="window-colours-preview__bar">
          <span className="window-colours-preview__mark" />
          <Part part="wave" className="window-colours-preview__wave">
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id={waveId}>
                  {paint.run.map((stop, index) => (
                    <stop
                      // eslint-disable-next-line react/no-array-index-key -- the run is always seven stops in order: a stop's place is its identity
                      key={index}
                      offset={index / last}
                      stopColor={stop}
                    />
                  ))}
                </linearGradient>
              </defs>
              <path
                d="M0 5 Q4 1 8 5 T16 5 T24 5 T32 5 T40 5 T48 5 T56 5 T64 5 T72 5 T80 5 T88 5 T96 5 T100 5"
                stroke={`url(#${waveId})`}
              />
            </svg>
          </Part>
          <Part part="meter" className="window-colours-preview__meter">
            {/* Near the top, where a loud moment reaches the second colour. */}
            <span style={{ '--level': '92%' } as CSSProperties} />
            <span style={{ '--level': '80%' } as CSSProperties} />
          </Part>
        </span>
        <span className="window-colours-preview__body">
          <Part part="pane" className="window-colours-preview__rail">
            {RAIL.map(({ key, isOn }) =>
              isOn ? (
                <span key={key} className="window-colours-preview__row is-on">
                  <Part part="lamp" className="window-colours-preview__lamp" />
                  <span className="window-colours-preview__label" />
                  <Part
                    part="switch"
                    className="window-colours-preview__switch"
                  />
                </span>
              ) : (
                <span key={key} className="window-colours-preview__row">
                  <span className="window-colours-preview__lamp" />
                  <span className="window-colours-preview__label" />
                  <span className="window-colours-preview__switch" />
                </span>
              ),
            )}
          </Part>
          <Part part="pane" className="window-colours-preview__page">
            <span className="window-colours-preview__tabs">
              <Part part="tab" className="window-colours-preview__tab" />
              <span className="window-colours-preview__tab" />
              <span className="window-colours-preview__tab" />
            </span>
            <Part part="field" className="window-colours-preview__graph">
              <Part
                part="spectrum"
                className="window-colours-preview__spectrum"
              >
                <svg
                  viewBox="0 0 100 24"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    className="window-colours-preview__spectrum-fill"
                    d={`${SPECTRUM} L100 24 L0 24 Z`}
                  />
                  <path
                    className="window-colours-preview__spectrum-edge"
                    d={SPECTRUM}
                  />
                </svg>
              </Part>
              <Part part="curve" className="window-colours-preview__curve">
                <svg
                  viewBox="0 0 100 24"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path d="M0 13 C12 12 18 6 28 7 S44 14 56 12 S76 5 86 8 S96 11 100 11" />
                </svg>
              </Part>
            </Part>
            <span className="window-colours-preview__foot">
              <Part part="badge" className="window-colours-preview__badge">
                <span />
              </Part>
              <Part part="live" className="window-colours-preview__live" />
              <Part part="button" className="window-colours-preview__button">
                <span />
              </Part>
            </span>
          </Part>
        </span>
      </div>
    </PaintContext.Provider>
  );
}
