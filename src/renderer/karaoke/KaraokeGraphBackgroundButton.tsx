/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useTranslation } from '../utils/I18nContext';

/** Shared with the tour's inert illustration so its control cannot drift. */
export default function KaraokeGraphBackgroundButton({
  isSelected,
  onClick,
}: {
  isSelected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const label = t(
    isSelected ? 'karaoke.stage.hideGraph' : 'karaoke.stage.showGraph',
  );
  return (
    <button
      type="button"
      className="button small subtle karaoke-workspace__icon-action karaoke-workspace__graph-background-toggle"
      aria-label={label}
      title={label}
      aria-pressed={isSelected}
      onClick={onClick}
    >
      <svg
        className="karaoke-button__icon"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path d="M3 4.5h18v15H3zM6 12h2l2-4 4 8 2-4h2" />
      </svg>
    </button>
  );
}
