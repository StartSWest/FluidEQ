/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useSyncExternalStore, type ReactNode } from 'react';
import type { TSettingsGroup } from 'common/settingsGroups';
import Chevron from '../icons/Chevron';
import { createFlagSetting } from '../utils/graphStorage';

/**
 * One of the groups a Studio card is arranged in, foldable on its own: the
 * four the test card shares with the graph's View menu
 * (`common/settingsGroups.ts`), and the three "What it hears now" reads the
 * music in (`StudioMeters.tsx`).
 *
 * Everything a scene is tried and tuned with is one card, in the order the
 * graph's View menu shows the same settings in — which makes the card as
 * tall as all four groups together, well past a laptop screen. Folding the
 * card away is not the answer to that: somebody tuning the response wants
 * the sliders and nothing else, not everything or nothing. So each group
 * puts its own rows away, as the menu's groups do, and each remembers how it
 * was left.
 *
 * Open unless it was folded before: a group nobody has touched must be
 * visible, or a member goes looking for a setting that is one click away and
 * invisible.
 */

/** The meters card's groups: the sound, its rhythm, and where the song is. */
type TMetersGroup = 'sound' | 'rhythm' | 'song';

/** Where each group's fold is kept. The menu keeps its own under its key. */
const SETTINGS: Record<
  TSettingsGroup | TMetersGroup,
  ReturnType<typeof createFlagSetting>
> = {
  own: createFlagSetting('fluideq.studioGroupFold.own', true),
  picture: createFlagSetting('fluideq.studioGroupFold.picture', true),
  visualizer: createFlagSetting('fluideq.studioGroupFold.visualizer', true),
  drawing: createFlagSetting('fluideq.studioGroupFold.drawing', true),
  sound: createFlagSetting('fluideq.studioGroupFold.sound', true),
  rhythm: createFlagSetting('fluideq.studioGroupFold.rhythm', true),
  song: createFlagSetting('fluideq.studioGroupFold.song', true),
};

interface IStudioCardGroupProps {
  group: TSettingsGroup | TMetersGroup;
  /** The group's name, the same word the graph's menu heads it with. */
  title: string;
  children: ReactNode;
}

export default function StudioCardGroup({
  group,
  title,
  children,
}: IStudioCardGroupProps) {
  const setting = SETTINGS[group];
  const open = useSyncExternalStore(setting.subscribe, setting.get, () => true);
  const bodyId = useId();
  return (
    <section
      className={`studio-group${open ? ' is-open' : ''}`}
      aria-label={title}
    >
      <button
        type="button"
        className="studio-group__head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setting.set(!open)}
      >
        <span className="studio-card__eyebrow studio-card__eyebrow--group">
          {title}
        </span>
        <Chevron className="studio-group__chevron" />
      </button>
      {/* The card's own 0fr-to-1fr reveal, so a group opens the way the card
          does and needs no measured height of its own. Its contents stay in
          the page for the transition; `inert` is what keeps Tab and a screen
          reader out of a group that is folded away. */}
      <div className="studio-group__reveal" id={bodyId} inert={!open}>
        <div className="studio-group__body">{children}</div>
      </div>
    </section>
  );
}
