/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo } from 'react';
import {
  FLUIDEQ_CREATOR_ID,
  type IGalleryScene,
  type TPlusCategory,
} from '../../../../common/plusGallery';
import GalleryCard from '../../../plus/GalleryCard';
import GalleryList from '../../../plus/GalleryList';
import GalleryToolbar from '../../../plus/GalleryToolbar';
import { SceneStillsContext } from '../../../plus/scenePictures';
import aurora from '../../../../../assets/tour/scene-aurora.jpg';
import bloom from '../../../../../assets/tour/scene-bloom.jpg';
import chrome from '../../../../../assets/tour/scene-chrome.jpg';
import neonCity from '../../../../../assets/tour/scene-neon-city.jpg';
import nebulaHeart from '../../../../../assets/plus/nebula-heart.jpg';
import reefLight from '../../../../../assets/plus/reef-light.jpg';

const nothing = () => undefined;
const DAY = 86_400_000;

interface IMadeUpScene {
  lookId: string;
  name: string;
  category: TPlusCategory;
  still: string;
  likes: number;
  daysAgo: number;
  version: number;
  author?: { id: string; name: string; handle: string };
}

/**
 * Scenes made up for the picture, FluidEQ's own pictures under made-up
 * names, makers and counts, as Help's gallery figure does: never the
 * gallery's real listing, which the reader may not even be signed in for.
 */
const SCENES: readonly IMadeUpScene[] = [
  {
    lookId: 'tour-bloom',
    name: 'Bloom',
    category: 'abstract',
    still: bloom,
    likes: 412,
    daysAgo: 6,
    version: 10,
  },
  {
    lookId: 'tour-neon-city',
    name: 'Neon City',
    category: 'cities',
    still: neonCity,
    likes: 388,
    daysAgo: 15,
    version: 7,
  },
  {
    lookId: 'tour-reef-light',
    name: 'Reef Light',
    category: 'water',
    still: reefLight,
    likes: 301,
    daysAgo: 3,
    version: 4,
    author: { id: 'tour-member-iris', name: 'Iris Vale', handle: 'irisvale' },
  },
  {
    lookId: 'tour-chrome',
    name: 'Chrome',
    category: 'abstract',
    still: chrome,
    likes: 276,
    daysAgo: 16,
    version: 8,
  },
  {
    lookId: 'tour-aurora',
    name: 'Aurora',
    category: 'nature',
    still: aurora,
    likes: 254,
    daysAgo: 17,
    version: 8,
  },
  {
    lookId: 'tour-nebula-heart',
    name: 'Nebula Heart',
    category: 'space',
    still: nebulaHeart,
    likes: 187,
    daysAgo: 9,
    version: 3,
    author: { id: 'tour-member-theo', name: 'Theo Lind', handle: 'theolind' },
  },
];

const STILLS: ReadonlyMap<string, string> = new Map(
  SCENES.map((scene) => [scene.lookId, scene.still]),
);

const galleryScene = (scene: IMadeUpScene, now: number): IGalleryScene => ({
  official: !scene.author,
  lookId: scene.lookId,
  authorId: scene.author?.id ?? FLUIDEQ_CREATOR_ID,
  sceneId: scene.lookId,
  authorName: scene.author?.name ?? 'FluidEQ',
  authorHandle: scene.author?.handle ?? 'fluideq',
  version: scene.version,
  category: scene.category,
  names: { en: scene.name },
  swatch: [],
  hasPhoto: true,
  likes: scene.likes,
  likesWeek: Math.round(scene.likes / 9),
  adds: scene.likes * 3,
  updatedAt: new Date(now - scene.daysAgo * DAY).toISOString(),
  liked: false,
  added: false,
});

/**
 * The gallery's page as the Scenes tab draws it in 2.6: its search and order
 * on top, the categories in one row, and the cards under them — the
 * gallery's own toolbar, list and cards (`GalleryToolbar`, `GalleryList`,
 * `GalleryCard`), on made-up scenes.
 */
export default function GalleryLive() {
  const scenes = useMemo(() => {
    const now = Date.now();
    return SCENES.map((scene) => galleryScene(scene, now));
  }, []);
  return (
    <SceneStillsContext.Provider value={STILLS}>
      <div className="gallery-visualizers tour-live26-gallery">
        <div className="gallery-page gallery-gallery">
          <GalleryToolbar
            filters={{ sort: 'liked', text: '' }}
            onFilters={nothing}
            onMine={nothing}
          />
          <GalleryList
            list={{ scenes, more: false, loading: false, loaded: true }}
            onMore={nothing}
            onRetry={nothing}
            empty={null}
          >
            {scenes.map((scene) => (
              <GalleryCard
                key={scene.lookId}
                scene={scene}
                me={undefined}
                local={undefined}
                onOpen={nothing}
                onMaker={nothing}
              />
            ))}
          </GalleryList>
        </div>
      </div>
    </SceneStillsContext.Provider>
  );
}
