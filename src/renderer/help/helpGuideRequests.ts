/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Asks for the user guide from outside the Help menu, which owns it.
 *
 * The guide is the Help menu's to open: F1 and the menu's first entry both
 * land there, and What's New's "Open Help" is a third way in. A request is
 * heard by the Help menu that is mounted; while the window is the Compact
 * player none is, and nothing opens — the guide is a dialog of the full app.
 */
type TListener = () => void;

const listeners = new Set<TListener>();

export const requestHelpGuide = () => {
  listeners.forEach((listener) => listener());
};

export const onHelpGuideRequest = (listener: TListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
