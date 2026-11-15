/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  SCENE_WINDOW_COLOUR_ROLES,
  type ISceneWindowColours,
  type TSceneWindowColourRole,
} from 'common/sceneWindowColours';
import { useTranslation } from '../utils/I18nContext';
import { skyFromWindowColours } from '../utils/sceneOwnColours';

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
  onChange: (role: TSceneWindowColourRole, value: string) => void;
  onCommit: (role: TSceneWindowColourRole, value: string) => void;
}

/**
 * One of the three: the colour on a button the width of its column, with its
 * name, what it paints and its hex, which opens the system's colour picker -
 * the Studio's single-colour control (`StudioColour.tsx`) laid out for three
 * side by side. The window follows the picker as it moves; the colour is
 * kept when the picker settles.
 */
function Swatch({
  role,
  value,
  changed,
  note,
  disabled,
  onChange,
  onCommit,
}: ISwatchProps) {
  const { t } = useTranslation();
  const picker = useRef<HTMLInputElement>(null);
  const id = useId();

  // The picker's own `change` is the moment the colour is settled; its
  // `input` (React's onChange) follows it while it is chosen.
  useEffect(() => {
    const element = picker.current;
    if (!element) {
      return undefined;
    }
    const settle = () => onCommit(role, element.value.toLowerCase());
    element.addEventListener('change', settle);
    return () => element.removeEventListener('change', settle);
  }, [onCommit, role]);

  const name = t(ROLE_NAME[role]);
  return (
    <label
      htmlFor={id}
      className={`window-colour-swatch${changed ? ' is-changed' : ''}`}
      style={{ '--swatch': value } as CSSProperties}
    >
      <span className="window-colour-swatch__well" aria-hidden />
      <span className="window-colour-swatch__name">{name}</span>
      <span className="window-colour-swatch__about">
        {note ?? t(ROLE_ABOUT[role])}
      </span>
      <span className="window-colour-swatch__hex">{value.toUpperCase()}</span>
      <input
        ref={picker}
        id={id}
        type="color"
        className="window-colour-swatch__input"
        value={value}
        disabled={disabled}
        aria-label={t('graph.sceneColours.pick', { role: name })}
        onChange={(event) => onChange(role, event.target.value.toLowerCase())}
      />
    </label>
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
  return (
    <div className="window-colour-swatches">
      {SCENE_WINDOW_COLOUR_ROLES.map((role) => (
        <Swatch
          key={role}
          role={role}
          value={colours[role]}
          changed={own !== undefined && own[role] !== colours[role]}
          note={
            role === 'glow' && glowUnused
              ? t('graph.sceneColours.glowUnused')
              : undefined
          }
          disabled={disabled}
          onChange={onChange}
          onCommit={onCommit}
        />
      ))}
    </div>
  );
}
