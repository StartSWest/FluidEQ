/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState, type ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { readStored, writeStored } from '../utils/graphStorage';
import StudioWorkTabs, { type IStudioWorkTab } from './StudioWorkTabs';

export type TStudioWorkTab =
  'make' | 'code' | 'pictures' | 'tune' | 'drawing' | 'hears';

/** In the order they are offered, which is the order a scene is made in. */
const ORDER: readonly TStudioWorkTab[] = [
  'make',
  'code',
  'pictures',
  'tune',
  'drawing',
  'hears',
];

const LABELS: Record<TStudioWorkTab, TranslationKey> = {
  make: 'studio.work.make',
  code: 'studio.code.title',
  pictures: 'studio.work.pictures',
  tune: 'studio.work.tune',
  drawing: 'studio.performance.title',
  hears: 'studio.meters.title',
};

const STORAGE_KEY = 'fluideq.studio.workTab';

const readTab = (): TStudioWorkTab => {
  const stored = readStored(STORAGE_KEY);
  return ORDER.find((tab) => tab === stored) ?? 'make';
};

interface IStudioWorkProps {
  /**
   * Each tab's panel, built by the bench; a tab with none is not offered — a
   * scene that asks for no pictures has no Pictures tab, and "What it hears"
   * is a tab only while the window is too narrow for its column.
   */
  panels: Partial<Record<TStudioWorkTab, ReactNode>>;
  badges?: Partial<
    Record<TStudioWorkTab, Pick<IStudioWorkTab<string>, 'badge' | 'isAlert'>>
  >;
}

/**
 * The work under the stage, one tab at a time, the chosen tab remembered for
 * the next visit. A remembered tab this bench does not offer — Pictures for a
 * scene without any, "What it hears" in a wide window — is kept, not
 * overwritten, and the first tab stands in for it until it is offered again.
 */
export default function StudioWork({ panels, badges }: IStudioWorkProps) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<TStudioWorkTab>(readTab);
  const offered = ORDER.filter((tab) => panels[tab] !== undefined);
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
        ...badges?.[id],
      }))}
      selected={selected}
      onSelect={(id) => {
        setChosen(id);
        writeStored(STORAGE_KEY, id);
      }}
    >
      {panels[selected]}
    </StudioWorkTabs>
  );
}
