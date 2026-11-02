/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { Menu, nativeImage, Tray } from 'electron';
import log from 'electron-log';
import { PRODUCT_NAME } from '../common/branding';
import type { ITaskbarIconImage } from '../common/taskbarIcon';
import type {
  ITraySurface,
  ITrayTintedIcon,
  ITrayView,
  TTrayAction,
  TTrayMark,
} from './trayView';

/**
 * The tray drawn by Electron's own `Tray`: what every platform but Windows
 * has, and what Windows falls back to wherever FluidEQ-Tray cannot run.
 */

/** What a Windows menu asks for at 100%; the 2x representation covers 200%. */
const MENU_ICON_PX = 16;

/** The display scales a menu icon carries a drawing for, by its size. */
const MENU_ICON_SCALES = [1, 1.25, 1.5, 2] as const;

/**
 * A menu-sized mark from `base`, with `retina` as its 2x representation.
 *
 * NativeImages rather than paths, because a menu icon has to carry both
 * scalings: Windows asks for these in device pixels, and a lone 16px bitmap
 * on the 150% display most laptops run gets scaled up by the shell into the
 * same resampled smudge the multi-resolution .ico exists to avoid.
 *
 * Null rather than an empty image when the asset is unreadable: Electron
 * accepts an empty NativeImage on a menu item without complaint, and it
 * reserves the icon gutter and paints nothing into it — an item that looks
 * like its icon failed to load rather than one that never had one.
 */
const loadMenuIcon = (
  base: string,
  retina: string,
): Electron.NativeImage | null => {
  const source = nativeImage.createFromPath(base);
  if (source.isEmpty()) {
    return null;
  }
  const icon = source.resize({
    width: MENU_ICON_PX,
    height: MENU_ICON_PX,
    quality: 'best',
  });
  const large = nativeImage.createFromPath(retina);
  if (!large.isEmpty()) {
    icon.addRepresentation({
      scaleFactor: 2,
      buffer: large
        .resize({
          width: MENU_ICON_PX * 2,
          height: MENU_ICON_PX * 2,
          quality: 'best',
        })
        .toPNG(),
    });
  }
  return icon;
};

/**
 * One drawing as Chromium holds a bitmap: BGRA with each colour already
 * multiplied by its alpha, which is what `createFromBitmap` reads. The
 * drawings are straight RGBA (`ITaskbarIconImage`); read as they are, red and
 * blue would trade places and every soft edge would carry a light fringe.
 */
const nativeBitmap = ({ rgba }: ITaskbarIconImage): Buffer => {
  const out = Buffer.alloc(rgba.length);
  for (let at = 0; at < rgba.length; at += 4) {
    const alpha = rgba[at + 3];
    out[at] = Math.round((rgba[at + 2] * alpha) / 255);
    out[at + 1] = Math.round((rgba[at + 1] * alpha) / 255);
    out[at + 2] = Math.round((rgba[at] * alpha) / 255);
    out[at + 3] = alpha;
  }
  return out;
};

/**
 * The menu's icon from the drawings themselves, one per display scale the
 * menu is drawn at, exactly as the .ico holds them: never one bitmap the
 * shell resamples, the smudge `loadMenuIcon` exists to avoid. Null without
 * the 16px drawing the menu asks for at 100%.
 */
export const menuIconFromDrawings = (
  drawings: readonly ITaskbarIconImage[],
): Electron.NativeImage | null => {
  const drawingAt = (scale: number) =>
    drawings.find(({ size }) => size === MENU_ICON_PX * scale);
  const base = drawingAt(1);
  if (!base) {
    return null;
  }
  const icon = nativeImage.createFromBitmap(nativeBitmap(base), {
    width: base.size,
    height: base.size,
  });
  MENU_ICON_SCALES.slice(1).forEach((scaleFactor) => {
    const drawing = drawingAt(scaleFactor);
    if (drawing) {
      icon.addRepresentation({
        scaleFactor,
        buffer: nativeImage
          .createFromBitmap(nativeBitmap(drawing), {
            width: drawing.size,
            height: drawing.size,
          })
          .toPNG(),
      });
    }
  });
  return icon;
};

/**
 * Electron's tray, on `icon` until it is first shown; undefined when it
 * cannot be made, which the caller reports (`tray.ts`).
 */
export const createElectronTraySurface = (
  assetsPath: string,
  icon: string,
  pressed: (action: TTrayAction) => void,
): ITraySurface | undefined => {
  let tray: Tray;
  try {
    tray = new Tray(icon);
  } catch (error) {
    log.error(`Could not create the ${PRODUCT_NAME} tray icon`, error);
    return undefined;
  }
  // The drawn 16px art rather than the app icon resampled down to it: 16px
  // is where a mark either survives or turns to mush, and assets/icons holds
  // a frame drawn at exactly that size. Falling back to the tray's own icon
  // keeps the item iconless-but-working rather than gutter-with-a-hole if
  // that directory ever stops shipping.
  const plainMenuIcon =
    loadMenuIcon(
      path.join(assetsPath, 'icons', '16x16.png'),
      path.join(assetsPath, 'icons', '32x32.png'),
    ) ?? loadMenuIcon(icon, icon);
  const updateMenuIcons = new Map<string, Electron.NativeImage | null>();
  // Made once per drawing handed in, not once per menu built.
  let tinted: { from?: ITrayTintedIcon; image: Electron.NativeImage | null } = {
    image: null,
  };

  const markImage = (
    mark: TTrayMark | undefined,
    marks: ITrayView['marks'],
  ): Electron.NativeImage | undefined => {
    if (mark === 'update') {
      // Same source as the notification area is showing, badge and all, so
      // the menu that opens off a badged icon is not wearing the plain one.
      if (!updateMenuIcons.has(marks.update)) {
        updateMenuIcons.set(
          marks.update,
          loadMenuIcon(marks.update, marks.update),
        );
      }
      return updateMenuIcons.get(marks.update) ?? plainMenuIcon ?? undefined;
    }
    if (mark !== 'app') {
      return undefined;
    }
    // The tray's own mark, drawn or installed, so the menu matches the icon
    // it opened from (Ivan, 2026-10-26: "in the systry the icon is now tinet
    // but not inside th emenu that opens").
    if (marks.tinted && marks.tinted !== tinted.from) {
      tinted = {
        from: marks.tinted,
        image: menuIconFromDrawings(marks.tinted.drawings),
      };
    }
    return (marks.tinted ? tinted.image : null) ?? plainMenuIcon ?? undefined;
  };

  // Windows convention: left click opens the thing, right click opens the
  // menu (which Electron wires to the context menu by itself). On macOS a
  // left click opens the menu instead, so this only ever fires where it is
  // wanted. Double click is the older Windows habit and still what a lot of
  // people do.
  tray.on('click', () => pressed('open'));
  tray.on('double-click', () => pressed('open'));

  return {
    show: (view) => {
      if (tray.isDestroyed()) {
        return;
      }
      tray.setImage(view.icon);
      tray.setToolTip(view.tooltip);
      const template: Electron.MenuItemConstructorOptions[] = [];
      view.menu.forEach((entry) => {
        template.push({
          label: entry.label,
          icon: markImage(entry.mark, view.marks),
          click: () => pressed(entry.id),
        });
        if (entry.separatorAfter) {
          template.push({ type: 'separator' });
        }
      });
      // The menu is built once and handed to the tray, so it follows a
      // change only by being built again.
      tray.setContextMenu(Menu.buildFromTemplate(template));
    },
    // Windows keeps a dead tray icon on screen until something makes it
    // repaint, so a process that exits without this leaves a ghost the user
    // can click on and get nothing from.
    destroy: () => {
      if (!tray.isDestroyed()) {
        tray.destroy();
      }
    },
  };
};
