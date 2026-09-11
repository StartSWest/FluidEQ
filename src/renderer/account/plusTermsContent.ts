import type { TranslationKey } from 'common/i18n/en';
import type { TCommunityGlyph } from '../community/Glyph';

/**
 * The shape of the Plus terms: which sections, in which order, with which
 * picture, and which sentences each holds. The words are in the `terms.*`
 * dictionaries; this is only the order they are read in.
 *
 * What the app sends is its own kind of section — a row per thing sent, each
 * with when and who can see it — because that is the part a person comes back
 * to, and a table answers "does it send X" faster than any paragraph.
 */

export interface ITermsHighlight {
  glyph: TCommunityGlyph;
  title: TranslationKey;
  body: TranslationKey;
}

/** The four facts that matter most, on top, before a word of the rest. */
export const TERMS_HIGHLIGHTS: readonly ITermsHighlight[] = [
  {
    glyph: 'card',
    title: 'terms.short.price.title',
    body: 'terms.short.price.body',
  },
  {
    glyph: 'monitor',
    title: 'terms.short.free.title',
    body: 'terms.short.free.body',
  },
  {
    glyph: 'shield',
    title: 'terms.short.choice.title',
    body: 'terms.short.choice.body',
  },
  {
    glyph: 'headphones',
    title: 'terms.short.music.title',
    body: 'terms.short.music.body',
  },
];

export interface ITermsSentRow {
  id: string;
  glyph: TCommunityGlyph;
  what: TranslationKey;
  when: TranslationKey;
  who: TranslationKey;
}

/** Everything the app sends, in the order a person meets it. */
export const TERMS_SENT_ROWS: readonly ITermsSentRow[] = [
  {
    id: 'sign-in',
    glyph: 'person',
    what: 'terms.sent.signIn.what',
    when: 'terms.sent.signIn.when',
    who: 'terms.sent.signIn.who',
  },
  {
    id: 'membership',
    glyph: 'refresh',
    what: 'terms.sent.membership.what',
    when: 'terms.sent.membership.when',
    who: 'terms.sent.membership.who',
  },
  {
    id: 'payment',
    glyph: 'card',
    what: 'terms.sent.payment.what',
    when: 'terms.sent.payment.when',
    who: 'terms.sent.payment.who',
  },
  {
    id: 'looks',
    glyph: 'looks',
    what: 'terms.sent.looks.what',
    when: 'terms.sent.looks.when',
    who: 'terms.sent.looks.who',
  },
  {
    id: 'catalogue',
    glyph: 'lock',
    what: 'terms.sent.catalogue.what',
    when: 'terms.sent.catalogue.when',
    who: 'terms.sent.catalogue.who',
  },
  {
    id: 'profile',
    glyph: 'mention',
    what: 'terms.sent.profile.what',
    when: 'terms.sent.profile.when',
    who: 'terms.sent.profile.who',
  },
  {
    id: 'board',
    glyph: 'board',
    what: 'terms.sent.board.what',
    when: 'terms.sent.board.when',
    who: 'terms.sent.board.who',
  },
  {
    id: 'scene-export',
    glyph: 'studio',
    what: 'terms.sent.sceneExport.what',
    when: 'terms.sent.sceneExport.when',
    who: 'terms.sent.sceneExport.who',
  },
  {
    id: 'scene-like',
    glyph: 'heart',
    what: 'terms.sent.sceneLike.what',
    when: 'terms.sent.sceneLike.when',
    who: 'terms.sent.sceneLike.who',
  },
  {
    id: 'scene-publish',
    glyph: 'upload',
    what: 'terms.sent.scenePublish.what',
    when: 'terms.sent.scenePublish.when',
    who: 'terms.sent.scenePublish.who',
  },
  {
    id: 'gallery',
    glyph: 'plus',
    what: 'terms.sent.gallery.what',
    when: 'terms.sent.gallery.when',
    who: 'terms.sent.gallery.who',
  },
  {
    // Not Plus, and not this server: the Forum tab talks to GitHub directly.
    // Listed all the same, because the table promises everything the app
    // sends and the forum is part of the app.
    id: 'forum',
    glyph: 'general',
    what: 'terms.sent.forum.what',
    when: 'terms.sent.forum.when',
    who: 'terms.sent.forum.who',
  },
];

export interface ITermsSection {
  id: string;
  glyph: TCommunityGlyph;
  title: TranslationKey;
  /**
   * Paragraphs, or — for a section that is a list of separate facts — the
   * points of a list. A section that is the table of what is sent has none.
   */
  body: 'paragraphs' | 'points' | 'sent';
  lines: readonly TranslationKey[];
}

export const TERMS_SECTIONS: readonly ITermsSection[] = [
  {
    id: 'membership',
    glyph: 'card',
    title: 'terms.membership.title',
    body: 'paragraphs',
    lines: [
      'terms.membership.p1',
      'terms.membership.p2',
      'terms.membership.p3',
      'terms.membership.p4',
    ],
  },
  {
    id: 'account',
    glyph: 'person',
    title: 'terms.account.title',
    body: 'paragraphs',
    lines: [
      'terms.account.p1',
      'terms.account.p2',
      'terms.account.p3',
      'terms.account.p4',
    ],
  },
  {
    id: 'sent',
    glyph: 'upload',
    title: 'terms.sent.title',
    body: 'sent',
    lines: ['terms.sent.intro'],
  },
  {
    id: 'never',
    glyph: 'monitor',
    title: 'terms.never.title',
    body: 'points',
    lines: [
      'terms.never.p1',
      'terms.never.p2',
      'terms.never.p3',
      'terms.never.p4',
    ],
  },
  {
    id: 'protect',
    glyph: 'lock',
    title: 'terms.protect.title',
    body: 'points',
    lines: [
      'terms.protect.p1',
      'terms.protect.p2',
      'terms.protect.p3',
      'terms.protect.p4',
      'terms.protect.p5',
      'terms.protect.p6',
    ],
  },
  {
    id: 'fair',
    glyph: 'shield',
    title: 'terms.fair.title',
    body: 'paragraphs',
    lines: ['terms.fair.p1', 'terms.fair.p2', 'terms.fair.p3'],
  },
  {
    // What may be published, now that a scene is the only thing a member
    // puts in front of the others: the forum is GitHub's, under its rules.
    id: 'rules',
    glyph: 'report',
    title: 'terms.rules.title',
    body: 'paragraphs',
    lines: ['terms.rules.p1', 'terms.rules.p2'],
  },
  {
    id: 'keep',
    glyph: 'delete',
    title: 'terms.keep.title',
    body: 'points',
    lines: [
      'terms.keep.p1',
      'terms.keep.p2',
      'terms.keep.p3',
      'terms.keep.p4',
      'terms.keep.p5',
    ],
  },
  {
    id: 'looks',
    glyph: 'looks',
    title: 'terms.looks.title',
    body: 'paragraphs',
    lines: ['terms.looks.p1', 'terms.looks.p2'],
  },
  {
    // The member's own work, and the one permission sharing it gives. Beside
    // the Plus looks, because the two are the same question asked from each
    // side: whose is it, and what may the other side do with it.
    id: 'scenes',
    glyph: 'studio',
    title: 'terms.scenes.title',
    body: 'points',
    lines: [
      'terms.scenes.p1',
      'terms.scenes.p2',
      'terms.scenes.p3',
      'terms.scenes.p4',
      'terms.scenes.p5',
      'terms.scenes.p6',
      'terms.scenes.p7',
      'terms.scenes.p8',
      'terms.scenes.p9',
      'terms.scenes.p10',
    ],
  },
  {
    id: 'changes',
    glyph: 'refresh',
    title: 'terms.changes.title',
    body: 'paragraphs',
    lines: ['terms.changes.p1', 'terms.changes.p2'],
  },
  {
    id: 'contact',
    glyph: 'mail',
    title: 'terms.contact.title',
    body: 'paragraphs',
    lines: ['terms.contact.p1'],
  },
];
