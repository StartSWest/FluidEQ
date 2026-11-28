/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { IGalleryScene } from 'common/plusGallery';
import { SCENE_PRICE_CREDITS } from 'common/sceneStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { creditsText } from './credits';
import GetPlusButton from './GetPlusButton';
import PlusMark from './PlusMark';
import { plusOnSale, usePlusSubscription } from './plusSubscriptionStore';
import { plansText } from './plusWords';
import SceneGet, { officialLine } from './SceneGet';

interface ISceneWaysProps {
  scene: IGalleryScene;
  name: string;
  /** This account plays it now: its own, got with a credit, or through Plus. */
  owned: boolean;
  /** This account keeps it whatever Plus does: its own, or got with a credit. */
  keeps: boolean;
  /** Add, Update or Play, for a scene this account plays. */
  primary: ReactNode;
  /** The heart, as this account may use it. */
  heart: ReactNode;
}

/**
 * How a scene becomes this account's, on its page, beside its figures.
 *
 * Without it and without Plus: Plus first and loud - this scene and every
 * other - and keeping just this one with a credit under it, the extra that
 * stays even without Plus (Ivan, 2026-11-28: "make crlear plus is the main
 * thing"). Played through Plus:
 * included, with the way to keep it past Plus. Kept: as it always was.
 */
export default function SceneWays({
  scene,
  name,
  owned,
  keeps,
  primary,
  heart,
}: ISceneWaysProps) {
  const { t, locale } = useTranslation();
  const plus = usePlusSubscription();
  const credits = creditsText(t, locale, SCENE_PRICE_CREDITS);

  if (!owned && plus && plusOnSale(plus)) {
    return (
      <section className="scene-ways" aria-labelledby="scene-ways-title">
        <div className="scene-ways__head">
          <span id="scene-ways-title" className="eyebrow">
            {t('subscription.scene.twoWays')}
          </span>
          {heart}
        </div>
        <div className="scene-ways__way scene-ways__way--plus">
          <span className="scene-ways__name">
            <PlusMark />
            {t('subscription.scene.plus.title')}
          </span>
          <span className="scene-ways__body">
            {t('subscription.scene.plus.body', {
              prices: plansText(t, plus.plans, locale),
            })}
          </span>
          <GetPlusButton
            label={t(plus.lapse ? 'subscription.getAgain' : 'subscription.get')}
            className="button small"
          />
        </div>
        <div className="scene-ways__way scene-ways__way--extra">
          <span className="scene-ways__name">
            <Glyph name="credit" />
            {t('subscription.scene.keep.title')}
          </span>
          <span className="scene-ways__body">
            {t('subscription.scene.keep.body', { credits })}
          </span>
          <SceneGet scene={scene} name={name} className="button small subtle" />
        </div>
      </section>
    );
  }

  const throughPlus = owned && !keeps;
  return (
    <>
      {throughPlus && (
        <p className="gallery-included scene-ways__included">
          <PlusMark />
          {t('subscription.included')}
        </p>
      )}
      {!throughPlus && scene.official && (
        <p className="gallery-included">
          <Glyph name={keeps ? 'check' : 'credit'} />
          {officialLine(t, keeps)}
        </p>
      )}
      <div className="gallery-scene__actions">
        {primary}
        {heart}
      </div>
      {throughPlus && (
        <>
          <p className="gallery-fine">{t('subscription.scene.member.note')}</p>
          <div className="scene-ways__keep">
            <span>{t('subscription.scene.member.keep')}</span>
            <SceneGet
              scene={scene}
              name={name}
              className="button small subtle"
              label={t('subscription.scene.member.keepButton', { credits })}
            />
          </div>
        </>
      )}
    </>
  );
}
