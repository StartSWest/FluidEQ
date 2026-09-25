/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Chevron from '../icons/Chevron';
import TintIcon from '../icons/TintIcon';
import { useTranslation } from '../utils/I18nContext';
import { sceneTintSwatch } from '../utils/sceneTint';
import {
  SCENE_TINT_MODE_ABOUT,
  SCENE_TINT_MODE_SHORT_NAMES,
  SCENE_TINT_MODES,
  setSceneTintMode,
  useSceneTintMode,
  useShownSceneSky,
} from '../utils/sceneTintStore';
import AnchoredMenu from '../widgets/AnchoredMenu';
import ThemeShadeSlider from '../components/ThemeShadeSlider';
import BackdropVeilSlider from './BackdropVeilSlider';
import SceneTintBrightnessSlider from './SceneTintBrightnessSlider';

/**
 * What a Plus visualizer does to the window, as a named menu: the mode it is
 * in on the button; at the head of the menu the theme's own slider, Black to
 * a lighter Ocean, which every mode's colours stand on (Ivan, 2026-09-25:
 * "for plus viz is the same … make the root menu slider that"); all four
 * modes, each with what it does; and under them the chosen mode's own
 * sliders — Brightness for Colours and Ambient, Transparency and Brightness
 * for the Backdrop (Ivan, 2026-09-25: "make it available inside each mode …
 * under the ambient menu not the main one").
 *
 * It was a glyph walking the four (`SceneTintToggle`, which the player's
 * corner keys still are), and a glyph that cycles keeps three of its four
 * choices behind presses nobody knows to make: Ivan found Ambient itself
 * easy to miss ("a tiny icon that can pass desapercibido"). Choosing a mode
 * keeps the menu open, since its sliders are what comes next.
 *
 * Never disabled: the colour and the beat change the whole window whether or
 * not the wave is on the plot, and a control that could only be turned off
 * while something else was on would be a trap.
 */
const SceneTintMenu = () => {
  const { t } = useTranslation();
  const mode = useSceneTintMode();
  const sky = useShownSceneSky();
  const [isOpen, setIsOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const heading = t('graph.sceneTint.label');
  // On every glyph, not only the one in use: the menu is where the colour
  // each mode would lend is shown before it is picked.
  const swatch = sky
    ? ({ '--scene-tint-swatch': sceneTintSwatch(sky) } as CSSProperties)
    : undefined;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (
        !anchor.current?.contains(target) &&
        !content.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        anchor.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen]);

  return (
    <span className="graph-scene-look">
      <button
        ref={anchor}
        type="button"
        className={`graph-scene-look__trigger${mode === 'off' ? '' : ' is-on'}${
          isOpen ? ' is-open' : ''
        }`}
        style={swatch}
        aria-label={heading}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <TintIcon className="scene-tint-choice__glyph" mode={mode} />
        <span>{t(SCENE_TINT_MODE_SHORT_NAMES[mode])}</span>
        <Chevron className="arrow" />
      </button>
      <AnchoredMenu
        anchor={anchor.current}
        isOpen={isOpen}
        className="scene-look-menu"
        role="dialog"
        ariaLabel={heading}
      >
        <div ref={content} className="scene-look-menu__content">
          <div className="scene-look-menu__heading">{heading}</div>
          <div className="scene-look-menu__theme">
            <ThemeShadeSlider />
          </div>
          <div
            className="scene-look-menu__choices"
            role="radiogroup"
            aria-label={heading}
          >
            {SCENE_TINT_MODES.map((entry) => (
              <button
                key={entry}
                type="button"
                role="radio"
                aria-checked={entry === mode}
                className="scene-tint-choice"
                style={swatch}
                onClick={() => setSceneTintMode(entry)}
              >
                <TintIcon className="scene-tint-choice__glyph" mode={entry} />
                <span className="scene-tint-choice__name">
                  {t(SCENE_TINT_MODE_SHORT_NAMES[entry])}
                </span>
                <span className="scene-tint-choice__about">
                  {t(SCENE_TINT_MODE_ABOUT[entry])}
                </span>
              </button>
            ))}
          </div>
          {mode !== 'off' && (
            <div className="scene-look-menu__sliders">
              {mode === 'cover' && <BackdropVeilSlider />}
              <SceneTintBrightnessSlider mode={mode} />
            </div>
          )}
        </div>
      </AnchoredMenu>
    </span>
  );
};

export default SceneTintMenu;
