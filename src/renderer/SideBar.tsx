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
import { rememberManualPreAmp } from './utils/manualPreAmp';
import EqualizerEnablerSwitch from './components/EqualizerEnablerSwitch';
import AutoPreAmpEnablerSwitch from './components/AutoPreAmpEnablerSwitch';
import Slider from './components/Slider';
import './styles/SideBar.scss';
import { useFluidEqContext } from './utils/FluidEqContext';
import { useTranslation } from './utils/I18nContext';
import GraphViewSwitch from './components/GraphViewSwitch';
import OutputLevelMeter from './graph/OutputLevelMeter';
import Spinner from './icons/Spinner';

interface SideBarProps {
  showGraphToggle: boolean;
  isGraphVisible?: boolean;
  onGraphVisibilityChange?: (next: boolean) => void | Promise<void>;
}

const SideBar = ({
  showGraphToggle,
  isGraphVisible,
  onGraphVisibilityChange,
}: SideBarProps) => {
  const { isAutoPreAmpOn, isLoading, preAmp, setGlobalError, setPreAmp } =
    useFluidEqContext();
  const { t } = useTranslation();

  const setGain = useCallback(
    async (newValue: number) => {
      try {
        await setMainPreAmp(newValue);
        setPreAmp(newValue);
        // The only place a deliberate preamp is recorded. The slider is locked
        // while auto-normalize is on, so everything reaching here is somebody
        // moving a control — which is exactly what the switch gives back when
        // it is turned off again.
        rememberManualPreAmp(newValue);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [setGlobalError, setPreAmp],
  );

  // Only the fallback. SideBar.scss owns the track length so the preamp card
  // keeps one shape: deriving it from the active workspace tab made the whole
  // sidebar resize whenever the user switched between EQ and Convolution.
  const sliderHeight = '102px';

  return (
    <div className="col side-bar center">
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
          <div className="side-bar__preamp">
            <h4>{t('sidebar.preamp')}</h4>
            <div>{MAX_GAIN > 0 ? `+${MAX_GAIN}` : MAX_GAIN} dB</div>
            <Slider
              name={t('sidebar.preampAria')}
              min={MIN_GAIN}
              max={MAX_GAIN}
              value={preAmp}
              sliderHeight={sliderHeight}
              setValue={setGain}
              label={`${MIN_GAIN} dB`}
              isDisabled={isAutoPreAmpOn}
            />
            {isAutoPreAmpOn && (
              <p className="side-bar__preamp-note">{t('sidebar.preampAuto')}</p>
            )}
          </div>
          <div className="col center auto-normalize-control side-bar__control-card side-bar__headroom">
            <span className="control-kicker">{t('sidebar.headroom')}</span>
            <h4>{t('sidebar.autoPreamp')}</h4>
            <AutoPreAmpEnablerSwitch id="autoPreAmpEnabler" />
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
