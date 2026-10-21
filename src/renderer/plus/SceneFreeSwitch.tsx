/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import Switch from '../widgets/Switch';
import { useTranslation } from '../utils/I18nContext';
import { storeFailureKey } from './CreditPacks';
import { setOfficialSceneFree, useSceneStore } from './sceneStore';

/**
 * The admin's switch on one of FluidEQ's own scenes: free for every account,
 * or one credit (Ivan, 2026-10-21: "some scenes if I decide from fluid can be
 * free"). Only FluidEQ's: a member's scene is never free for anyone but its
 * maker, and the server refuses anything else and anyone else (premium 0061).
 */
export default function SceneFreeSwitch({ sceneId }: { sceneId: string }) {
  const { t } = useTranslation();
  const id = useId();
  const { store } = useSceneStore();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<TranslationKey>();
  const free = store?.free?.includes(sceneId) ?? false;
  // A server before 0061 says nothing about free scenes: there is nothing to
  // switch, so there is no switch.
  if (!store?.free) {
    return null;
  }
  const toggle = () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setFailure(undefined);
    setOfficialSceneFree(sceneId, !free)
      .then((outcome) => {
        setSaving(false);
        if (!outcome.ok) {
          setFailure(storeFailureKey(outcome.reason));
        }
        return undefined;
      })
      .catch(() => {
        setSaving(false);
        setFailure('store.error.offline');
      });
  };
  return (
    <div className="gallery-scene__inspect gallery-scene__free">
      <div className="gallery-scene__free-row">
        <span className="gallery-scene__free-text">
          <span className="gallery-scene__free-title">
            {t('store.admin.freeTitle')}
          </span>
          <span className="gallery-scene__inspect-hint">
            {t(free ? 'store.admin.freeOn' : 'store.admin.freeOff')}
          </span>
        </span>
        <Switch
          id={id}
          isOn={free}
          isDisabled={saving}
          handleToggle={toggle}
          ariaLabel={t('store.admin.freeTitle')}
        />
      </div>
      {failure && (
        <p className="gallery-dialog__error" role="alert">
          {t(failure)}
        </p>
      )}
    </div>
  );
}
