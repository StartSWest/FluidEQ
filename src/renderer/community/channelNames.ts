import type { ICommunityChannel } from 'main/community/communityApi';
import type { Translate } from 'common/i18n';
import type { TranslationKey } from 'common/i18n/en';

/**
 * The four channels the server ships with, in the reader's language.
 *
 * The server stores English. A channel the app knows has a translation; one it
 * does not — added later on the server — shows the server's own name, which is
 * better than a key. Written out per id rather than built from the id, because
 * a template key is a string the key type cannot check and the first channel
 * added without a translation would render its key in every language.
 */
const NAME_KEYS: Readonly<Record<string, TranslationKey>> = {
  general: 'community.channel.general',
  looks: 'community.channel.looks',
  help: 'community.channel.help',
  'feature-requests': 'community.channel.featureRequests',
};

const DESCRIPTION_KEYS: Readonly<Record<string, TranslationKey>> = {
  general: 'community.channelDescription.general',
  looks: 'community.channelDescription.looks',
  help: 'community.channelDescription.help',
  'feature-requests': 'community.channelDescription.featureRequests',
};

export const channelName = (channel: ICommunityChannel, t: Translate) => {
  const key = NAME_KEYS[channel.id];
  return key ? t(key) : channel.name;
};

export const channelDescription = (
  channel: ICommunityChannel,
  t: Translate,
) => {
  const key = DESCRIPTION_KEYS[channel.id];
  return key ? t(key) : channel.description;
};
