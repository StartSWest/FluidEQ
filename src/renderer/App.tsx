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

import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ErrorCode } from 'common/errors';
import './styles/App.scss';
import MainContent from './MainContent';
import { AquaProvider, useAquaContext } from './utils/AquaContext';
import PrereqMissingModal from './PrereqMissingModal';
import SideBar from './SideBar';
import FrequencyResponseChart from './graph/FrequencyResponseChart';
import PresetsBar from './PresetsBar';
import AutoEQ from './AutoEQ';
import DeviceProfiles from './DeviceProfiles';
import {
  deletePreset,
  getPresetListFromFiles,
  loadPreset,
  renamePreset,
  savePreset,
} from './utils/equalizerApi';

const APO_RESTART_RECOMMENDED_KEY = 'fluideq.apoRestartRecommended';

const AppContent = () => {
  const { isLoading, globalError, performHealthCheck } = useAquaContext();
  const [showAudioRestartRecommendation, setShowAudioRestartRecommendation] =
    useState(false);

  useEffect(() => {
    if (globalError?.code === ErrorCode.EQUALIZER_APO_NOT_INSTALLED) {
      localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
      return;
    }

    if (
      !isLoading &&
      !globalError &&
      localStorage.getItem(APO_RESTART_RECOMMENDED_KEY) === 'true'
    ) {
      setShowAudioRestartRecommendation(true);
    }
  }, [globalError, isLoading]);

  const handleConfigureEqualizerApo = async () => {
    const error =
      await window.electron.ipcRenderer.openEqualizerApoConfigurator();
    if (error) {
      window.alert(error);
      return;
    }
    localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
    setShowAudioRestartRecommendation(true);
  };

  const handleRestartWindowsAudio = async () => {
    if (
      !window.confirm(
        'Audio will stop for a few seconds and Windows will request administrator permission. Continue?'
      )
    ) {
      return;
    }

    const error = await window.electron.ipcRenderer.restartWindowsAudio();
    window.alert(
      error ||
        'Windows Audio restarted. Reopen any application that is still silent.'
    );
    if (!error) {
      localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
      setShowAudioRestartRecommendation(false);
      performHealthCheck();
    }
  };

  const dismissAudioRestartRecommendation = () => {
    localStorage.removeItem(APO_RESTART_RECOMMENDED_KEY);
    setShowAudioRestartRecommendation(false);
  };

  return (
    <>
      <header className="workspace-header">
        <div className="workspace-header__identity">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M5 24c6-13 12-13 18 0s12 13 20 0" />
            </svg>
          </div>
          <div>
            <div className="workspace-header__name">FluidEQ</div>
            <div className="workspace-header__tagline">
              Your sound. Every device. Automatically.
            </div>
          </div>
        </div>
        <div className="workspace-header__actions">
          {!isLoading && !globalError && (
            <>
              <button
                type="button"
                className="workspace-header__configure"
                onClick={handleRestartWindowsAudio}
              >
                Restart audio
              </button>
              <button
                type="button"
                className="workspace-header__configure"
                onClick={handleConfigureEqualizerApo}
              >
                Reconfigure APO
              </button>
            </>
          )}
          <div className="workspace-header__status">
            <span className={`status-dot${globalError ? ' error' : ''}`} />
            {isLoading
              ? 'Checking Equalizer APO'
              : globalError
                ? 'Equalizer APO unavailable'
                : 'Equalizer APO connected'}
          </div>
        </div>
      </header>
      {showAudioRestartRecommendation && (
        <aside className="audio-restart-notice" role="status">
          <span>
            Equalizer APO was installed or reconfigured. If audio is missing,
            reload Windows Audio instead of rebooting the PC.
          </span>
          <div className="audio-restart-notice__actions">
            <button type="button" onClick={handleRestartWindowsAudio}>
              Restart audio now
            </button>
            <button
              type="button"
              onClick={dismissAudioRestartRecommendation}
            >
              Dismiss
            </button>
          </div>
        </aside>
      )}
      <SideBar />
      <div className="middle-content">
        <AutoEQ />
        <MainContent />
      </div>
      <div className="right-content">
        <DeviceProfiles />
        <PresetsBar
          fetchPresets={getPresetListFromFiles}
          loadPreset={loadPreset}
          savePreset={savePreset}
          renamePreset={renamePreset}
          deletePreset={deletePreset}
        />
      </div>
      <FrequencyResponseChart />
      {globalError && (
        <PrereqMissingModal
          isLoading={isLoading}
          onRetry={performHealthCheck}
          errorMsg={globalError.shortError}
          actionMsg={globalError.action}
        />
      )}
    </>
  );
};

export default function App() {
  return (
    <AquaProvider>
      <Router>
        <Routes>
          <Route path="/" element={<AppContent />} />
        </Routes>
      </Router>
    </AquaProvider>
  );
}
