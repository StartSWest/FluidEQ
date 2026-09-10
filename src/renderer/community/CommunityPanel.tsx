import { useEffect, useState } from 'react';
import { isCheckoutConfigured } from 'common/accountConfig';
import { requestAccountPanel } from '../account/accountPanel';
import { useAccount } from '../account/accountStore';
import { useEntitlement } from '../account/entitlementStore';
import { useTranslation } from '../utils/I18nContext';
import { channelDescription, channelName } from './channelNames';
import {
  acceptConduct,
  blockUser,
  clearCommunityError,
  closeCommunity,
  createProfile,
  deleteMessage,
  loadOlder,
  openCommunity,
  reportMessage,
  selectChannel,
  sendMessage,
  unblockUser,
  useCommunity,
} from './communityStore';
import Avatar from './Avatar';
import Composer from './Composer';
import Glyph, { channelGlyph } from './Glyph';
import LeaderboardView from './LeaderboardView';
import MessageThread from './MessageThread';
import StudioPanel from '../studio/StudioPanel';
import '../styles/CommunityRail.scss';
import '../styles/Community.scss';
import '../styles/Leaderboard.scss';

interface ICommunityPanelProps {
  /** Opens the Account panel; sign-in lives there, not here. */
  onSignIn: () => void;
}

/**
 * The Community tab.
 *
 * A place you go and stay, which is why it is a tab and the Account is a
 * dialog. Channels down the left with a picture each, the conversation in the
 * middle, and at the bottom whatever stands between this person and posting —
 * see `Composer`. The rail ends with the person themself, because a chat
 * should say who you are in it before you say anything.
 *
 * Reading is free for anyone signed in; posting is for Plus. Neither rule is
 * decided here. The database decides, and this panel only shows the sentence
 * that goes with its answer.
 *
 * The live feed is open exactly as long as this tab is mounted: the free tier
 * allows two hundred listeners at once, and a chat nobody is looking at does
 * not need one.
 */
export default function CommunityPanel({ onSignIn }: ICommunityPanelProps) {
  const { t } = useTranslation();
  const account = useAccount();
  const entitlement = useEntitlement();
  const community = useCommunity();
  const signedIn = account.status === 'signed-in';
  const entitled = entitlement.state !== 'none';
  // Which of the rail's places fills the main area: a channel's conversation,
  // the leaderboard, or the Studio.
  const [view, setView] = useState<'channel' | 'board' | 'studio'>('channel');

  useEffect(() => {
    if (!signedIn) {
      return undefined;
    }
    openCommunity().catch(() => undefined);
    return () => closeCommunity();
  }, [signedIn]);

  if (!signedIn) {
    return (
      <div className="community community--signed-out">
        <div className="community__welcome">
          <span className="community__welcome-mark" aria-hidden="true">
            <Glyph name="general" />
          </span>
          <span className="community__welcome-title">
            {t('community.signIn.title')}
          </span>
          <span className="community__welcome-body">
            {t('community.signIn.body')}
          </span>
          <ul className="community__perks">
            <li>
              <Glyph name="channel" />
              {t('community.hero.read')}
            </li>
            <li>
              <Glyph name="mention" />
              {t('community.hero.post')}
            </li>
            <li>
              <Glyph name="board" />
              {t('community.hero.board')}
            </li>
          </ul>
          <button type="button" className="button small" onClick={onSignIn}>
            {t('community.signIn.button')}
          </button>
        </div>
      </div>
    );
  }

  const active =
    community.channels.find(
      (channel) => channel.id === community.activeChannelId,
    ) ?? community.channels[0];
  const messages = active ? (community.messagesByChannel[active.id] ?? []) : [];
  const unreadIn = (channelId: string) =>
    community.unreadMentions.filter(
      (mention) => mention.channelId === channelId,
    ).length;

  const liveLabel = {
    live: t('community.live'),
    connecting: t('community.connecting'),
    error: t('community.offline'),
    closed: t('community.offline'),
  }[community.live];

  const { profile } = community;
  const ownName = profile?.displayName || account.identity?.name || '';
  const ownHandle = profile?.handle ?? account.identity?.email ?? '';

  return (
    <div className="community">
      <nav className="community__rail" aria-label={t('community.title')}>
        <div className="community__rail-head">
          <span className="eyebrow">{t('community.title')}</span>
          <span
            className={`community__live community__live--${community.live}`}
            title={liveLabel}
          >
            <span className="community__live-dot" aria-hidden="true" />
            <span className="community__live-word">{liveLabel}</span>
          </span>
        </div>

        <div className="community__channels">
          {community.channels.map((channel) => {
            const isActive = view === 'channel' && channel.id === active?.id;
            const unread = unreadIn(channel.id);
            return (
              <button
                key={channel.id}
                type="button"
                className={`community__channel${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                title={channelDescription(channel, t)}
                onClick={() => {
                  setView('channel');
                  selectChannel(channel.id).catch(() => undefined);
                }}
              >
                <span className="community__channel-mark">
                  <Glyph name={channelGlyph(channel.id)} />
                </span>
                <span className="community__channel-text">
                  <span className="community__channel-name">
                    {channelName(channel, t)}
                  </span>
                  <span className="community__channel-blurb">
                    {channelDescription(channel, t)}
                  </span>
                </span>
                {unread > 0 && (
                  <span
                    className="community__unread"
                    aria-label={t('community.mentions.unread', {
                      count: unread,
                    })}
                  >
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* A place in the rail rather than a channel: it is read, not
            written, and it belongs with the people it ranks. */}
        <button
          type="button"
          className={`community__channel community__channel--board${view === 'board' ? ' is-active' : ''}`}
          aria-current={view === 'board' ? 'true' : undefined}
          onClick={() => setView('board')}
        >
          <span className="community__channel-mark">
            <Glyph name="board" />
          </span>
          <span className="community__channel-text">
            <span className="community__channel-name">
              {t('leaderboard.title')}
            </span>
          </span>
        </button>

        {/* The Studio: where members make scenes. Under the board, because it
            is a place to go rather than a conversation to follow. */}
        <button
          type="button"
          className={`community__channel community__channel--studio${view === 'studio' ? ' is-active' : ''}`}
          aria-current={view === 'studio' ? 'true' : undefined}
          onClick={() => setView('studio')}
        >
          <span className="community__channel-mark">
            <Glyph name="studio" />
          </span>
          <span className="community__channel-text">
            <span className="community__channel-name">{t('studio.title')}</span>
            <span className="community__channel-blurb">
              {t('studio.rail.blurb')}
            </span>
          </span>
        </button>

        <div className="community__me">
          <Avatar handle={ownHandle} displayName={ownName} size="rail" />
          <span className="community__me-text">
            <span className="community__name">{ownName || ownHandle}</span>
            {profile && (
              <span className="community__handle">@{profile.handle}</span>
            )}
          </span>
          {profile?.role === 'admin' && (
            <span className="community__role community__role--admin">
              {t('community.role.admin')}
            </span>
          )}
          {profile?.role === 'contributor' && (
            <span className="community__role">
              {t('community.role.contributor')}
            </span>
          )}
          {profile?.role === 'member' && entitled && (
            <span className="community__role">{t('graph.scene.badge')}</span>
          )}
        </div>
        {community.blocks.length > 0 && (
          <div className="community__blocked">
            <span>
              {t('community.blocked.count', { count: community.blocks.length })}
            </span>
            <button
              type="button"
              className="community__link"
              onClick={() => {
                community.blocks.forEach((userId) => {
                  unblockUser(userId).catch(() => undefined);
                });
              }}
            >
              {t('community.blocked.unblockAll')}
            </button>
          </div>
        )}
      </nav>

      <section className="community__main">
        {view === 'studio' && <StudioPanel />}
        {view === 'board' && (
          <>
            <header className="community__head">
              <span className="community__head-mark">
                <Glyph name="board" />
              </span>
              <span className="community__head-name">
                {t('leaderboard.title')}
              </span>
            </header>
            <LeaderboardView />
          </>
        )}
        {view === 'channel' && active && (
          <header className="community__head">
            <span className="community__head-mark">
              <Glyph name={channelGlyph(active.id)} />
            </span>
            <span className="community__head-text">
              <span className="community__head-name">
                {channelName(active, t)}
              </span>
              <span className="community__head-description">
                {channelDescription(active, t)}
              </span>
            </span>
          </header>
        )}

        {view === 'channel' && (
          <MessageThread
            messages={messages}
            me={profile}
            emptyHint={active ? channelDescription(active, t) : ''}
            hasMore={
              active ? (community.hasMoreByChannel[active.id] ?? false) : false
            }
            loading={community.loadingChannel === active?.id}
            reported={community.reported}
            onLoadOlder={() => {
              loadOlder().catch(() => undefined);
            }}
            onReport={(id) => {
              reportMessage(id, 'reported from the app').catch(() => undefined);
            }}
            onBlock={(userId) => {
              blockUser(userId).catch(() => undefined);
            }}
            onDelete={(id) => {
              deleteMessage(id).catch(() => undefined);
            }}
          />
        )}

        {view === 'channel' && active && (
          <Composer
            channel={active}
            profile={profile}
            profileLoaded={community.profileLoaded}
            entitled={entitled}
            checkoutAvailable={isCheckoutConfigured()}
            error={community.error}
            onSend={sendMessage}
            onCreateProfile={createProfile}
            onAcceptConduct={acceptConduct}
            onUpgrade={() => requestAccountPanel('subscribe')}
            onClearError={clearCommunityError}
          />
        )}
      </section>
    </div>
  );
}
