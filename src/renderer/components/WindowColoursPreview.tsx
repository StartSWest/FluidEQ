/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, type CSSProperties } from 'react';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import { useTranslation } from '../utils/I18nContext';
import pickedWindow from '../utils/pickedWindow';
import { skyFromWindowColours } from '../utils/sceneOwnColours';
import { DARK_KNEE, darkenSurfaces } from '../utils/sceneTintDark';
import { tintThemePalette } from '../utils/sceneTintPalette';
import { toneShadeOf } from '../utils/sceneTintStore';
import { useThemeShade } from '../utils/theme';
import { themeShadeTokens } from '../utils/themeShade';

/**
 * A small window painted in `colours` the way the real one would be at the
 * Brightness it is at now (Ivan, 2026-11-14, the tuning mockup's "live mini
 * window"): its floor, a pane and a field from the scene's surface, the power
 * key, a filled button and the curve in its accent, a switch and a pill for
 * "on" in its glow. Worked out with the window's own rules, never a
 * look-alike, so what it shows is what pressing the colour will do: colours
 * somebody named are worn as named (`pickedWindow`), light or dark by the
 * Brightness the pick leaves the window at, and colours worked out from a
 * palette lend their hue to the theme (`tintThemePalette`,
 * `darkenSurfaces`).
 */
export default function WindowColoursPreview({
  colours,
  named,
}: {
  colours: ISceneWindowColours;
  /** Whether the window wears `colours` as named. */
  named: boolean;
}) {
  const { t } = useTranslation();
  const shade = useThemeShade();
  const style = useMemo(() => {
    // At the Brightness the window is at: a surface picked never moves it
    // (Ivan, 2026-11-18), so the small window shows the colours as the window
    // will wear them, the white one on a white window (2026-11-17: "make the
    // inside white on the white theme").
    const worn = named ? pickedWindow(colours, shade, 'brightness') : undefined;
    if (worn) {
      return {
        '--preview-floor': worn.tokens['--surface-base'],
        '--preview-pane': worn.tokens['--surface-panel'],
        '--preview-field': worn.tokens['--surface-field'],
        '--preview-accent': worn.tokens['--accent'],
        '--preview-active': worn.tokens['--active'],
      } as CSSProperties;
    }
    const sky = skyFromWindowColours(colours);
    if (!sky) {
      return undefined;
    }
    const base = (at: number) =>
      themeShadeTokens(toneShadeOf('held', at)) as unknown as Record<
        string,
        string
      >;
    const palette = darkenSurfaces(
      tintThemePalette(base(shade), sky),
      tintThemePalette(base(DARK_KNEE), sky),
      shade,
    );
    const token = (name: string) => palette[name] ?? base(shade)[name] ?? '';
    return {
      '--preview-floor': token('--surface-base'),
      '--preview-pane': token('--surface-panel'),
      '--preview-field': token('--surface-field'),
      '--preview-accent': token('--accent'),
      '--preview-active': palette['--active'] ?? 'var(--active)',
    } as CSSProperties;
  }, [colours, named, shade]);
  if (!style) {
    return null;
  }
  return (
    <div
      className="window-colours-preview"
      style={style}
      role="img"
      aria-label={t('graph.sceneColours.preview')}
    >
      <span className="window-colours-preview__bar">
        <span className="window-colours-preview__logo" />
        <span className="window-colours-preview__wave">
          <svg viewBox="0 0 100 10" preserveAspectRatio="none">
            <path d="M0 5 Q6 1 12 5 T24 5 T36 5 T48 5 T60 5 T72 5 T84 5 T100 5" />
          </svg>
        </span>
      </span>
      <span className="window-colours-preview__body">
        <span className="window-colours-preview__side">
          <span className="window-colours-preview__power" />
          <span className="window-colours-preview__switch" />
        </span>
        <span className="window-colours-preview__pane">
          <span className="window-colours-preview__pills">
            <span className="window-colours-preview__pill is-filled" />
            <span className="window-colours-preview__pill is-on" />
          </span>
          <span className="window-colours-preview__curve">
            <svg viewBox="0 0 100 24" preserveAspectRatio="none">
              <path d="M0 15 C14 10 22 8 32 11 S52 18 66 12 S88 7 100 10" />
            </svg>
          </span>
        </span>
      </span>
    </div>
  );
}
