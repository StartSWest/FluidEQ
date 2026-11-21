/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode, RefCallback } from 'react';
import openEqPresetTab from '../../eq/openEqPresetTab';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu from '../../widgets/AnchoredMenu';

interface IWavePresetPanelProps {
  anchor: HTMLElement | null;
  isOpen: boolean;
  /** Handed the panel as it is drawn (`useWaveMenu`). */
  arrive: RefCallback<HTMLDivElement>;
  close: () => void;
  /** What plays, at the head of the panel. */
  header: ReactNode;
  /** What can be done from here: the favourites, or a game's ways out. */
  children: ReactNode;
}

/**
 * The panel a press on the titlebar's plate opens (Ivan, 2026-11-20: "keep
 * what we have but make this look like that"): what plays at its head, what
 * can be done from here under it, and the Preset tab at its foot —
 * "mandatory instead of the button". The music's part is the favourites
 * (`WavePresetFavourites`); a game's is its two ways out.
 */
const WavePresetPanel = ({
  anchor,
  isOpen,
  arrive,
  close,
  header,
  children,
}: IWavePresetPanelProps) => {
  const { t } = useTranslation();
  return (
    <AnchoredMenu
      anchor={anchor}
      isOpen={isOpen}
      className="rich-pick__menu wave-preset-menu"
      ariaLabel={t('dsp.presets')}
    >
      <div
        ref={arrive}
        className="wave-preset-menu__inner"
        // The panel itself takes the focus when it is opened with the
        // pointer, so the arrows answer without a ring lighting anywhere.
        tabIndex={-1}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <div className="wave-preset-menu__head">{header}</div>
        {children}
        <button
          type="button"
          role="menuitem"
          className="wave-preset-menu__foot"
          onClick={() => {
            close();
            openEqPresetTab();
          }}
        >
          <span>{t('wavePreset.openTab')}</span>
          <MenuIcon name="arrowOut" className="wave-preset-menu__arrow" />
        </button>
      </div>
    </AnchoredMenu>
  );
};

export default WavePresetPanel;
