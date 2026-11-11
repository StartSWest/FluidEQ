/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { AUTOMATIC_PRESET_PREFIX } from 'common/constants';
import type { IRecoveredProfile } from 'common/recoveredProfiles';
import type { TranslationKey } from 'common/i18n/en';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { useNoticeTurn } from '../utils/noticeTurn';
import CompactFrame from './CompactFrame';
import '../styles/ProfileRecoveredNotice.scss';

const bridge = () => window.electron?.ipcRenderer;

/** What each kind of repair says, of the output it was made on. */
const SAYS: Record<IRecoveredProfile['how'], TranslationKey> = {
  copied: 'notice.profileRecovered.copied',
  own: 'notice.profileRecovered.own',
  new: 'notice.profileRecovered.new',
};

/**
 * Says, once, which outputs had lost their profile at launch and what each
 * plays now (`recoverMissingProfiles`).
 *
 * An output whose profile was gone used to drop out of the config without a
 * word anyone could see: no EQ and no rack on it, a log line nobody reads.
 * The launch now gives it a profile, and this is where it says which — in
 * the corner, like every notice that is something to know rather than
 * something to answer, and before the Plus terms, because it is about the
 * sound being heard. Put away, it is gone for good: main forgets the list.
 */
const ProfileRecoveredNotice = () => {
  const { t } = useTranslation();
  const [recovered, setRecovered] = useState<IRecoveredProfile[]>([]);
  const isShown = useNoticeTurn('profiles', recovered.length > 0);

  useEffect(() => {
    let isCurrent = true;
    bridge()
      ?.getRecoveredProfiles?.()
      .then((list) => {
        if (isCurrent) {
          setRecovered(list);
        }
        return undefined;
      })
      .catch(() => {
        // No backend, or no handler: nothing to say, which is the state.
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (!isShown) {
    return null;
  }

  // An output's automatic profile under the name its picker gives it
  // (`OutputProfileSelect`), never the hidden file name behind it.
  const shown = (name: string) =>
    name.startsWith(AUTOMATIC_PRESET_PREFIX) ? t('output.mapping.live') : name;

  const putAway = () => {
    // Gone at once: a notice that lingers after its close reads as a button
    // that did nothing.
    setRecovered([]);
    bridge()
      ?.recoveredProfilesSeen?.()
      .catch(() => undefined);
  };

  return (
    <CompactFrame
      className="profile-recovered-notice"
      role="status"
      aria-modal={undefined}
      icon={<MenuIcon name="eqBars" />}
      title={t(
        recovered.length === 1
          ? 'notice.profileRecovered.title'
          : 'notice.profileRecovered.titleMany',
      )}
      titleId="profile-recovered-notice-title"
      onClose={putAway}
      closeLabel={t('app.dismiss')}
    >
      <ul className="profile-recovered-notice__list">
        {recovered.map(({ deviceName, missing, now, how }) => (
          <li
            key={`${deviceName}/${missing}`}
            className="profile-recovered-notice__output"
          >
            <span className="profile-recovered-notice__name">{deviceName}</span>
            <span className="profile-recovered-notice__what">
              {t(SAYS[how], { missing: shown(missing), now: shown(now) })}
            </span>
          </li>
        ))}
      </ul>
    </CompactFrame>
  );
};

export default ProfileRecoveredNotice;
