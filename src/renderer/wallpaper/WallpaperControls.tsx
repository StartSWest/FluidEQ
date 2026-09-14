import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import WallpaperDialog from './WallpaperDialog';
import WallpaperManageDialog from './WallpaperManageDialog';
import { screenStatusKey } from './wallpaperCopy';
import {
  closeWallpaperDialog,
  openWallpaperDialog,
  openWallpaperManager,
  useWallpaperDialog,
} from './wallpaperDialogs';
import {
  stopWallpaper,
  useWallpaperMutation,
  useWallpaperState,
} from './wallpaperStore';
import '../styles/Button.scss';
import '../styles/WallpaperControls.scss';

/** Mounted once, in `App.tsx`: whichever desktop background dialog is open. */
export function WallpaperDialogHost() {
  const dialog = useWallpaperDialog();
  if (dialog?.kind === 'set') {
    return (
      <WallpaperDialog
        key={dialog.lookId}
        lookId={dialog.lookId}
        wave={dialog.wave}
        onClose={closeWallpaperDialog}
      />
    );
  }
  if (dialog?.kind === 'manage') {
    return <WallpaperManageDialog onClose={closeWallpaperDialog} />;
  }
  return null;
}

/** Whether this computer can put a visualizer on its desktop at all. */
export const useCanSetDesktop = () => {
  const state = useWallpaperState();
  return state.supported && state.displays.length > 0;
};

export function WallpaperMenuAction({
  lookId,
  onChoose,
}: {
  lookId: string;
  /** Closes the menu the row sits in. */
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const canSet = useCanSetDesktop();
  if (!canSet) {
    return null;
  }
  return (
    <>
      <div className="graph-view-menu__divider" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onChoose();
          openWallpaperDialog(lookId);
        }}
      >
        <svg
          className="graph-view-menu__icon"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
          <path d="M5.5 14h5M8 11.5V14" />
        </svg>
        <span>{t('wallpaper.action')}</span>
      </button>
    </>
  );
}

export function WallpaperSceneAction({ lookId }: { lookId: string }) {
  const { t } = useTranslation();
  const canSet = useCanSetDesktop();
  if (!canSet) {
    return null;
  }
  return (
    <button
      type="button"
      className="button small subtle wallpaper-scene-action"
      onClick={() => openWallpaperDialog(lookId)}
    >
      <Glyph name="monitor" />
      {t('wallpaper.action')}
    </button>
  );
}

/** One line for every monitor's background, beside the Visualizers title. */
export function WallpaperStatus() {
  const { t } = useTranslation();
  const { supported, screens } = useWallpaperState();
  const operation = useWallpaperMutation();
  if (!supported || screens.length === 0) {
    return null;
  }

  // An unplugged monitor is waiting, not broken — its background comes back
  // with it, even after a restart — so it speaks only when nothing else can.
  const present = screens.filter(
    (screen) =>
      !(screen.phase === 'error' && screen.error === 'missing-display'),
  );
  const failed = present.filter((screen) => screen.phase === 'error');
  const paused = present.filter((screen) => screen.phase === 'paused');
  const running = present.filter((screen) => screen.phase === 'running');
  let tone: 'running' | 'starting' | 'paused' | 'error' = 'running';
  let status: string;
  if (operation.pending && operation.kind === 'stop') {
    status = t('wallpaper.status.stopping');
  } else if (present.length === 0) {
    tone = 'paused';
    status = t(screenStatusKey(screens[0]));
  } else if (failed.length > 0) {
    tone = 'error';
    status =
      failed.length === 1
        ? t(screenStatusKey(failed[0]))
        : t('wallpaper.status.failedMany', { count: failed.length });
  } else if (paused.length === present.length) {
    tone = 'paused';
    const oneReason = paused.every(
      (screen) => screen.pauseReason === paused[0].pauseReason,
    );
    status = oneReason
      ? t(screenStatusKey(paused[0]))
      : t('wallpaper.status.pausedMany', { count: paused.length });
  } else if (running.length === 0) {
    tone = 'starting';
    status = t('wallpaper.status.starting');
  } else {
    status =
      running.length > 1
        ? t('wallpaper.status.runningMany', { count: running.length })
        : t('wallpaper.status.running');
  }

  return (
    <div
      className={`wallpaper-status wallpaper-status--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="wallpaper-status__mark" aria-hidden="true">
        <Glyph name={tone === 'error' ? 'alert' : 'monitor'} />
      </span>
      {/* One line beside the title: a reason longer than it is cut short on
          screen, and whole on hover. */}
      <span className="wallpaper-status__text" title={status}>
        {status}
      </span>
      <button
        type="button"
        className="button small subtle"
        onClick={openWallpaperManager}
      >
        {t('wallpaper.manage')}
      </button>
      <button
        type="button"
        className="button small subtle"
        disabled={operation.pending}
        onClick={() => stopWallpaper()}
      >
        {screens.length > 1 ? t('wallpaper.stopAll') : t('wallpaper.stop')}
      </button>
    </div>
  );
}
