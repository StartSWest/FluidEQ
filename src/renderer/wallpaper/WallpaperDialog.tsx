import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  WALLPAPER_MOTIONS,
  type IWallpaperWave,
  type TWallpaperMotion,
} from '../../common/wallpaper';
import Glyph from '../community/Glyph';
import { getWatchedGraphWave } from '../utils/graphViewSettings';
import { useTranslation } from '../utils/I18nContext';
import useModalKeys from '../utils/useModalKeys';
import Switch from '../widgets/Switch';
import {
  MonitorFace,
  MonitorStage,
  monitorPosition,
  useMonitorName,
  useMonitorLayout,
} from './MonitorStage';
import { ERROR_KEYS, MOTION_COPY } from './wallpaperCopy';
import useWallpaperLooks from './wallpaperLooks';
import {
  startWallpaper,
  stopWallpaper,
  useWallpaperMutation,
  useWallpaperState,
} from './wallpaperStore';
import '../styles/Button.scss';
import '../styles/WallpaperControls.scss';

interface IWallpaperDialogProps {
  lookId: string;
  /** The wave to set it with; absent, the graph's as set for watching. */
  wave?: IWallpaperWave;
  onClose: () => void;
}

/**
 * Where one visualizer plays: the monitors as they stand on the desk, each
 * pressed to take it. What the choice leaves alone keeps what it shows, so
 * one monitor can carry this visualizer while another carries a different one.
 */
export default function WallpaperDialog({
  lookId,
  wave,
  onClose,
}: IWallpaperDialogProps) {
  const { t } = useTranslation();
  const {
    displays,
    screens,
    pauseOnBattery: savedBattery,
  } = useWallpaperState();
  const operation = useWallpaperMutation();
  const lookOf = useWallpaperLooks();
  const monitorName = useMonitorName();
  const layout = useMonitorLayout(displays);
  const { placements } = layout;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const batteryId = useId();
  const motionName = useId();
  const look = lookOf(lookId);
  const primary = displays.find((display) => display.primary) ?? displays[0];
  const showing = screens.filter((screen) => screen.lookId === lookId);
  const showingThis = showing.map((screen) => screen.displayId);
  // Until one is picked, how this visualizer already plays: calm when every
  // monitor showing it is calm, and otherwise with the music.
  const [motionChoice, setMotionChoice] = useState<TWallpaperMotion>();
  const motion: TWallpaperMotion =
    motionChoice ??
    (showing.length > 0 && showing.every((screen) => screen.motion === 'calm')
      ? 'calm'
      : 'music');
  // Until a monitor is pressed, the choice follows what main reports — the
  // monitors already showing this visualizer, or else the primary one — so a
  // dialog opened before the monitors are known still starts with one chosen.
  const [picked, setPicked] = useState<ReadonlySet<number>>();
  const selected: ReadonlySet<number> =
    picked ??
    new Set(showingThis.length > 0 || !primary ? showingThis : [primary.id]);
  const [focusId] = useState(() => [...selected][0] ?? primary?.id);
  const [batteryChoice, setBatteryChoice] = useState<boolean>();
  const pauseOnBattery = batteryChoice ?? savedBattery;
  const [attempted, setAttempted] = useState(false);
  useModalKeys(surfaceRef, focusRef, {
    busy: operation.pending,
    onCancel: onClose,
  });

  // A monitor unplugged while the dialog is open drops out of the choice.
  const chosen = displays
    .filter((display) => selected.has(display.id))
    .map((display) => display.id);
  const everyMonitor = displays.length > 1 && chosen.length === displays.length;
  const toggle = (displayId: number) => {
    const next = new Set(selected);
    if (next.has(displayId)) {
      next.delete(displayId);
    } else {
      next.add(displayId);
    }
    setPicked(next);
  };

  const apply = async () => {
    if (operation.pending || chosen.length === 0) {
      return;
    }
    setAttempted(true);
    // A monitor showing this visualizer and pressed off stops showing it.
    const leaving = showingThis.filter((displayId) => !selected.has(displayId));
    let next = await startWallpaper({
      lookId,
      displayIds: chosen,
      pauseOnBattery,
      // The wave as given, or as set in the graph now. Setting a visualizer
      // again on a monitor already showing it moves its band without a restart.
      wave: wave ?? getWatchedGraphWave(),
      motion,
    });
    if (leaving.length > 0) {
      next = await stopWallpaper(leaving);
    }
    const failed = next.screens.some(
      (screen) =>
        screen.lookId === lookId &&
        screen.phase === 'error' &&
        chosen.includes(screen.displayId),
    );
    if (!failed) {
      onClose();
    }
  };

  const failures = attempted
    ? screens.filter(
        (screen) =>
          screen.lookId === lookId &&
          screen.phase === 'error' &&
          chosen.includes(screen.displayId),
      )
    : [];
  let startLabel = t('wallpaper.start');
  if (operation.pending) {
    startLabel = t('wallpaper.status.starting');
  } else if (failures.length > 0) {
    startLabel = t('wallpaper.retry');
  } else if (chosen.length > 1) {
    startLabel = t('wallpaper.start.many', { count: chosen.length });
  }

  return createPortal(
    <div
      className="wallpaper-dialog-backdrop"
      role="presentation"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget && !operation.pending) {
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
        aria-busy={operation.pending}
      >
        <div className="wallpaper-dialog__head">
          <span className="wallpaper-dialog__mark" aria-hidden="true">
            <Glyph name="monitor" />
          </span>
          <span className="wallpaper-dialog__heading">
            <h2 id={`${headingId}-title`} className="wallpaper-dialog__title">
              {t('wallpaper.title')}
            </h2>
            <span className="wallpaper-dialog__subject">{look.name}</span>
          </span>
        </div>
        <p id={`${headingId}-lead`} className="wallpaper-dialog__lead">
          {t('wallpaper.description')}
        </p>

        <section className="wallpaper-dialog__monitors">
          <div className="wallpaper-dialog__section-head">
            <span className="wallpaper-dialog__section-copy">
              <span className="eyebrow">{t('wallpaper.monitors')}</span>
              <span className="wallpaper-dialog__hint">
                {t('wallpaper.monitors.hint')}
              </span>
            </span>
            {displays.length > 1 && (
              <button
                type="button"
                className="button small subtle wallpaper-toggle"
                aria-pressed={everyMonitor}
                disabled={operation.pending}
                onClick={() =>
                  setPicked(
                    everyMonitor && primary
                      ? new Set([primary.id])
                      : new Set(displays.map((display) => display.id)),
                  )
                }
              >
                <span className="wallpaper-toggle__box" aria-hidden="true">
                  <Glyph name="check" />
                </span>
                {t('wallpaper.monitors.all')}
              </button>
            )}
          </div>
          <MonitorStage layout={layout} label={t('wallpaper.monitors')}>
            {(placement) => {
              const { display } = placement;
              const isChosen = selected.has(display.id);
              const screen = screens.find(
                (entry) => entry.displayId === display.id,
              );
              const current = screen ? lookOf(screen.lookId) : undefined;
              const showsThis = screen?.lookId === lookId;
              const size = t('wallpaper.monitor.size', {
                width: display.width,
                height: display.height,
              });
              return (
                <button
                  key={display.id}
                  ref={display.id === focusId ? focusRef : undefined}
                  type="button"
                  role="checkbox"
                  aria-checked={isChosen}
                  aria-label={[
                    monitorName(placement),
                    size,
                    display.primary ? t('wallpaper.monitor.primary') : '',
                    current ? current.name : t('wallpaper.monitor.ordinary'),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  className="wallpaper-monitor wallpaper-monitor--choice"
                  style={monitorPosition(placement)}
                  disabled={operation.pending}
                  onClick={() => toggle(display.id)}
                >
                  <MonitorFace
                    placement={placement}
                    look={isChosen ? look : current}
                    screen={isChosen && !showsThis ? undefined : screen}
                    faded={!isChosen && current !== undefined}
                    calm={
                      isChosen ? motion === 'calm' : screen?.motion === 'calm'
                    }
                  />
                </button>
              );
            }}
          </MonitorStage>
        </section>

        <fieldset className="wallpaper-motion" disabled={operation.pending}>
          <legend className="eyebrow">{t('wallpaper.motion')}</legend>
          <div className="wallpaper-motion__options">
            {WALLPAPER_MOTIONS.map((entry) => {
              const copy = MOTION_COPY[entry];
              return (
                <label
                  key={entry}
                  htmlFor={`${motionName}-${entry}`}
                  className={`wallpaper-motion__option wallpaper-motion__option--${entry}`}
                >
                  <input
                    id={`${motionName}-${entry}`}
                    type="radio"
                    name={motionName}
                    value={entry}
                    checked={motion === entry}
                    onChange={() => setMotionChoice(entry)}
                  />
                  <span className="wallpaper-motion__mark" aria-hidden="true">
                    <Glyph name={copy.glyph} />
                  </span>
                  <span className="wallpaper-motion__copy">
                    <span className="wallpaper-motion__name">
                      {t(copy.name)}
                    </span>
                    <span className="wallpaper-motion__hint">
                      {t(copy.hint)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="wallpaper-dialog__battery">
          <span className="wallpaper-dialog__battery-copy">
            <label htmlFor={batteryId}>{t('wallpaper.pauseOnBattery')}</label>
            <span>{t('wallpaper.pauseOnBattery.hint')}</span>
          </span>
          <Switch
            id={batteryId}
            isOn={pauseOnBattery}
            isDisabled={operation.pending}
            ariaLabel={t('wallpaper.pauseOnBattery')}
            handleToggle={() => setBatteryChoice(!pauseOnBattery)}
          />
        </div>

        {failures.length > 0 && (
          <ul className="wallpaper-dialog__errors" role="alert">
            {failures.map((failure) => {
              const placement = placements.find(
                (entry) => entry.display.id === failure.displayId,
              );
              return (
                <li key={failure.displayId}>
                  {placement && (
                    <span className="wallpaper-dialog__error-monitor">
                      {monitorName(placement)}
                    </span>
                  )}
                  <span>{t(ERROR_KEYS[failure.error ?? 'unavailable'])}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="wallpaper-dialog__foot">
          <button
            type="button"
            className="button small subtle"
            disabled={operation.pending}
            onClick={onClose}
          >
            {t('wallpaper.cancel')}
          </button>
          <button
            type="button"
            className={`button small${operation.pending ? ' is-running' : ''}`}
            disabled={operation.pending || chosen.length === 0}
            aria-busy={operation.pending}
            onClick={apply}
          >
            {startLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
