import type { IForumBoard } from '../../../common/forum/forumTypes';
import { translate, type Translate } from '../../../common/i18n';
import { boardGlyph } from '../../../renderer/forum/ForumGlyph';
import {
  boardDescription,
  boardGuidance,
  boardName,
} from '../../../renderer/forum/boardNames';

/**
 * The Tips & tricks board was created by hand on GitHub, so its name reaches
 * the app only as a slug. GitHub drops the ampersand ("tips-tricks"); the
 * spelled-out name gives "tips-and-tricks". Either must read as the board in
 * the reader's language, never as GitHub's English name.
 */

const german: Translate = (key, vars) => translate('de', key, vars);
const english: Translate = (key, vars) => translate('en', key, vars);

const fromGithub = (slug: string): IForumBoard[] => [
  {
    id: '',
    slug,
    name: 'Name GitHub has',
    emoji: '🪄',
    description: 'Line GitHub has',
    isAnswerable: false,
  },
];

describe('the Tips & tricks board', () => {
  it.each(['tips-tricks', 'tips-and-tricks'])(
    '%s is named, described and guided in the reader’s language',
    (slug) => {
      const boards = fromGithub(slug);
      expect(boardName(slug, boards, german)).toBe('Tipps & Tricks');
      expect(boardName(slug, boards, english)).toBe('Tips & tricks');
      expect(boardDescription(slug, boards, english)).toBe(
        'Features that work but aren’t on screen',
      );
      expect(boardGuidance(slug, english)).toMatch(/One trick per topic/);
      expect(boardGlyph(slug)).toBe('tips');
    },
  );

  it('leaves a board it does not know to GitHub’s name and the plain icon', () => {
    const boards = fromGithub('tips');
    expect(boardName('tips', boards, german)).toBe('Name GitHub has');
    expect(boardDescription('tips', boards, german)).toBe('Line GitHub has');
    expect(boardGuidance('tips', german)).toBeUndefined();
    expect(boardGlyph('tips')).toBe('threads');
  });
});
