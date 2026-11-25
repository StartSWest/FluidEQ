/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import LitSlide from './LitSlide';
import TourLiveFigure from './TourLiveFigure';
import ColoursLive from './live26/ColoursLive';
import GalleryLive from './live26/GalleryLive';
import LooksLive from './live26/LooksLive';
import PublishLive from './live26/PublishLive';
import type { ISlideActions } from './slides';

/**
 * 2.6 in the Scenes tab's own What's New, look A like the sound's: the look
 * picker drawing every look live, the colours a scene lends the window,
 * publishing that records its own preview, and the gallery laid out like the
 * Library last, where the account's one free credit is, with the rest of the
 * release under it.
 */

export function LooksSlide({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.looks"
      onOpen={() => actions.openTab('eq')}
      figure={
        <TourLiveFigure
          Drawing={LooksLive}
          width={880}
          height={600}
          marks={[
            { target: '.look-picker__rail', side: 'left' },
            {
              target: '.look-picker__grid--styles > :first-child',
              side: 'corner',
            },
            { target: '.look-picker__views', side: 'left' },
          ]}
        />
      }
    />
  );
}

export function ColoursSlide({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.colours"
      onOpen={() => actions.openTab('community')}
      figure={
        <TourLiveFigure
          Drawing={ColoursLive}
          width={900}
          height={420}
          marks={[
            { target: '.window-colour-swatches', side: 'left' },
            { target: '.window-colours-preview', side: 'left' },
            { target: '.window-colour-finder', side: 'left' },
          ]}
        />
      }
    />
  );
}

export function GallerySlide({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.gallery"
      onOpen={() => actions.openTab('community')}
      figure={
        <TourLiveFigure
          Drawing={GalleryLive}
          width={1000}
          height={520}
          marks={[
            { target: '.gallery-search', side: 'left' },
            { target: '.gallery-card__thumb', side: 'left' },
            { target: '.gallery-card__get', side: 'left' },
          ]}
        />
      }
      also={{
        heading: 'tour.v26.alsoScenes',
        lines: [
          'tour.v26.alsoScenes.auto',
          'tour.v26.alsoScenes.ambient',
          'tour.v26.alsoScenes.karaoke',
          'tour.v26.alsoScenes.studio',
        ],
      }}
    />
  );
}

export function PublishSlide({ actions }: { actions: ISlideActions }) {
  return (
    <LitSlide
      prefix="tour.v26.publish"
      isTall
      onOpen={() => actions.openTab('community')}
      figure={
        <TourLiveFigure
          Drawing={PublishLive}
          width={560}
          height={520}
          marks={[
            { target: '.studio-publish__note-ai', side: 'left' },
            { target: '.studio-publish__note-head', side: 'left' },
            { target: '.studio-publish__video', side: 'left' },
          ]}
        />
      }
    />
  );
}
