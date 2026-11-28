/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { IGalleryScene } from 'common/plusGallery';
import { useTranslation } from '../utils/I18nContext';
import GetPlusDialog from './GetPlusDialog';
import { plusOnSale, usePlusSubscription } from './plusSubscriptionStore';
import SceneGet from './SceneGet';

interface ISceneGetPlusFirstProps {
  scene: IGalleryScene;
  name: string;
  className: string;
}

/**
 * A card's way to a scene it cannot play yet: "Get", which opens Plus first -
 * every scene - with keeping just this one with a credit under it (Ivan,
 * 2026-11-28: Plus is the main thing, a credit the extra). Where Plus is not
 * to be had, it is the credit's own Get, as it always was.
 */
export default function SceneGetPlusFirst({
  scene,
  name,
  className,
}: ISceneGetPlusFirstProps) {
  const { t } = useTranslation();
  const plus = usePlusSubscription();
  const [open, setOpen] = useState(false);
  if (!plus || !plusOnSale(plus)) {
    return <SceneGet scene={scene} name={name} className={className} />;
  }
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {t('subscription.cardGet')}
      </button>
      {open && (
        <GetPlusDialog keep={{ scene, name }} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
