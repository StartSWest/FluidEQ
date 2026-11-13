/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { createRoot } from 'react-dom/client';
import type { IGalleryScene, TPlusCategory } from 'common/plusGallery';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import GalleryCard from 'renderer/plus/GalleryCard';
import GalleryList from 'renderer/plus/GalleryList';
import { SceneStillsContext } from 'renderer/plus/scenePictures';
import { I18nProvider } from 'renderer/utils/I18nContext';
import 'renderer/styles/cascade';
import 'renderer/styles/App.scss';
import 'renderer/styles/Gallery.scss';
import hyperdrive from '../../../assets/plus/hyperdrive.jpg';
import lanternLake from '../../../assets/plus/lantern-lake.jpg';
import lanternNight from '../../../assets/plus/lantern-night-band.jpg';
import nebulaHeart from '../../../assets/plus/nebula-heart.jpg';
import neonHorizon from '../../../assets/plus/neon-horizon.jpg';
import prismBloom from '../../../assets/plus/prism-bloom.jpg';
import reefLight from '../../../assets/plus/reef-light.jpg';
import alpine from '../../../assets/tour/scene-alpine.jpg';
import aurora from '../../../assets/tour/scene-aurora.jpg';
import bloom from '../../../assets/tour/scene-bloom.jpg';
import chrome from '../../../assets/tour/scene-chrome.jpg';
import neonCity from '../../../assets/tour/scene-neon-city.jpg';

/**
 * The gallery as the signed-out Visualizers page shows it behind its glass
 * (`VisualizersSignedOut`): the gallery's own cards and nothing else, edge to
 * edge, handed FluidEQ's own scenes, each pictured by a still the app already
 * ships (`SceneStillsContext`), the way Help draws the gallery
 * (`help/live/plusFigures.tsx`). No rail, head, search or filters: behind the
 * page they read as a second copy of the app's navigation beside the real
 * side panel (Ivan, 2026-11-13). Every scene is FluidEQ's.
 */

const nothing = () => undefined;
const DAY = 86_400_000;

const SCENES: readonly [string, TPlusCategory, string, number][] = [
  ['Neon Horizon', 'cities', neonHorizon, 2],
  ['Alpine', 'nature', alpine, 18],
  ['Nebula Heart', 'space', nebulaHeart, 9],
  ['Aurora', 'nature', aurora, 4],
  ['Lantern Lake', 'water', lanternLake, 1],
  ['Chrome', 'abstract', chrome, 16],
  ['Hyperdrive', 'space', hyperdrive, 5],
  ['Neon City', 'cities', neonCity, 3],
  ['Reef Light', 'water', reefLight, 12],
  ['Bloom', 'abstract', bloom, 6],
  ['Prism Bloom', 'abstract', prismBloom, 20],
  ['Lantern Night', 'water', lanternNight, 2],
];

// Four walls of the twelve, each shifted, so no scene sits beside itself and
// the grid reaches past the foot of the capture.
const WALL = [0, 5, 2, 7].flatMap((shift) => [
  ...SCENES.slice(shift),
  ...SCENES.slice(0, shift),
]);
const now = Date.now();
const scenes: IGalleryScene[] = WALL.map(
  ([name, category, , daysAgo], index) => ({
    official: true,
    lookId: `ground-${index}`,
    authorId: FLUIDEQ_CREATOR_ID,
    sceneId: `ground-${index}`,
    authorName: 'FluidEQ',
    authorHandle: 'fluideq',
    version: 3 + (index % 5),
    category,
    names: { en: name },
    swatch: [],
    hasPhoto: true,
    likes: 420 - index * 11,
    likesWeek: 40 - index,
    adds: 1300 - index * 31,
    updatedAt: new Date(now - (daysAgo + 30) * DAY).toISOString(),
    liked: false,
    added: false,
  }),
);
const STILLS: ReadonlyMap<string, string> = new Map(
  WALL.map(([, , still], index) => [`ground-${index}`, still]),
);

function Gallery() {
  return (
    <SceneStillsContext.Provider value={STILLS}>
      <div
        className="gallery-page gallery-gallery"
        // Pinned to the page's top edge: the app's stylesheets leave room for
        // a title bar above the content, and that band became an empty strip
        // across the top of the picture.
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          minHeight: '100vh',
          padding: 10,
          background: 'var(--surface-base)',
        }}
      >
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
    </SceneStillsContext.Provider>
  );
}

const host = document.getElementById('root');
if (host) {
  createRoot(host).render(
    <I18nProvider>
      <Gallery />
    </I18nProvider>,
  );
}
