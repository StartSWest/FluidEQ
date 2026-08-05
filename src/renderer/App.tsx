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
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { ErrorCode, ErrorDescription } from 'common/errors';
import { SUPPORT_CONTRIBUTED_KEY } from 'common/support';
import { resetRhythmRun } from './utils/rhythmRun';
import { resetEuphoriaMode } from './utils/euphoriaMode';
import './styles/App.scss';
import MainContent from './MainContent';
import SupportDialog from './SupportDialog';
import SupportPet from './SupportPet';
import { FluidEqProvider, useFluidEqContext } from './utils/FluidEqContext';
import PrereqMissingModal from './PrereqMissingModal';
import BugReportDialog from './components/BugReportDialog';
import SideBar from './SideBar';
import {
  getLiveOutputSolo,
  setLiveOutputSolo,
  useGraphFullScreen,
} from './utils/graphStyle';
import VideoBrowser from './video/VideoBrowser';
import PaneResizer from './components/PaneResizer';
import {
  clampToWindow,
  commitPaneSizes,
  getEditorHeight,
  setEditorHeight,
  useEditorHeight,
} from './utils/paneSizes';
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
import {
  LiveAudioProvider,
  useLiveAudioControl,
} from './audio/LiveAudioContext';
import EuphoriaGlow from './components/EuphoriaGlow';
import {
  deletePreset,
  getPresetListFromFiles,
  importConvolutionFile,
  importEqFile,
  installEqualizerApo,
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
    isEngineUsable,
    isGraphViewOn,
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
  // Opened from the actions menu. Nothing is gathered until it is on screen,
  // so an app nobody is reporting a problem with never reads its own logs.
  const [showBugReport, setShowBugReport] = useState(false);
  // Bumping this remounts the prerequisite notice, which is how a dismissed
  // one comes back. Without it the notice was a one-shot: close it once and
  // the only route to "Install Equalizer APO" was gone until the error
  // changed, which for a missing engine it never does.
  const [prereqNonce, setPrereqNonce] = useState(0);
  const [showWhatsNew, setShowWhatsNew] = useState(
    () =>
      !!APP_VERSION && localStorage.getItem(WHATS_NEW_SEEN_KEY) !== APP_VERSION,
  );
  // Set from inside the graph pane; read here because the element that has
  // to get out of the way is the EQ panel, which is the graph's sibling.
  const isGraphFullScreen = useGraphFullScreen();
  const editorHeight = useEditorHeight();
  // The live capture's own failure, read once and reported once.
  //
  // It used to be printed inline in two places at the same time — a bare
  // sentence in the graph legend AND another in the waveform meter — so the
  // same fault appeared twice, in the two panes it had just emptied, in a
  // typeface meant for labels. It is a fault, so it now reads like the other
  // faults do.
  const { error: captureError, retry: retryCapture } = useLiveAudioControl();
  const [isCaptureNoticeHidden, setIsCaptureNoticeHidden] = useState(false);
  // A new failure is worth showing again even if the last one was dismissed.
  useEffect(() => setIsCaptureNoticeHidden(false), [captureError]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'eq' | 'voicing' | 'convolution' | 'video'
  >('eq');
  // The player is mounted on first visit and never unmounted, because its page
  // is destroyed the moment the element leaves the DOM — switching to the EQ
  // to move a band would otherwise stop whatever was playing. Until somebody
  // opens the tab, though, there is no reason to have a browser engine running
  // at all, so it does not exist.
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  const isVideoTab = activeWorkspaceTab === 'video';
  // Every tab, not just the EQ. The response is what the app is for, and there
  // is no tab where hiding it helps: voicing and convolution both change the
  // curve, so watching it move is how you tell what they did. The switch in the
  // sidebar is still the way to turn it off, and it now applies everywhere.
  const showsGraph = isGraphViewOn;

  // The editor's height when the drag began, so every move is measured from one
  // fixed point rather than accumulated.
  const graphDragStart = useRef(0);
  // Read by the player, which has to stop swallowing pointer events for the
  // length of a drag — see VideoBrowser.scss.
  const [isResizingPanes, setIsResizingPanes] = useState(false);

  const handleGraphResizeStart = useCallback(() => {
    graphDragStart.current = getEditorHeight();
    setIsResizingPanes(true);
  }, []);

  /**
   * Move the divider.
   *
   * What is set is the pane *above* it — the graph below simply takes what is
   * left. Dragging down gives the editor more and the graph less, which is the
   * direction the handle is being carried, and both ends of the drag stay live
   * because the pane being sized is the one whose content can actually vary.
   */
  const handleGraphResizeDrag = useCallback((deltaY: number) => {
    setEditorHeight(clampToWindow(graphDragStart.current + deltaY));
  }, []);

  const handleGraphResizeEnd = useCallback(() => {
    setIsResizingPanes(false);
    commitPaneSizes();
  }, []);

  // How much of the workspace the editor currently has, as a percentage. Only
  // for the divider's `aria-valuenow` — a pixel height means nothing read out
  // loud without also knowing how tall the window is.
  const graphHeightPercent = Math.round(
    (editorHeight / Math.max(1, window.innerHeight)) * 100,
  );
  const [hasContributed, setHasContributed] = useState(
    () => localStorage.getItem(SUPPORT_CONTRIBUTED_KEY) === 'true',
  );

  useEffect(() => {
    if (!isVideoTab) {
      return undefined;
    }

    setHasOpenedVideo(true);

    // Wave-only for as long as the tab is open. Somebody watching a video with
    // the graph underneath wants the trace moving to the music, not the EQ
    // response, the voicing layer and eight draggable band handles over the
    // top of it. What was there before is put back on the way out, so the
    // setting is borrowed rather than changed.
    const previousSolo = getLiveOutputSolo();
    setLiveOutputSolo(true);
    return () => setLiveOutputSolo(previousSolo);
  }, [isVideoTab]);

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

  /**
   * Run Equalizer APO's installer again, over the top of itself.
   *
   * Its setup is a repair as much as an install: it re-registers the APO and
   * reopens the Device Selector, which is what fixes an endpoint Windows has
   * detached it from. The bundled copy is still in the install directory, so
   * nothing is downloaded.
   */
  const handleReinstallApo = async () => {
    // Asked first, and the label's ellipsis is a promise that it will be.
    //
    // This raises a Windows permission prompt, reinstalls the component that
    // processes all of the machine's audio, and needs a restart afterwards.
    // None of that should happen because somebody was reading the menu with a
    // mouse in their hand.
    const confirmed = window.confirm(
      'Reinstall Equalizer APO?\n\n' +
        'Its setup will open so you can re-select which audio devices to ' +
        'equalise. Windows will ask for administrator permission, and your ' +
        'computer will need to restart afterwards.\n\n' +
        'Your FluidEQ settings and profiles are not affected.',
    );
    if (!confirmed) {
      return;
    }
    try {
      await installEqualizerApo();
      // Same as reconfiguring, and more certainly so: a reinstalled APO is not
      // in the audio chain until the endpoints are rebuilt. Reconfigure has
      // always said this; a reinstall staying silent about it would leave
      // somebody deciding the repair had not worked.
      localStorage.setItem(APO_RESTART_RECOMMENDED_KEY, 'true');
      setShowAudioRestartRecommendation(true);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
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
          <SupportPet
            hasContributed={hasContributed}
            onOpen={() => setShowSupportDialog(true)}
          />
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
                {/* A status line that says something is wrong and offers no
                    way to act on it is a dead end. When it is reporting a real
                    fault it becomes the way back to the notice that carries
                    the Install and Retry buttons — which is otherwise
                    unreachable once dismissed. */}
                {isBlockingError ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="workspace-header__menu-status is-actionable"
                    onClick={() => {
                      setShowAudioToolsMenu(false);
                      setPrereqNonce((n) => n + 1);
                    }}
                  >
                    <span className="status-dot error" />
                    <span>{connectionStatus}</span>
                    <span className="workspace-header__menu-status-hint">
                      Fix this
                    </span>
                  </button>
                ) : (
                  <div className="workspace-header__menu-status">
                    <span className="status-dot" />
                    <span>{connectionStatus}</span>
                  </div>
                )}
                {!isLoading && !isBlockingError && (
                  <>
                    {/* Two columns, split by what each thing belongs to.
                       
                        The menu had grown to nine unlabelled rows in one
                        stack — everything from importing a WAV to reinstalling
                        the audio engine, in the order each had been added. Two
                        of them said "Equalizer APO" and two more were about it
                        without saying so, which is the state where people stop
                        reading a menu and start hunting through it.
                       
                        Split by owner rather than by frequency, because that
                        is the distinction that actually predicts where
                        somebody will look: is this about FluidEQ, or about the
                        engine underneath it? Within each column a rule
                        separates doing something from fixing something. */}
                    <div className="workspace-header__menu-columns">
                      <div className="workspace-header__menu-column">
                        <p className="workspace-header__menu-heading">
                          FluidEQ
                        </p>
                        {/* Bringing your own files in belongs at the top: it
                            is the only thing here that changes what you
                            hear. */}
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

                        <hr className="workspace-header__menu-rule" />

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
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            setShowBugReport(true);
                          }}
                        >
                          <MenuIcon name="info" />
                          Report a problem
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowAudioToolsMenu(false);
                            window.open(
                              'https://github.com/StartSWest/FluidEQ/releases/latest',
                              '_blank',
                              'noopener',
                            );
                          }}
                        >
                          <MenuIcon name="restart" />
                          Reinstall FluidEQ…
                        </button>
                      </div>

                      <div className="workspace-header__menu-column">
                        <p className="workspace-header__menu-heading">
                          Equalizer APO
                        </p>
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

                        <hr className="workspace-header__menu-rule" />

                        {/* Repairing, rather than configuring. APO can be
                            installed and still not working — a Windows update
                            can detach it from an endpoint. Reconfigure covers
                            a device that was never ticked; this covers one it
                            has lost. */}
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
                            handleReinstallApo();
                          }}
                        >
                          <MenuIcon name="settings" />
                          Reinstall Equalizer APO…
                        </button>
                      </div>
                    </div>
                  </>
                )}
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
        {/* Same shape as the restart notice above: what happened, and the
            one thing worth trying. Windows refuses the loopback capture for
            transient reasons — a device changing mid-start, a prompt
            dismissed — and a second attempt very often works, so there is
            something better to offer than an apology. */}
        {captureError && !isCaptureNoticeHidden && (
          <aside className="audio-restart-notice" role="status">
            <span>
              The live meter and the output curve could not start. Everything
              else works normally.
            </span>
            <div className="audio-restart-notice__actions">
              <button
                type="button"
                onClick={() => {
                  retryCapture();
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => setIsCaptureNoticeHidden(true)}
              >
                {t('app.dismiss')}
              </button>
            </div>
          </aside>
        )}
        {/* Always. The graph is on every tab now, so the switch that turns it
            off belongs on every tab too — and it has to stay visible once it
            has been used, or there would be no way to bring the graph back. */}
        <SideBar showGraphToggle />
        <div
          className={`center-workspace${
            isGraphFullScreen && isGraphViewOn ? ' is-graph-full' : ''
          }${isResizingPanes ? ' is-resizing' : ''}`}
        >
          <div
            className="middle-content"
            // What the divider actually sets. The stylesheet decides whether
            // this reads as a height or only as a ceiling: on the EQ tab it is
            // a ceiling, so the card hugs its content and the divider follows
            // it up when the reference picker folds, with nothing having to
            // notice the fold. Everywhere else it is the height, because a web
            // page and a scrolling catalogue have no content height to follow.
            style={
              showsGraph && !isGraphFullScreen
                ? ({
                    '--editor-height': `${editorHeight}px`,
                  } as CSSProperties)
                : undefined
            }
          >
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
              <button
                type="button"
                role="tab"
                aria-selected={isVideoTab}
                className={`workspace-tab${isVideoTab ? ' is-active' : ''}`}
                onClick={() => setActiveWorkspaceTab('video')}
              >
                {t('tabs.video')}
              </button>
            </div>
            {activeWorkspaceTab === 'eq' && (
              <div
                // Remounts on every tab change so the panel entrance animation
                // replays. Voicing and convolution share this element, so
                // without a key switching between them changed the contents
                // with no transition at all.
                key={activeWorkspaceTab}
                // Inert when the equaliser is switched off, and equally inert
                // when Equalizer APO is not installed — in both cases there is
                // nothing behind these sliders and moving one changes nothing
                // you can hear. The app is still worth looking at, which is
                // why it is dimmed rather than replaced by an error screen.
                className={`workspace-tab-panel workspace-tab-panel--eq${
                  !isEngineUsable ? ' is-engine-disabled' : ''
                }`}
                aria-disabled={!isEngineUsable}
              >
                <AutoEQ />
                <MainContent />
              </div>
            )}
            {(activeWorkspaceTab === 'voicing' ||
              activeWorkspaceTab === 'convolution') && (
              // Voicing and convolution are both written into the same APO
              // config as the EQ, so with the engine off they are just as inert
              // and read the same way.
              <div
                key={activeWorkspaceTab}
                className={`workspace-tab-panel workspace-tab-panel--convolution${
                  !isEngineUsable ? ' is-engine-disabled' : ''
                }`}
                aria-disabled={!isEngineUsable}
              >
                {activeWorkspaceTab === 'voicing' ? (
                  <VoicingPanel />
                ) : (
                  <ConvolutionPanel />
                )}
              </div>
            )}
            {/* Outside the tab switch above, and deliberately: this one is
                hidden rather than unmounted, so that leaving the tab does not
                stop the music. It has no engine-disabled state either — a
                video plays whether or not Equalizer APO is behind it. */}
            {hasOpenedVideo && <VideoBrowser isHidden={!isVideoTab} />}
          </div>
          {/* One divider, both tabs, always in the same place: the seam between
              whatever is above and the graph. In full screen there is nothing
              above the graph, so there is nothing to divide. */}
          {showsGraph && !isGraphFullScreen && (
            <PaneResizer
              ariaLabel={t('graph.resize')}
              valuePercent={graphHeightPercent}
              onStart={handleGraphResizeStart}
              onDrag={handleGraphResizeDrag}
              onEnd={handleGraphResizeEnd}
            />
          )}
          {showsGraph ? <FrequencyResponseChart /> : null}
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
        {showBugReport && (
          <BugReportDialog onClose={() => setShowBugReport(false)} />
        )}
        {globalError && isBlockingError && (
          <PrereqMissingModal
            key={prereqNonce}
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
            // Opens on top rather than replacing this one. Reading the
            // notes is a detour from deciding whether to contribute, not a
            // departure from it — closing them should put you back where you
            // were, not leave you staring at the workspace.
            onShowReleaseNotes={() => setShowWhatsNew(true)}
            isCovered={showWhatsNew}
            hasContributed={hasContributed}
            onContributed={() => {
              localStorage.setItem(SUPPORT_CONTRIBUTED_KEY, 'true');
              setHasContributed(true);
            }}
            // Development only — the button that calls this is compiled out of
            // a release build. Both halves have to go: the badge is what gates
            // the game, and a run left standing would keep the whole window in
            // euphoria mode for a creature that no longer has anything to
            // celebrate.
            onResetContribution={() => {
              localStorage.removeItem(SUPPORT_CONTRIBUTED_KEY);
              setHasContributed(false);
              resetRhythmRun();
              // The unlock goes too. Leaving it would put a working euphoria
              // switch on the titlebar of an install that has just been reset
              // to never having earned one.
              resetEuphoriaMode();
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
          {/* Mounted here rather than inside the support dialog, because the
              run outlives that dialog being closed and the celebration is
              meant to reach the whole window. It renders nothing; it puts the
              streak on the document root where every stylesheet can see it. */}
          <EuphoriaGlow />
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
