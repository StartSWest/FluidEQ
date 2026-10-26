/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IWallpaperDisplay, IWallpaperScreen } from 'common/wallpaper';
import Glyph from '../../community/Glyph';
import DialogFrame from '../../components/DialogFrame';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import {
  MonitorFace,
  MonitorStage,
  monitorPosition,
  useMonitorLayout,
} from '../../wallpaper/MonitorStage';
import {
  WallpaperDialogSettings,
  WallpaperMotionPicker,
} from '../../wallpaper/WallpaperDialogParts';
import type { IWallpaperLook } from '../../wallpaper/wallpaperLooks';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import neonCity from '../../../../assets/tour/scene-neon-city.jpg';
import '../../styles/WallpaperControls.scss';

/**
 * The desktop chapter's dialog, drawn by the dialog's own frame, monitor
 * stage and tiles and its two blocks of choices (`helpChapters/plus.ts`):
 * Neon City about to be set on the middle of three made-up monitors, the
 * one on the right already playing Aurora. The dialog itself reads the
 * reader's monitors and plays the chosen scene live on its tile; here each
 * tile shows the still the app ships, and the section's head and the foot's
 * buttons are its markup, class for class, as `WallpaperDialog` draws them.
 */

const nothing = () => undefined;

const DISPLAYS: readonly IWallpaperDisplay[] = [
  {
    id: 1,
    label: 'Left',
    x: -1920,
    y: 180,
    width: 1920,
    height: 1080,
    primary: false,
  },
  {
    id: 2,
    label: 'Main',
    x: 0,
    y: 0,
    width: 2560,
    height: 1440,
    primary: true,
  },
  {
    id: 3,
    label: 'Right',
    x: 2560,
    y: 180,
    width: 1920,
    height: 1080,
    primary: false,
  },
];

const look = (name: string, still: string, swatch: string[]) => ({
  name,
  swatch,
  picture: { lookId: `help-${name}`, version: '1', still },
});

const NEON_CITY: IWallpaperLook = look('Neon City', neonCity, [
  '#ff3cac',
  '#784ba0',
  '#2b86c5',
]);

const AURORA: IWallpaperLook = look('Aurora', aurora, [
  '#2ce0a0',
  '#3a7bff',
  '#b05cff',
]);

/** The right-hand monitor, already showing a scene of its own. */
const RIGHT_SCREEN: IWallpaperScreen = {
  displayId: 3,
  lookId: 'help-Aurora',
  wave: { height: 0.6, position: 0 },
  motion: 'calm',
  phase: 'running',
};

/** The dialog for Neon City on the main monitor, as it opens over the page. */
const DesktopDialogDrawing = () => {
  const { t } = useTranslation();
  const layout = useMonitorLayout(DISPLAYS);
  return (
    <DialogFrame
      className="wallpaper-dialog"
      icon={<MenuIcon name="monitor" />}
      title={t('wallpaper.title')}
      titleId="help-desktop-dialog-title"
      badge={
        <span className="wallpaper-dialog__subject">{NEON_CITY.name}</span>
      }
      description={t('wallpaper.description')}
      closeLabel={t('wallpaper.cancel')}
      onClose={nothing}
      footer={
        <>
          <button type="button" className="button small subtle">
            {t('wallpaper.stop')}
          </button>
          <div className="dialog-frame__actions">
            <button type="button" className="button small subtle">
              {t('wallpaper.cancel')}
            </button>
            <button type="button" className="button small">
              {t('wallpaper.start')}
            </button>
          </div>
        </>
      }
    >
      <section className="wallpaper-dialog__monitors">
        <div className="wallpaper-dialog__section-head">
          <span className="wallpaper-dialog__section-copy">
            <span className="eyebrow">{t('wallpaper.monitors')}</span>
            <span className="wallpaper-dialog__hint">
              {t('wallpaper.monitors.hint')}
            </span>
          </span>
          <button
            type="button"
            className="button small subtle wallpaper-toggle"
            aria-pressed={false}
          >
            <span className="wallpaper-toggle__box" aria-hidden="true">
              <Glyph name="check" />
            </span>
            {t('wallpaper.monitors.all')}
          </button>
        </div>
        <MonitorStage layout={layout} label={t('wallpaper.monitors')}>
          {(placement) => {
            const isChosen = placement.display.primary;
            const shows =
              placement.display.id === RIGHT_SCREEN.displayId
                ? RIGHT_SCREEN
                : undefined;
            return (
              <button
                key={placement.display.id}
                type="button"
                role="checkbox"
                aria-checked={isChosen}
                className="wallpaper-monitor wallpaper-monitor--choice"
                style={monitorPosition(placement)}
              >
                <MonitorFace
                  placement={placement}
                  look={
                    (isChosen && NEON_CITY) || (shows && AURORA) || undefined
                  }
                  screen={shows}
                  faded={shows !== undefined}
                  calm={shows !== undefined}
                  follows={isChosen}
                />
              </button>
            );
          }}
        </MonitorStage>
      </section>
      <WallpaperMotionPicker
        motion="music"
        onMotion={nothing}
        disabled={false}
      />
      <WallpaperDialogSettings
        wave={{ height: 0.75, position: 0.1 }}
        onWave={nothing}
        follows
        onFollows={nothing}
        pauseOnBattery
        onPauseOnBattery={nothing}
        disabled={false}
      />
    </DialogFrame>
  );
};

export default DesktopDialogDrawing;
