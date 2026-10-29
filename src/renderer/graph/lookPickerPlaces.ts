/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { requestAccountPanel } from '../account/accountPanel';
import { openGalleryPage, openPlusPlace } from '../plus/plusNavigation';
import { requestPlusTab } from '../plus/plusTabRequest';

/**
 * The look picker's ways out to the scenes' own places: the gallery's front
 * page or the Studio, in the Visualizers tab. The picker closes first, and a
 * signed-out reader is asked to sign in; the destination survives sign-in in
 * Plus's own navigation.
 */
const openLookPickerPlace = (
  place: 'gallery' | 'studio',
  onLeave: () => void,
  isSignedIn: boolean,
) => {
  if (place === 'gallery') {
    openGalleryPage({ kind: 'browse' });
  } else {
    openPlusPlace('studio');
  }
  onLeave();
  requestPlusTab();
  if (!isSignedIn) {
    requestAccountPanel();
  }
};

export default openLookPickerPlace;
