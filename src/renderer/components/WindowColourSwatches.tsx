/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState, type CSSProperties } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  SCENE_WINDOW_COLOUR_ROLES,
  type ISceneWindowColours,
  type TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import ColourPickerPopover from './ColourPickerPopover';
import { useTranslation } from '../utils/I18nContext';
import { skyFromWindowColours } from '../utils/sceneOwnColours';
import { useThemeShade } from '../utils/theme';
import { lightWindowOf } from '../utils/themeShade';

const ROLE_NAME: Record<TSceneWindowColourRole, TranslationKey> = {
  surface: 'graph.sceneColours.surface',
  accent: 'graph.sceneColours.accent',
  glow: 'graph.sceneColours.glow',
};

const ROLE_ABOUT: Record<TSceneWindowColourRole, TranslationKey> = {
  surface: 'graph.sceneColours.surfaceAbout',
  accent: 'graph.sceneColours.accentAbout',
  glow: 'graph.sceneColours.glowAbout',
};

interface ISwatchProps {
  role: TSceneWindowColourRole;
  value: string;
  changed: boolean;
  note?: string;
  disabled: boolean;
  /**
   * What the window paints in this role whatever is picked, shown in place
   * of the pick, with no picker: the white panes of a white window.
   */
  fixed?: string;
  onChange: (role: TSceneWindowColourRole, value: string) => void;
  onCommit: (role: TSceneWindowColourRole, value: string) => void;
}

/**
 * One of the three: the colour on a button the width of its column, with its
 * name, what it paints and its hex, which opens FluidEQ's colour picker
 * (`ColourPickerPopover.tsx`, Ivan, 2026-11-18). The window follows the
 * picker as it moves; Accept keeps the colour, Cancel puts back the one it
 * opened with.
 */
function Swatch({
  role,
  value,
  changed,
  note,
  disabled,
  fixed,
  onChange,
  onCommit,
}: ISwatchProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  // The colour it opened with, while it is open: Cancel goes back to it.
  const [opened, setOpened] = useState<string>();
  const cancel = () => {
    if (opened !== undefined) {
      onChange(role, opened);
    }
    setOpened(undefined);
  };

  const name = t(ROLE_NAME[role]);
  if (fixed !== undefined) {
    // Not a held control faded out over a colour it does not paint: the
    // colour the window really wears there, at full strength, and no way
    // to pick another (Ivan, 2026-11-17, of a faded swatch: "is that your
    // idea of disabled?").
    return (
      <div
        className="window-colour-swatch is-fixed"
        style={{ '--swatch': fixed } as CSSProperties}
      >
        <span className="window-colour-swatch__well" aria-hidden />
        <span className="window-colour-swatch__name">{name}</span>
        <span className="window-colour-swatch__about">{note}</span>
        <span className="window-colour-swatch__hex">{fixed.toUpperCase()}</span>
      </div>
    );
  }
  const isOpen = opened !== undefined;
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={`window-colour-swatch${changed ? ' is-changed' : ''}${isOpen ? ' is-open' : ''}`}
        style={{ '--swatch': value } as CSSProperties}
        disabled={disabled}
        aria-label={t('graph.sceneColours.pick', { role: name })}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        // A second press on it while it is open is Cancel, as a press
        // anywhere else is.
        onClick={() => (isOpen ? cancel() : setOpened(value))}
      >
        <span className="window-colour-swatch__well" aria-hidden />
        <span className="window-colour-swatch__name">{name}</span>
        <span className="window-colour-swatch__about">
          {note ?? t(ROLE_ABOUT[role])}
        </span>
        <span className="window-colour-swatch__hex">{value.toUpperCase()}</span>
      </button>
      <ColourPickerPopover
        anchor={anchor}
        isOpen={isOpen}
        title={name}
        value={opened ?? value}
        onChange={(next) => onChange(role, next)}
        onAccept={(next) => {
          setOpened(undefined);
          onCommit(role, next);
        }}
        onCancel={cancel}
      />
    </>
  );
}

interface IWindowColourSwatchesProps {
  colours: ISceneWindowColours;
  /** What a dot is measured against: the colours the scene comes with. */
  own: ISceneWindowColours | undefined;
  disabled?: boolean;
  onChange: (role: TSceneWindowColourRole, value: string) => void;
  onCommit: (role: TSceneWindowColourRole, value: string) => void;
}

/**
 * The three colours a scene lends the window, each changeable, a dot on any
 * that is no longer the scene's own. A glow too close to the red or the amber
 * that say off and wait says so, since the window keeps its own colour for
 * "on" then (`skyFromWindowColours`).
 */
export default function WindowColourSwatches({
  colours,
  own,
  disabled = false,
  onChange,
  onCommit,
}: IWindowColourSwatchesProps) {
  const { t } = useTranslation();
  const glowUnused = skyFromWindowColours(colours)?.active === null;
  // A white window keeps its panes white whatever the scene's surface is
  // (`pickedWindow.ts`), so the surface paints nothing there and its swatch
  // says so, held, rather than taking a colour nobody would see (Ivan,
  // 2026-11-17: "make sure it disables the surface").
  const whitePane = lightWindowOf(useThemeShade())?.tokens['--surface-panel'];
  return (
    <div className="window-colour-swatches">
      {SCENE_WINDOW_COLOUR_ROLES.map((role) => (
        <Swatch
          key={role}
          role={role}
          value={colours[role]}
          changed={own !== undefined && own[role] !== colours[role]}
          note={
            (role === 'glow' &&
              glowUnused &&
              t('graph.sceneColours.glowUnused')) ||
            (role === 'surface' &&
              whitePane !== undefined &&
              t('graph.sceneColours.surfaceUnused')) ||
            undefined
          }
          fixed={role === 'surface' ? whitePane : undefined}
          disabled={disabled}
          onChange={onChange}
          onCommit={onCommit}
        />
      ))}
    </div>
  );
}
