import { useState } from 'react';
import type { IForumPerson } from 'common/forum/forumTypes';
import Avatar from '../community/Avatar';

interface IForumAvatarProps {
  person: IForumPerson;
  size?: 'row' | 'rail';
  className?: string;
}

/**
 * A GitHub person's picture, and the community's two-letter disc when there
 * is none or it will not load — a deleted account, or no network. The disc
 * wears the same colour the login always gets, so the fallback still tells
 * two people apart.
 */
export default function ForumAvatar({
  person,
  size = 'row',
  className,
}: IForumAvatarProps) {
  const [broken, setBroken] = useState(false);
  if (!person.avatarUrl || broken) {
    return <Avatar handle={person.login} size={size} className={className} />;
  }
  return (
    <img
      className={`forum__avatar forum__avatar--${size}${className ? ` ${className}` : ''}`}
      src={person.avatarUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
