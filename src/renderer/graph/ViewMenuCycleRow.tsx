/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';

export const ViewMenuIcon = ({ children }: { children: ReactNode }) => (
  <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
    {children}
  </svg>
);

/**
 * One row that cycles its choice on each click, its current answer at the
 * right — and, when the answer is not yet in force, a note under it.
 */
export function CycleRow({
  hint,
  label,
  value,
  note,
  report,
  icon,
  onCycle,
}: {
  hint: TranslationKey;
  label: TranslationKey;
  value: string;
  note?: string;
  /** A fact under the row, on a full line of its own. */
  report?: string;
  icon: ReactNode;
  onCycle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="menuitem"
      title={t(hint)}
      className={report ? 'graph-view-menu__row--reported' : undefined}
      onClick={onCycle}
    >
      <ViewMenuIcon>{icon}</ViewMenuIcon>
      <span>{t(label)}</span>
      <span className="graph-view-menu__value">
        {value}
        {note && <span className="graph-view-menu__note">{note}</span>}
      </span>
      {report && <span className="graph-view-menu__report">{report}</span>}
    </button>
  );
}
