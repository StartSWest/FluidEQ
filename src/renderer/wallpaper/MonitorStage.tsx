import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type {
  IWallpaperDisplay,
  IWallpaperScreen,
} from '../../common/wallpaper';
import Glyph from '../community/Glyph';
import { useLookThumbnail } from '../graph/lookThumbnails';
import { useTranslation } from '../utils/I18nContext';
import {
  layoutMonitors,
  type IMonitorLayout,
  type IMonitorPlacement,
} from './monitorLayout';
import { screenPhaseKey } from './wallpaperCopy';
import type { IWallpaperLook } from './wallpaperLooks';
import '../styles/WallpaperMonitors.scss';

/** Where a monitor sits on the stage, for whichever element draws it. */
export const monitorPosition = (
  placement: IMonitorPlacement,
): CSSProperties => ({
  left: `${placement.left}%`,
  top: `${placement.top}%`,
  width: `${placement.width}%`,
  height: `${placement.height}%`,
});

/** A monitor's name in a sentence: its own when Windows has one. */
export const useMonitorName = () => {
  const { t } = useTranslation();
  return (placement: IMonitorPlacement) =>
    placement.display.label.trim() ||
    t('wallpaper.monitor.name', { number: placement.number });
};

/** The monitors laid out once, for the stage and for anything naming them. */
export const useMonitorLayout = (
  displays: readonly IWallpaperDisplay[],
): IMonitorLayout => useMemo(() => layoutMonitors(displays), [displays]);

export function MonitorStage({
  layout,
  label,
  children,
}: {
  layout: IMonitorLayout;
  label: string;
  children: (placement: IMonitorPlacement) => ReactNode;
}) {
  return (
    <div
      className="wallpaper-stage"
      style={{ aspectRatio: String(layout.ratio) }}
      role="group"
      aria-label={label}
    >
      {layout.placements.map(children)}
    </div>
  );
}

interface IMonitorFaceProps {
  placement: IMonitorPlacement;
  /** What the monitor will show, or shows; none is its ordinary background. */
  look?: IWallpaperLook;
  /** What the monitor is doing now, when it has a background set. */
  screen?: IWallpaperScreen;
  /** Drawn faded: a visualizer on it now that the choice will leave alone. */
  faded: boolean;
  /** Its visualizer plays calm, or will: soft swells on the glass, not bars. */
  calm: boolean;
}

/**
 * The picture inside a monitor: a frame of the visualizer it shows, under its
 * own colours until that frame is there; its number, and in words what it
 * shows and whether that is playing.
 */
export function MonitorFace({
  placement,
  look,
  screen,
  faded,
  calm,
}: IMonitorFaceProps) {
  const { t } = useTranslation();
  const { display, number } = placement;
  const [glassElement, setGlassElement] = useState<HTMLSpanElement | null>(
    null,
  );
  // A monitor's tile is on screen the moment its dialog opens, so the picture
  // is asked for at once; the cache answers the second opening without work.
  const picture = useLookThumbnail(
    look?.picture ?? { lookId: display.id.toString(), version: '' },
    look?.picture ? glassElement : null,
  );
  const shown = picture.state === 'ready' ? picture.url : undefined;
  const [first, second = first, third = second] = look?.swatch ?? [];
  const glass = first
    ? ({
        '--screen-a': first,
        '--screen-b': second,
        '--screen-c': third,
      } as CSSProperties)
    : undefined;
  return (
    <>
      <span
        ref={setGlassElement}
        className={`wallpaper-monitor__glass${
          first ? '' : ' wallpaper-monitor__glass--ordinary'
        }${faded ? ' wallpaper-monitor__glass--faded' : ''}${
          first && calm ? ' wallpaper-monitor__glass--calm' : ''
        }${shown ? ' wallpaper-monitor__glass--pictured' : ''}`}
        style={glass}
        aria-hidden="true"
      >
        {shown && (
          <img
            className="wallpaper-monitor__picture"
            src={shown}
            alt=""
            draggable={false}
          />
        )}
      </span>
      {/* Over a frame of the scene itself, how it moves is a mark in the
          corner: the silhouette that says it on a plain glass would lie across
          the picture as a set of stripes. */}
      {shown && (
        <span
          className="wallpaper-monitor__motion"
          data-motion={calm ? 'calm' : 'music'}
          aria-hidden="true"
        >
          <Glyph name={calm ? 'calm' : 'music'} />
        </span>
      )}
      <span className="wallpaper-monitor__content" aria-hidden="true">
        <span className="wallpaper-monitor__top">
          <span className="wallpaper-monitor__number">{number}</span>
          {display.primary && (
            <span className="wallpaper-monitor__primary">
              {t('wallpaper.monitor.primary')}
            </span>
          )}
        </span>
        <span className="wallpaper-monitor__look">
          {look ? look.name : t('wallpaper.monitor.ordinary')}
        </span>
        {screen && (
          <span
            className={`wallpaper-monitor__phase wallpaper-monitor__phase--${screen.phase}`}
          >
            {t(screenPhaseKey(screen))}
          </span>
        )}
      </span>
      <span className="wallpaper-monitor__check" aria-hidden="true">
        <Glyph name="check" />
      </span>
    </>
  );
}
