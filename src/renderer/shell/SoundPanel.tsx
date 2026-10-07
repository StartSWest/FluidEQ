/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Activity, type ComponentProps, type RefObject, useRef } from 'react';
import type { TAudioEngine } from 'common/audioEngine';
import { OFFICIAL_SITE_URL } from 'common/branding';
import DriverPicker from '../components/DriverPicker';
import EqModeCard from '../components/eqMode/EqModeCard';
import DeviceProfiles from '../DeviceProfiles';
import ExtraOutputs from '../ExtraOutputs';
import MenuIcon from '../icons/MenuIcon';
import PresetsBar from '../PresetsBar';
import SongSoundSwitch from '../components/SongSoundSwitch';
import {
  createPreset,
  deletePreset,
  getPresetListFromFiles,
  loadPreset,
  renamePreset,
  savePreset,
} from '../utils/equalizerApi';
import { useTranslation } from '../utils/I18nContext';

type TDeviceProfilesProps = ComponentProps<typeof DeviceProfiles>;

export interface ISoundPanelProps {
  panelRef: RefObject<HTMLDivElement | null>;
  /** Open over the page, as the drawer it is under the three columns. */
  isDrawerOpen: boolean;
  /** On screen, beside the page or over it. */
  isShown: boolean;
  isSliding: boolean;
  /** Its button: the drawer opened or shut, or the column folded. */
  onToggle: () => void;
  /** Asleep behind the amp, like the pages. */
  behindAmp: 'hidden' | 'visible';
  engine: TAudioEngine | null;
  isNoticeHidden: boolean;
  onConfigureApo: TDeviceProfilesProps['onConfigureApo'];
  onAttachFluidEngine: TDeviceProfilesProps['onAttachFluidEngine'];
}

/**
 * The sound panel at the right of the window: the output, the profiles that
 * play through it, a second output, and the driver.
 */
const SoundPanel = ({
  panelRef,
  isDrawerOpen,
  isShown,
  isSliding,
  onToggle,
  behindAmp,
  engine,
  isNoticeHidden,
  onConfigureApo,
  onAttachFluidEngine,
}: ISoundPanelProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className={`right-content${isDrawerOpen ? ' is-open' : ''}${
        isShown ? ' is-shown' : ''
      }${isSliding ? ' is-sliding' : ''}`}
    >
      <div className="right-content__panel" ref={panelRef}>
        {/* The panel's own button, at its top left, where the rail keeps
            it when the panel is folded (Ivan, 2026-09-27: "remove that
            center crappy handler, put the collapsible on the top left of
            the pane"). Beside the page it folds the column to its rail;
            under the three-column width and over a full-screen picture,
            where the panel opens over the page, it opens and shuts it. */}
        <div className="right-content__head">
          <button
            type="button"
            className="right-content__fold"
            aria-expanded={isShown}
            aria-label={t('app.soundPanel')}
            title={t('app.soundPanel')}
            onClick={onToggle}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <rect x="2" y="2.5" width="12" height="11" rx="1.6" />
              <path d="M10 2.5v11" />
              <path
                className="right-content__fold-arrow"
                d="M7.4 6.2 5.6 8l1.8 1.8"
              />
            </svg>
          </button>
        </div>
        <div ref={scrollRef} className="right-content__scroll" inert={!isShown}>
          {/* The EQ mode menu, pinned beside the graph it changes: first,
              because it is the one card here that belongs to the page beside
              it. Only on the EQ page (`eqModePin.ts`). */}
          <Activity mode={behindAmp}>
            <EqModeCard isPaneShown={isShown} scrollRef={scrollRef} />
          </Activity>
          {/* One card: the output you listen on, and under it the profiles
              that play through it. They were two cards, and the ON pill on
              a profile sat a card away from the output it was on. */}
          {/* Asleep behind the amp. Each reads what it shows again when it
              wakes: the preset list, the outputs and their profiles. */}
          <Activity mode={behindAmp}>
            <DeviceProfiles
              engine={engine}
              isNoticeHidden={isNoticeHidden}
              isPaneShown={isShown}
              onConfigureApo={onConfigureApo}
              onAttachFluidEngine={onAttachFluidEngine}
            >
              <PresetsBar
                fetchPresets={getPresetListFromFiles}
                loadPreset={loadPreset}
                savePreset={savePreset}
                createPreset={createPreset}
                renamePreset={renamePreset}
                deletePreset={deletePreset}
              />
              <SongSoundSwitch />
            </DeviceProfiles>
          </Activity>
          {/* Directly under the output picker: it is the same question asked
              twice over — that one chooses where the sound goes, this one
              adds a second somewhere. */}
          {/* Awake behind the amp: it plays the mirror to the second output
              (`useOutputMirror`), and asleep it would silence that output
              the moment the window became the amp. */}
          <ExtraOutputs engine={engine} isPaneShown={isShown} />
          {/* Sits with the output device because it answers the same question:
              what is this sound coming out of. */}
          <Activity mode={behindAmp}>
            <DriverPicker />
          </Activity>
        </div>
        <footer className="right-content__footer" inert={!isShown}>
          <a
            className="right-content__site"
            href={OFFICIAL_SITE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t('app.site.open')}
            title={t('app.site.open')}
          >
            <span>fluideq.com</span>
            <MenuIcon name="external" className="right-content__site-icon" />
          </a>
        </footer>
      </div>
    </div>
  );
};

export default SoundPanel;
