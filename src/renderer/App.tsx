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
import { ErrorCode, ErrorDescription } from 'common/errors';
import { SUPPORT_CONTRIBUTED_KEY, isSupportAvailable } from 'common/support';
import './styles/App.scss';
import MainContent from './MainContent';
import SupportDialog from './SupportDialog';
import SupportPet from './SupportPet';
import { FluidEqProvider, useFluidEqContext } from './utils/FluidEqContext';
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
import MenuIcon from './icons/MenuIcon';
import LanguagePicker from './components/LanguagePicker';
import UpdateNotice from './components/UpdateNotice';
import WhatsNewDialog from './components/WhatsNewDialog';
import { I18nProvider, useTranslation } from './utils/I18nContext';
import { LiveAudioProvider } from './audio/LiveAudioContext';
import {
  deletePreset,
  getPresetListFromFiles,
  importConvolutionFile,
  importEqFile,
  loadPreset,
  renamePreset,
  savePreset,
} from './utils/equalizerApi';

const APO_RESTART_RECOMMENDED_KEY = 'fluideq.apoRestartRecommended';
/** The version whose notes have already been shown. */
const WHATS_NEW_SEEN_KEY = 'fluideq.whatsNewSeen';

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
    refreshState,
    setGlobalError,
  } = useFluidEqContext();
  const { t } = useTranslation();
  const [showAudioRestartRecommendation, setShowAudioRestartRecommendation] =
    useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [showAudioToolsMenu, setShowAudioToolsMenu] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  // What the last import did. Reported the same way as a recoverable failure —
  // in the corner, dismissable — rather than as a modal alert, because there
  // is nothing to decide and the result is already audible.
  const [importNotice, setImportNotice] = useState('');
  // Shown once per version, automatically. Someone who just updated wants to
  // know what changed; someone opening the app for the fifth time today does
  // not, so the version they last saw is remembered.
  const [showWhatsNew, setShowWhatsNew] = useState(
    () =>
      !!APP_VERSION && localStorage.getItem(WHATS_NEW_SEEN_KEY) !== APP_VERSION,
  );
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

  /**
   * Import an EQ or an impulse response the user already has.
   *
   * The file picker lives in the main process, so this is one call that either
   * comes back with a description of what was applied, an empty string because
   * the dialog was cancelled, or an error naming what was wrong with the file.
   * Nothing is applied halfway: the state only changes if the parse succeeded.
   */
  const runImport = async (importer: () => Promise<string>) => {
    try {
      const summary = await importer();
      if (!summary) {
        return;
      }
      setImportNotice(summary);
      await refreshState();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const handleImportEq = () => runImport(importEqFile);
  const handleImportConvolution = () => runImport(importConvolutionFile);

  const handleRestartWindowsAudio = async () => {
    if (!window.confirm(t('notice.restartConfirm'))) {
      return;
    }

    const error = await window.electron.ipcRenderer.restartWindowsAudio();
    window.alert(error || t('notice.restartDone'));
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

  let connectionStatus = t('app.status.ready');
  if (isLoading) {
    connectionStatus = t('app.status.checking');
  } else if (isBlockingError) {
    connectionStatus = t('app.status.error');
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
            <div className="workspace-header__tagline">{t('app.tagline')}</div>
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
              aria-label={t('app.actions')}
              aria-expanded={showAudioToolsMenu}
              title={t('app.actions.title')}
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
                    {/* Bringing your own files in belongs at the top: it is
                        the only thing here that changes what you hear. */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        handleImportEq();
                      }}
                    >
                      <MenuIcon name="import" />
                      {t('app.menu.importEq')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        handleImportConvolution();
                      }}
                    >
                      <MenuIcon name="waveform" />
                      {t('app.menu.importConvolution')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        handleRestartWindowsAudio();
                      }}
                    >
                      <MenuIcon name="restart" />
                      {t('app.menu.restartAudio')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        handleConfigureEqualizerApo();
                      }}
                    >
                      <MenuIcon name="configure" />
                      {t('app.menu.reconfigure')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        handleOpenEqualizerApoSettings();
                      }}
                    >
                      <MenuIcon name="settings" />
                      {t('app.menu.apoSettings')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowAudioToolsMenu(false);
                        setShowWhatsNew(true);
                      }}
                    >
                      <MenuIcon name="info" />
                      {t('app.menu.whatsNew')}
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
                    <MenuIcon name="support" />
                    {t('app.menu.support')}
                  </button>
                )}
                {/* Last, and always available: someone who cannot read the
                    rest of this menu needs to be able to reach it. */}
                <LanguagePicker />
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
              aria-label={t('app.window.minimizeApp')}
              title={t('app.window.minimize')}
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
                isWindowMaximized
                  ? t('app.window.restoreApp')
                  : t('app.window.maximizeApp')
              }
              title={
                isWindowMaximized
                  ? t('app.window.restore')
                  : t('app.window.maximize')
              }
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
              aria-label={t('app.window.closeApp')}
              title={t('app.window.close')}
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
            <span>{t('notice.apoReconfigured')}</span>
            <div className="audio-restart-notice__actions">
              <button type="button" onClick={handleRestartWindowsAudio}>
                {t('notice.restartNow')}
              </button>
              <button type="button" onClick={dismissAudioRestartRecommendation}>
                {t('app.dismiss')}
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
              aria-label={t('tabs.aria')}
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
                {t('tabs.eq')}
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
                {t('tabs.voicing')}
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
                {t('tabs.convolution')}
              </button>
            </div>
            {activeWorkspaceTab === 'eq' ? (
              <div
                // Remounts on every tab change so the panel entrance animation
                // replays. Voicing and convolution share this element, so
                // without a key switching between them changed the contents
                // with no transition at all.
                key={activeWorkspaceTab}
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
                key={activeWorkspaceTab}
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
              aria-label={t('app.dismiss')}
              onClick={() => setGlobalError(undefined)}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        )}
        {importNotice && (
          <div className="workspace-notice workspace-notice--ok" role="status">
            <MenuIcon name="import" className="workspace-notice__icon" />
            <div>
              <strong>{t('notice.importComplete')}</strong>
              <span>{importNotice}</span>
            </div>
            <button
              type="button"
              aria-label={t('app.dismiss')}
              onClick={() => setImportNotice('')}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        )}
        {/* Bottom left, opposite the failure notices, so two things arriving
            at once do not land on top of each other. */}
        <UpdateNotice />
        {showWhatsNew && (
          <WhatsNewDialog
            onClose={() => {
              // Written on close rather than on open: a dialog dismissed by a
              // crash should still be shown again.
              if (APP_VERSION) {
                localStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION);
              }
              setShowWhatsNew(false);
            }}
          />
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
    // Outermost: every other provider can surface a message, and all of them
    // are below this one so they can be translated.
    <I18nProvider>
      <FluidEqProvider>
        <LiveAudioProvider>
          <Router>
            <Routes>
              <Route path="/" element={<AppContent />} />
            </Routes>
          </Router>
        </LiveAudioProvider>
      </FluidEqProvider>
    </I18nProvider>
  );
}
