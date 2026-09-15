import { useId, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { IWallpaperScreen, TWallpaperError } from '../../common/wallpaper';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import {
  MonitorFace,
  MonitorStage,
  monitorPosition,
  useMonitorName,
  useMonitorLayout,
} from './MonitorStage';
import { screenDetailKey, screenStatusKey } from './wallpaperCopy';
import useWallpaperLooks from './wallpaperLooks';
import {
  startWallpaper,
  stopWallpaper,
  useWallpaperMutation,
  useWallpaperState,
} from './wallpaperStore';
import '../styles/Button.scss';
import '../styles/WallpaperControls.scss';

/**
 * Failures another try can fix; the rest need something else to change.
 *
 * `refused` is one of them now. Nothing on disk remembers a scene that failed
 * on this computer's graphics any more, so pressing this actually runs it
 * again instead of meeting a refusal; a monitor still never retries one by
 * itself, which is what kept a driver-resetting scene from resetting it again
 * and again.
 */
const RETRYABLE: readonly TWallpaperError[] = [
  'unavailable',
  'host',
  'renderer',
  'audio',
  'refused',
];

/** What every monitor shows, and a Stop for each of them. */
export default function WallpaperManageDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { displays, screens, pauseOnBattery } = useWallpaperState();
  const operation = useWallpaperMutation();
  const lookOf = useWallpaperLooks();
  const monitorName = useMonitorName();
  const layout = useMonitorLayout(displays);
  const { placements } = layout;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  useModalKeys(surfaceRef, doneRef, { busy: false, onCancel: onClose });

  const placementOf = (screen: IWallpaperScreen) =>
    placements.find((entry) => entry.display.id === screen.displayId);
  // In the order the monitors stand; a disconnected one goes last.
  const rows = [...screens].sort(
    (a, b) =>
      (placementOf(a)?.number ?? Infinity) -
      (placementOf(b)?.number ?? Infinity),
  );

  return createPortal(
    <div
      className="wallpaper-dialog-backdrop"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={surfaceRef}
        className="wallpaper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${headingId}-title`}
        aria-describedby={`${headingId}-lead`}
      >
        <div className="wallpaper-dialog__head">
          <span className="wallpaper-dialog__mark" aria-hidden="true">
            <Glyph name="monitor" />
          </span>
          <h2 id={`${headingId}-title`} className="wallpaper-dialog__title">
            {t('wallpaper.title')}
          </h2>
        </div>
        <p id={`${headingId}-lead`} className="wallpaper-dialog__lead">
          {t('wallpaper.manage.description')}
        </p>

        <MonitorStage layout={layout} label={t('wallpaper.monitors')}>
          {(placement) => {
            const screen = screens.find(
              (entry) => entry.displayId === placement.display.id,
            );
            const look = screen ? lookOf(screen.lookId) : undefined;
            return (
              <div
                key={placement.display.id}
                className="wallpaper-monitor"
                style={monitorPosition(placement)}
                role="img"
                aria-label={[
                  monitorName(placement),
                  look ? look.name : t('wallpaper.monitor.ordinary'),
                  screen ? t(screenStatusKey(screen)) : '',
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                <MonitorFace
                  placement={placement}
                  look={look}
                  screen={screen}
                  faded={false}
                  calm={screen?.motion === 'calm'}
                />
              </div>
            );
          }}
        </MonitorStage>

        {rows.length > 0 ? (
          <ul className="wallpaper-screens">
            {rows.map((screen) => {
              const placement = placementOf(screen);
              const look = lookOf(screen.lookId);
              const [first, second = first] = look.swatch;
              const swatch = first
                ? ({
                    '--screen-a': first,
                    '--screen-b': second,
                  } as CSSProperties)
                : undefined;
              return (
                <li
                  key={screen.displayId}
                  className={`wallpaper-screen wallpaper-screen--${screen.phase}`}
                >
                  <span className="wallpaper-screen__number" aria-hidden="true">
                    {placement?.number ?? '–'}
                  </span>
                  <span
                    className="wallpaper-screen__swatch"
                    style={swatch}
                    aria-hidden="true"
                  />
                  <span className="wallpaper-screen__copy">
                    <span className="wallpaper-screen__look">{look.name}</span>
                    <span className="wallpaper-screen__status">
                      <span className="wallpaper-screen__monitor">
                        {placement
                          ? monitorName(placement)
                          : t('wallpaper.monitor.disconnected')}
                      </span>
                      <span>{t(screenDetailKey(screen))}</span>
                    </span>
                  </span>
                  <span className="wallpaper-screen__actions">
                    {screen.phase !== 'error' && (
                      <button
                        type="button"
                        className="button small subtle wallpaper-toggle"
                        aria-pressed={screen.motion === 'calm'}
                        title={t('wallpaper.motion.calm.hint')}
                        disabled={operation.pending}
                        onClick={() =>
                          startWallpaper({
                            lookId: screen.lookId,
                            displayIds: [screen.displayId],
                            pauseOnBattery,
                            wave: screen.wave,
                            motion: screen.motion === 'calm' ? 'music' : 'calm',
                          })
                        }
                      >
                        <span
                          className="wallpaper-toggle__box"
                          aria-hidden="true"
                        >
                          <Glyph name="check" />
                        </span>
                        {t('wallpaper.motion.calm')}
                      </button>
                    )}
                    {screen.phase === 'error' &&
                      placement &&
                      RETRYABLE.includes(screen.error ?? 'unavailable') && (
                        <button
                          type="button"
                          className="button small subtle"
                          disabled={operation.pending}
                          onClick={() =>
                            startWallpaper({
                              lookId: screen.lookId,
                              displayIds: [screen.displayId],
                              pauseOnBattery,
                              wave: screen.wave,
                              motion: screen.motion,
                            })
                          }
                        >
                          {t('wallpaper.retry')}
                        </button>
                      )}
                    <button
                      type="button"
                      className="button small subtle"
                      disabled={operation.pending}
                      onClick={() => stopWallpaper([screen.displayId])}
                    >
                      {t('wallpaper.stop')}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="wallpaper-dialog__empty">
            {t('wallpaper.manage.empty')}
          </p>
        )}

        <div className="wallpaper-dialog__foot">
          {rows.length > 1 && (
            <button
              type="button"
              className="button small subtle"
              disabled={operation.pending}
              onClick={() => stopWallpaper()}
            >
              {t('wallpaper.stopAll')}
            </button>
          )}
          <button
            ref={doneRef}
            type="button"
            className="button small"
            onClick={onClose}
          >
            {t('wallpaper.done')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
