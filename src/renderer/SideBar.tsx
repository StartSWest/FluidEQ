/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { ErrorDescription } from 'common/errors';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { useCallback } from 'react';
import { setMainPreAmp } from './utils/equalizerApi';
import EqualizerEnablerSwitch from './components/EqualizerEnablerSwitch';
import AutoNormalizeModeControl from './components/AutoNormalizeModeControl';
import Knob from './widgets/Knob';
import './styles/SideBar.scss';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import GraphViewSwitch from './components/GraphViewSwitch';
import OutputLevelMeter from './graph/OutputLevelMeter';
import Spinner from './icons/Spinner';

interface SideBarProps {
  showGraphToggle: boolean;
  isGraphVisible?: boolean;
  /**
   * Whether the drawer is showing, on the widths where this is a drawer.
   *
   * Above the two-column breakpoint it is a column in the layout and this
   * changes nothing — the stylesheet only reads it below that width, where
   * the panel slides down from the titlebar the way the sound panel slides in
   * from the side.
   */
  isOpen?: boolean;
  onGraphVisibilityChange?: (next: boolean) => void | Promise<void>;
}

const SideBar = ({
  showGraphToggle,
  isGraphVisible,
  isOpen,
  onGraphVisibilityChange,
}: SideBarProps) => {
  const {
    isAutoPreAmpOn,
    isSmartHeadroomOn,
    isLoading,
    preAmp,
    setGlobalError,
    setPreAmp,
  } = useFluidEqContext();
  const { t } = useTranslation();

  const setGain = useCallback(
    async (newValue: number) => {
      try {
        await setMainPreAmp(newValue);
        setPreAmp(newValue);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [setGlobalError, setPreAmp],
  );

  return (
    <div className={`col side-bar center${isOpen ? ' is-open' : ''}`}>
      {isLoading ? (
        <div className="center full row">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="col center side-bar__control-card side-bar__engine">
            <span className="control-kicker">{t('sidebar.engine')}</span>
            <h4>{t('sidebar.systemEq')}</h4>
            <EqualizerEnablerSwitch id="equalizerEnabler" />
          </div>
          {/* A dial rather than the fader this was.
              The fader wanted three hundred pixels of a column that is one
              hundred and sixty wide — a track, a ceiling caption, a floor
              caption and a number field — which is most of the side bar spent
              on one control. The dial says the same thing in eighty: the
              sweep is the position, the number in the middle is the value.
              It is the same `Knob` the band inspector uses for Q, and it
              reads this range as an even one because a decibel scale that
              crosses zero has no ratio to be logarithmic about. */}
          <div className="side-bar__preamp">
            <h4>{t('sidebar.preamp')}</h4>
            <Knob
              name={t('sidebar.preampAria')}
              min={MIN_GAIN}
              max={MAX_GAIN}
              value={preAmp}
              step={0.01}
              unit="dB"
              isDisabled={isAutoPreAmpOn}
              handleChange={setGain}
            />
            {isAutoPreAmpOn && (
              /* Smart says so in as many words. The value moves on its own
                 while music plays, and a number that changes with nothing on
                 screen to explain it reads as a bug rather than a feature. */
              <p className="side-bar__preamp-note">
                {isSmartHeadroomOn
                  ? t('sidebar.preampSmart')
                  : t('sidebar.preampAuto')}
              </p>
            )}
          </div>
          <div className="col center auto-normalize-control side-bar__control-card side-bar__headroom">
            <span className="control-kicker">{t('sidebar.headroom')}</span>
            <h4>{t('sidebar.autoPreamp')}</h4>
            <AutoNormalizeModeControl id="autoPreAmpEnabler" />
          </div>
          {showGraphToggle ? (
            <div className="col center side-bar__control-card side-bar__response">
              <span className="control-kicker">{t('sidebar.visualizer')}</span>
              <h4>{t('sidebar.graphView')}</h4>
              <GraphViewSwitch
                id="graphViewEnabler"
                isOn={isGraphVisible}
                onToggle={onGraphVisibilityChange}
              />
              {/* Under the visualizer switch, because it answers the question
                  that switch raises: the graph says what the sound is shaped
                  like, this says how loud it actually is. The same component
                  as the plot's gutter meter — see its variant prop for why one
                  and not two. */}
              <OutputLevelMeter />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default SideBar;
