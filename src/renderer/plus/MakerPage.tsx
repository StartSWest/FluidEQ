import { useMemo } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { useUsableMemberScenes } from '../utils/memberScenes';
import Avatar from '../community/Avatar';
import { identityStyle } from '../community/identity';
import GalleryCard from './GalleryCard';
import GalleryList from './GalleryList';
import { useGalleryList } from './galleryStore';
import { openGalleryPage, type IMakerRef } from './plusNavigation';

interface IMakerPageProps {
  maker: IMakerRef;
  me: string | undefined;
}

/**
 * Everything one member has published, and what it earned. Only the name and
 * handle they already show in Community: never an email, never an account id.
 */
export default function MakerPage({ maker, me }: IMakerPageProps) {
  const { t, locale } = useTranslation();
  const { list, loadMore, reload } = useGalleryList({
    sort: 'liked',
    authorId: maker.authorId,
  });
  const local = useUsableMemberScenes();
  const localById = useMemo(
    () => new Map(local.map((scene) => [scene.lookId, scene])),
    [local],
  );
  const numbers = new Intl.NumberFormat(locale);
  const totals = list.scenes.reduce(
    (sum, scene) => ({
      likes: sum.likes + scene.likes,
      adds: sum.adds + scene.adds,
    }),
    { likes: 0, adds: 0 },
  );
  const own = maker.authorId === me;
  const displayName = own
    ? t('plus.maker.you')
    : (maker.name ?? maker.handle ?? t('plus.card.anonymous'));
  const handle = maker.handle ?? maker.authorId;

  return (
    <div className="gallery-page gallery-maker">
      <header className="gallery-maker__head" style={identityStyle(handle)}>
        <Avatar
          handle={handle}
          displayName={maker.name ?? undefined}
          size="podium"
        />
        <span className="gallery-maker__who">
          <h3 className="gallery-maker__name community__name--hued">
            {displayName}
          </h3>
          {maker.handle && (
            <span className="community__handle">@{maker.handle}</span>
          )}
        </span>
        <dl className="gallery-figures gallery-maker__figures">
          <div>
            <dt>{t('plus.maker.scenes')}</dt>
            <dd>
              {numbers.format(list.scenes.length)}
              {list.more ? '+' : ''}
            </dd>
          </div>
          <div>
            <dt>{t('plus.scene.likes')}</dt>
            <dd>{numbers.format(totals.likes)}</dd>
          </div>
          <div>
            <dt>{t('plus.scene.adds')}</dt>
            <dd>{numbers.format(totals.adds)}</dd>
          </div>
        </dl>
      </header>

      <GalleryList
        list={list}
        onMore={loadMore}
        onRetry={reload}
        empty={
          <p className="community__empty-title">{t('plus.maker.empty')}</p>
        }
      >
        {list.scenes.map((scene) => (
          <GalleryCard
            key={scene.lookId}
            scene={scene}
            me={me}
            local={localById.get(scene.lookId)}
            onOpen={(next) => openGalleryPage({ kind: 'scene', scene: next })}
          />
        ))}
      </GalleryList>
    </div>
  );
}
