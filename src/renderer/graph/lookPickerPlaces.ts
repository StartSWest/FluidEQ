/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TPlusCategory } from 'common/plusGallery';
import { requestAccountPanel } from '../account/accountPanel';
import {
  openGalleryCategory,
  openGalleryPage,
  openPlusPlace,
  type IMakerRef,
} from '../plus/plusNavigation';
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
  /** The gallery filed under this category, from a chip with none of the member's. */
  category?: TPlusCategory,
) => {
  if (place === 'gallery' && category) {
    openGalleryCategory(category);
  } else if (place === 'gallery') {
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

/**
 * The gallery page of whoever made a scene, from its "by ..." in the picker
 * (Ivan, 2026-11-25: "if I click the user it should take me to the gallery
 * with that user filter, to see that user's scenes"): the maker page the
 * gallery's own cards open, FluidEQ's included. Left the same way as the
 * picker's other ways out.
 */
export const openLookPickerMaker = (
  maker: IMakerRef,
  onLeave: () => void,
  isSignedIn: boolean,
) => {
  openGalleryPage({ kind: 'maker', maker });
  onLeave();
  requestPlusTab();
  if (!isSignedIn) {
    requestAccountPanel();
  }
};

export default openLookPickerPlace;
