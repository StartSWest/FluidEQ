/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState, type ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { readStored, writeStored } from '../utils/graphStorage';
import { useSceneChatAsked } from './chat/askSceneChat';
import StudioWorkTabs, { type IStudioWorkTab } from './StudioWorkTabs';

export type TStudioWorkTab =
  'chat' | 'tune' | 'code' | 'pictures' | 'animations' | 'drawing' | 'hears';

/**
 * In the order they stand. The chat is a tab only in a bench too narrow for
 * its pane, and then it comes first: it is where the scene is made. "Make
 * with AI" was the first tab before the chat took its place.
 */
const ORDER: readonly TStudioWorkTab[] = [
  'chat',
  'tune',
  'code',
  'drawing',
  'hears',
  'pictures',
  'animations',
];

/**
 * Always in sight, at the row's end where the part that scrolls gives way
 * around them (Ivan, 2026-11-09: "make sure the pic and amaintor tab always
 * visible"): what a scene is drawn from, and offered for every project.
 */
const PINNED: ReadonlySet<TStudioWorkTab> = new Set(['pictures', 'animations']);

const LABELS: Record<TStudioWorkTab, TranslationKey> = {
  chat: 'studio.work.make',
  code: 'studio.code.title',
  pictures: 'studio.work.pictures',
  animations: 'studio.work.animations',
  tune: 'studio.work.tune',
  drawing: 'studio.performance.title',
  hears: 'studio.meters.title',
};

const STORAGE_KEY = 'fluideq.studio.workTab';

const readTab = (): TStudioWorkTab => {
  const stored = readStored(STORAGE_KEY);
  return ORDER.find((tab) => tab === stored) ?? 'chat';
};

interface IStudioWorkProps {
  /**
   * Each tab's panel, built by the bench; a tab with none is not offered —
   * "What it hears" is a tab only while the window is too narrow for its
   * column, and the chat only while the bench is too narrow for its pane.
   */
  panels: Partial<Record<TStudioWorkTab, ReactNode>>;
  badges?: Partial<
    Record<TStudioWorkTab, Pick<IStudioWorkTab<string>, 'badge' | 'isAlert'>>
  >;
  /** At the tab row's far end: the full screen's button that hides the pane. */
  end?: ReactNode;
}

/**
 * The work under the stage, one tab at a time, the chosen tab remembered for
 * the next visit. A remembered tab this bench does not offer — "What it
 * hears" in a wide window — is kept, not
 * overwritten, and the first tab stands in for it until it is offered again.
 */
export default function StudioWork({ panels, badges, end }: IStudioWorkProps) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<TStudioWorkTab>(readTab);
  const offered = ORDER.filter((tab) => panels[tab] !== undefined);
  // Asked for from another tab (the Animations tab's import, its hint): the
  // chat's tab, on a bench too narrow for its pane. A wide bench offers no
  // chat tab; its pane unfolds instead (`StudioChatColumn`).
  useSceneChatAsked(() => {
    if (panels.chat !== undefined) {
      setChosen('chat');
      writeStored(STORAGE_KEY, 'chat');
    }
  });
  const selected = offered.includes(chosen) ? chosen : offered[0];
  if (selected === undefined) {
    return null;
  }
  return (
    <StudioWorkTabs
      label={t('studio.work.label')}
      tabs={offered.map((id) => ({
        id,
        label: t(LABELS[id]),
        pinned: PINNED.has(id),
        ...badges?.[id],
      }))}
      selected={selected}
      onSelect={(id) => {
        setChosen(id);
        writeStored(STORAGE_KEY, id);
      }}
      end={end}
    >
      {panels[selected]}
    </StudioWorkTabs>
  );
}
