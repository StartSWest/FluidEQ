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
import { useEffect, useState, type MouseEvent } from 'react';
import { ErrorCode } from 'common/errors';
import { SUPPORT_CONTRIBUTED_KEY, isSupportAvailable } from 'common/support';
import './styles/App.scss';
import MainContent from './MainContent';
import SupportDialog from './SupportDialog';
import SupportPet from './SupportPet';
import { AquaProvider, useAquaContext } from './utils/AquaContext';
import PrereqMissingModal from './PrereqMissingModal';
import SideBar from './SideBar';
import FrequencyResponseChart from './graph/FrequencyResponseChart';
import PresetsBar from './PresetsBar';
import AutoEQ from './AutoEQ';
import DeviceProfiles from './DeviceProfiles';
import DriverPicker from './components/DriverPicker';
import WaveformVisualizer from './WaveformVisualizer';
import ConvolutionPanel from './ConvolutionPanel';
import VoicingPanel from './VoicingPanel';
import { LiveAudioProvider } from './audio/LiveAudioContext';
import {
  deletePreset,
  getPresetListFromFiles,
  loadPreset,
  renamePreset,
  savePreset,
} from './utils/equalizerApi';

const APO_RESTART_RECOMMENDED_KEY = 'fluideq.apoRestartRecommended';

/**
 * Shipped build version, substituted by webpack at compile time. Empty in any
 * context that does not go through the bundler (a bare unit-test import), so
 * the badge is rendered conditionally rather than showing "vundefined".
 */
const APP_VERSION = process.env.FLUIDEQ_VERSION || '';

const AppContent = () => {
  const {
    isLoading,
    globalError,
    isBlockingError,
    isEnabled,
    performHealthCheck,
    setGlobalError,
  } = useAquaContext();
  const [showAudioRestartRecommendation, setShowAudioRestartRecommendation] =
    useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [showAudioToolsMenu, setShowAudioToolsMenu] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'eq' | 'voicing' | 'convolution'
  >('eq');
  // Hidden entirely unless this build has a real contribution destination
  // configured, so a misconfigured build shows no donate entry at all.
  const canShowSupport = isSupportAvailable();
  const [hasContributed, setHasContributed] = useState(
    () => localStorage.getItem(SUPPORT_CONTRIBUTED_KEY) === 'true',
  );

  useEffect(() => {
    let mounted = true;

    window.electron.ipcRenderer
      .isWindowMaximized()
      .then((maximized) => {
        if (mounted) {
          setIsWindowMaximized(maximized);
        }
        return undefined;
      })
      .catch(() => {
        // The window state is only visual; keep the restore control usable if
        // the main process is not ready during a hot reload.
      });

    const unsubscribe = window.electron.ipcRenderer.on(
      'window-state-changed',
      (...args: unknown[]) => {
        const state = args[0] as { isMaximized?: boolean } | undefined;
        setIsWindowMaximized(Boolean(state?.isMaximized));
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!showAudioToolsMenu) {
      return undefined;
    }

    const closeMenu = (event: Event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.workspace-header__tools')) {
        setShowAudioToolsMenu(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAudioToolsMenu(false);
      }
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showAudioToolsMenu]);

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

  const handleOpenEqualizerApoSettings = async () => {
    const error = await window.electron.ipcRenderer.openEqualizerApoSettings();
    if (error) {
      window.alert(error);
    }
  };

  const handleRestartWindowsAudio = async () => {
    if (
      !window.confirm(
        'Audio will stop for a few seconds and Windows will request administrator permission. Continue?',
      )
    ) {
      return;
    }

    const error = await window.electron.ipcRenderer.restartWindowsAudio();
    window.alert(
      error ||
        'Windows Audio restarted. Reopen any application that is still silent.',
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

  const handleMinimizeWindow = () => {
    window.electron.ipcRenderer.minimizeWindow().catch(() => undefined);
  };

  const handleToggleMaximizeWindow = async () => {
    const maximized = await window.electron.ipcRenderer.toggleMaximizeWindow();
    setIsWindowMaximized(maximized);
  };

  const handleCloseWindow = () => {
    window.electron.ipcRenderer.closeWindow().catch(() => undefined);
  };

  const handleTitlebarDoubleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) {
      return;
    }
    handleToggleMaximizeWindow().catch(() => undefined);
  };

  let connectionStatus = 'Equalizer APO connected';
  if (isLoading) {
    connectionStatus = 'Checking Equalizer APO';
  } else if (isBlockingError) {
    connectionStatus = 'Equalizer APO unavailable';
  }

  return (
    <>
      <header
        className="workspace-header window-titlebar"
        onDoubleClick={handleTitlebarDoubleClick}
      >
        <div className="workspace-header__identity">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M5 24c6-13 12-13 18 0s12 13 20 0" />
            </svg>
          </div>
          <div>
            <div className="workspace-header__name">
              FluidEQ
              {/* Inlined at build time from the same package.json
                  electron-builder versions the installer with, so a bug report
                  quoting this is quoting the real build. */}
              {APP_VERSION && (
                <span className="workspace-header__version">
                  v{APP_VERSION}
                </span>
              )}
            </div>
            <div className="workspace-header__tagline">
              Your sound. Every device. Automatically.
            </div>
          </div>
        </div>
        <WaveformVisualizer />
        <div className="window-titlebar__right">
          {canShowSupport && (
            <SupportPet
              hasContributed={hasContributed}
              onOpen={() => setShowSupportDialog(true)}
            />
          )}
          <div className="workspace-header__tools">
            <button
              type="button"
              className="workspace-header__tools-trigger"
              aria-label="FluidEQ actions"
              aria-expanded={showAudioToolsMenu}
              title="Audio actions"
              onClick={() => setShowAudioToolsMenu((current) => !current)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h3l2-6 4 12 2-6h5" />
              </svg>
              <span
                className={`status-dot${isBlockingError ? ' error' : ''}`}
              />
            </button>
            {showAudioToolsMenu && (
              <div className="workspace-header__menu" role="menu">
                <div className="workspace-header__menu-status">
                  <span
                    className={`status-dot${isBlockingError ? ' error' : ''}`}
                  />
                  <span>{connectionStatus}</span>
                </div>
                {!isLoading && !isBlockingError && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        handleRestartWindowsAudio();
                      }}
                    >
                      Restart Windows audio
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        handleConfigureEqualizerApo();
                      }}
                    >
                      Reconfigure Equalizer APO
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        handleOpenEqualizerApoSettings();
                      }}
                    >
                      Equalizer APO settings
                    </button>
                  </>
                )}
                {canShowSupport && (
                  <button
                    type="button"
                    role="menuitem"
                    className="workspace-header__menu-support"
                    onClick={() => {
                      setShowAudioToolsMenu(false);
                      setShowSupportDialog(true);
                    }}
                  >
                    Support the work
                  </button>
                )}
              </div>
            )}
          </div>
          <div
            className="window-titlebar__controls"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="window-control"
              aria-label="Minimize FluidEQ"
              title="Minimize"
              onClick={handleMinimizeWindow}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2 6h8" />
              </svg>
            </button>
            <button
              type="button"
              className="window-control"
              aria-label={
                isWindowMaximized ? 'Restore FluidEQ' : 'Maximize FluidEQ'
              }
              title={isWindowMaximized ? 'Restore' : 'Maximize'}
              onClick={() =>
                handleToggleMaximizeWindow().catch(() => undefined)
              }
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                {isWindowMaximized ? (
                  <path d="M4 3h6v6M2 5v5h6V4" />
                ) : (
                  <path d="M2 2h8v8H2z" />
                )}
              </svg>
            </button>
            <button
              type="button"
              className="window-control window-control--close"
              aria-label="Close FluidEQ"
              title="Close"
              onClick={handleCloseWindow}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      <main className="app-workspace">
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
              <button type="button" onClick={dismissAudioRestartRecommendation}>
                Dismiss
              </button>
            </div>
          </aside>
        )}
        <SideBar showGraphToggle={activeWorkspaceTab === 'eq'} />
        <div className="center-workspace">
          <div className="middle-content">
            <div
              className="workspace-tabs"
              role="tablist"
              aria-label="Sound workspace"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === 'eq'}
                className={`workspace-tab${
                  activeWorkspaceTab === 'eq' ? ' is-active' : ''
                }`}
                onClick={() => setActiveWorkspaceTab('eq')}
              >
                EQ &amp; headset mode
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === 'voicing'}
                className={`workspace-tab${
                  activeWorkspaceTab === 'voicing' ? ' is-active' : ''
                }`}
                onClick={() => setActiveWorkspaceTab('voicing')}
              >
                Voicing
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === 'convolution'}
                className={`workspace-tab${
                  activeWorkspaceTab === 'convolution' ? ' is-active' : ''
                }`}
                onClick={() => setActiveWorkspaceTab('convolution')}
              >
                Convolution
              </button>
            </div>
            {activeWorkspaceTab === 'eq' ? (
              <div
                className={`workspace-tab-panel workspace-tab-panel--eq${
                  !isEnabled ? ' is-engine-disabled' : ''
                }`}
                aria-disabled={!isEnabled}
              >
                <AutoEQ />
                <MainContent />
              </div>
            ) : (
              // Voicing and convolution are both written into the same APO
              // config as the EQ, so with the engine off they are just as inert
              // and read the same way.
              <div
                className={`workspace-tab-panel workspace-tab-panel--convolution${
                  !isEnabled ? ' is-engine-disabled' : ''
                }`}
                aria-disabled={!isEnabled}
              >
                {activeWorkspaceTab === 'voicing' ? (
                  <VoicingPanel />
                ) : (
                  <ConvolutionPanel />
                )}
              </div>
            )}
          </div>
          {activeWorkspaceTab === 'eq' ? <FrequencyResponseChart /> : null}
        </div>
        <div className="right-content">
          <DeviceProfiles />
          {/* Sits with the output device because it answers the same question:
              what is this sound coming out of. */}
          <DriverPicker />
          <PresetsBar
            fetchPresets={getPresetListFromFiles}
            loadPreset={loadPreset}
            savePreset={savePreset}
            renamePreset={renamePreset}
            deletePreset={deletePreset}
          />
        </div>
        {/* Only a genuinely fatal condition takes the screen. Anything else is
            reported without touching the editor: a preset that failed to save
            is no reason to hide an equalizer that is still working. */}
        {globalError && isBlockingError && (
          <PrereqMissingModal
            isLoading={isLoading}
            onRetry={performHealthCheck}
            errorMsg={globalError.shortError}
            actionMsg={globalError.action}
          />
        )}
        {globalError && !isBlockingError && (
          <div className="workspace-notice" role="alert">
            <div>
              <strong>{globalError.shortError}</strong>
              <span>{globalError.action}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setGlobalError(undefined)}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        )}
        {showSupportDialog && (
          <SupportDialog
            hasContributed={hasContributed}
            onContributed={() => {
              localStorage.setItem(SUPPORT_CONTRIBUTED_KEY, 'true');
              setHasContributed(true);
            }}
            onClose={() => setShowSupportDialog(false)}
          />
        )}
      </main>
    </>
  );
};

export default function App() {
  return (
    <AquaProvider>
      <LiveAudioProvider>
        <Router>
          <Routes>
            <Route path="/" element={<AppContent />} />
          </Routes>
        </Router>
      </LiveAudioProvider>
    </AquaProvider>
  );
}
