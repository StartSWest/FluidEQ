/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import neonHorizon from '../../../assets/plus/neon-horizon.jpg';
import lanternLake from '../../../assets/plus/lantern-lake.jpg';
import prismBloom from '../../../assets/plus/prism-bloom.jpg';
import { requestAccountPanel } from '../account/accountPanel';
import { useAccount } from '../account/accountStore';
import Glyph from '../community/Glyph';
import { openGalleryPage, openPlusPlace } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';
import { useTranslation } from '../utils/I18nContext';
import '../styles/PlusWelcome.scss';

const SCENES = [
  { name: 'plus.welcome.scene.neonHorizon', picture: neonHorizon },
  { name: 'plus.welcome.scene.lanternLake', picture: lanternLake },
  { name: 'plus.welcome.scene.prismBloom', picture: prismBloom },
] as const;

/** Discovery uses shipped scene stills, so opening an empty picker needs no server. */
export default function LookPickerDiscover({
  onLeave,
}: {
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const account = useAccount();
  const open = (place: 'visualizers' | 'studio') => {
    if (place === 'visualizers') {
      openGalleryPage({ kind: 'browse' });
    } else {
      openPlusPlace('studio');
    }
    onLeave();
    requestPlusTab();
    // The destination survives sign-in in the existing Plus navigation.
    if (account.status !== 'signed-in') {
      requestAccountPanel();
    }
  };
  return (
    <div className="look-picker__discover">
      <div className="look-picker__discover-story" data-anchored-menu-scroll>
        <h4 className="plus-welcome__title">
          {t('graph.picker.discover.title')}
        </h4>
        <div
          className="plus-welcome__scenes look-picker__discover-scenes"
          aria-hidden="true"
        >
          <img className="plus-welcome__glow" src={neonHorizon} alt="" />
          {SCENES.map(({ name, picture }) => (
            <figure className="plus-welcome__scene" key={name}>
              <img src={picture} alt="" />
              <figcaption>{t(name)}</figcaption>
            </figure>
          ))}
        </div>
        <p>{t('graph.picker.discover.body')}</p>
        <p className="look-picker__discover-fine">
          <Glyph name="check" />
          {t('graph.picker.discover.free')}
        </p>
      </div>
      <div className="look-picker__discover-footer">
        <div className="look-picker__discover-actions">
          <button
            type="button"
            className="button small"
            onClick={() => open('visualizers')}
          >
            <Glyph name="looks" />
            {t('graph.picker.discover.explore')}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={() => open('studio')}
          >
            <Glyph name="studio" />
            {t('graph.picker.discover.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
