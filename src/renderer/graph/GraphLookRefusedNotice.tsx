/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import { resolveSceneName } from 'common/scenePacks';
import PlusToastStack from '../plus/PlusToastStack';
import { useTranslation } from '../utils/I18nContext';
import {
  retryLook,
  useLookRefusal,
  type ILookRefusal,
  type TLookRefusal,
} from './lookRefusal';
import '../styles/SceneUpdateNotice.scss';

const SAID: Record<TLookRefusal, TranslationKey> = {
  compile: 'graph.look.refused.compile',
  heavy: 'graph.look.refused.heavy',
  unavailable: 'graph.look.refused.unavailable',
  driver: 'graph.look.refused.driver',
};

/**
 * Why the graph is showing a standard look in place of the one picked
 * (`lookRefusal.ts`), on the graph itself in the toast its update notice
 * uses, with Try again. A problem, so it stays until closed or tried; the
 * graph's choice is still the scene, so the next launch tries it as well.
 */
export default function GraphLookRefusedNotice() {
  const { t, locale } = useTranslation();
  const refusal = useLookRefusal();
  return (
    <div className="graph-update-notice">
      <PlusToastStack<ILookRefusal>
        sources={{ refused: refusal }}
        text={(entry) =>
          t(SAID[entry.reason], {
            name: resolveSceneName({ names: entry.names }, locale),
          })
        }
        action={(entry) => ({
          label: t('graph.look.retry'),
          run: () => retryLook(entry.lookId),
        })}
      />
    </div>
  );
}
