/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import type { TColourFinding } from '../utils/useColourFinder';

/**
 * Automatic, under the open point's three colours, where the colours it
 * finds land (Ivan, 2026-11-19: "let's move the Automatic button to some
 * place ... that button is for always finding colour"): the app's quiet
 * button, the app's working ring in place of its viewfinder while the
 * scene is looked at (`button-busy`, which shows only on a button left
 * enabled, so a press meanwhile is let go here instead), and beside
 * it which of the scene's colours the point now wears, so a second press
 * plainly finds another. Never held down by a point being automatic
 * already (it used to be, after one press): only while the editor is idle.
 */
export default function WindowColourFinder({
  finding,
  disabled = false,
  onFind,
}: {
  finding: TColourFinding;
  disabled?: boolean;
  onFind: () => void;
}) {
  const { t } = useTranslation();
  const looking = finding.kind === 'looking';
  let note = '';
  if (finding.kind === 'found') {
    note = t('graph.sceneColours.found', {
      index: finding.index + 1,
      count: finding.count,
    });
  } else if (finding.kind === 'none') {
    note = t('graph.sceneColours.findNone');
  } else if (finding.kind === 'failed') {
    note = t('graph.sceneColours.findFailed');
  }
  return (
    <div className="window-colour-finder">
      <button
        type="button"
        className={`button small subtle window-colour-finder__button${looking ? ' is-running' : ''}`}
        disabled={disabled}
        aria-busy={looking}
        data-tooltip={t('graph.sceneColours.findHint')}
        onClick={looking ? undefined : onFind}
      >
        {/* A viewfinder: four corners round the colour being looked for. */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          aria-hidden
          focusable="false"
        >
          <path d="M2 5.5V3a1 1 0 0 1 1-1h2.5M10.5 2H13a1 1 0 0 1 1 1v2.5M14 10.5V13a1 1 0 0 1-1 1h-2.5M5.5 14H3a1 1 0 0 1-1-1v-2.5" />
          <circle cx="8" cy="8" r="2.25" />
        </svg>
        {looking
          ? t('graph.sceneColours.finding')
          : t('graph.sceneColours.find')}
      </button>
      <span
        className={`window-colour-finder__note${finding.kind === 'none' || finding.kind === 'failed' ? ' is-warning' : ''}`}
        role="status"
      >
        {note}
      </span>
    </div>
  );
}
