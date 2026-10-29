/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountState } from '../../../main/account/session';
import {
  CREATOR_MINIMUM_CENTS,
  CREATOR_SHARE_PERCENT,
  CREDIT_REFUND_DAYS,
  PLUS_MINIMUM_AGE,
  PLUS_TERMS_EDITION,
  PLUS_TERMS_VERSION,
} from '../../../common/plusTerms';
import { LOCALES, loadLocale, translate } from '../../../common/i18n';
import { PLUS_MOVE_CREDITS } from '../../../common/sceneStore';
import { CREATOR_PAYOUTS_OPEN } from '../../../common/creatorPayouts';
import AccountDialog from '../../../renderer/account/AccountDialog';
import { termsValues } from '../../../renderer/account/PlusTermsDocument';
import {
  TERMS_HIGHLIGHTS,
  termsLayout,
} from '../../../renderer/account/plusTermsContent';

/** The document this build shows, and both its forms. */
const SHOWN = termsLayout(CREATOR_PAYOUTS_OPEN);
const OPEN = termsLayout(true);
const CLOSED = termsLayout(false);
const keysOf = (layout: ReturnType<typeof termsLayout>) => [
  layout.intro,
  ...layout.sections.flatMap((section) => [section.title, ...section.lines]),
  ...layout.sentRows.flatMap((row) => [row.what, row.when, row.who]),
];

let mockAccountState: IAccountState = {
  status: 'signed-in',
  identity: { id: 'u-1', name: 'Ada', email: 'ada@example.com' },
};
let mockEntitlement: { state: 'none' | 'active' } = { state: 'none' };

// The credits card loads the account's store on its own (`plus/sceneStore.ts`)
// and has its own tests; what is held here is the panel around it.
jest.mock('../../../renderer/account/CreditsCard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

jest.mock('../../../common/accountConfig', () => ({
  ACCOUNT_CONFIG: {},
  isAccountConfigured: () => true,
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => mockAccountState,
  getAccountSnapshot: () => mockAccountState,
  subscribeAccount: () => () => undefined,
  signOutAccount: () => Promise.resolve(),
  signUpAccount: () => Promise.resolve(),
  signInAccount: () => Promise.resolve(),
  confirmAccountCode: () => Promise.resolve(),
  resendAccountCode: () => Promise.resolve(),
  forgotAccountPassword: () => Promise.resolve(),
  resetAccountPassword: () => Promise.resolve(),
  abandonAccountPending: () => Promise.resolve(),
}));

jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => mockEntitlement,
  getEntitlementSnapshot: () => mockEntitlement,
  subscribeEntitlement: () => () => undefined,
  refreshEntitlement: () => Promise.resolve(),
}));

describe('the Plus terms', () => {
  // Every language but English is a chunk of its own, loaded when it is
  // first chosen; these read every locale, so all are loaded first.
  beforeAll(() => Promise.all(LOCALES.map(({ code }) => loadLocale(code))));

  beforeEach(() => {
    jest.clearAllMocks();
    mockEntitlement = { state: 'none' };
    mockAccountState = {
      status: 'signed-in',
      identity: { id: 'u-1', name: 'Ada', email: 'ada@example.com' },
    };
  });

  /**
   * Plus is not sold any more (credits replaced it): the panel has no
   * upgrade and the terms are only ever read, never agreed to on the way to
   * a Plus checkout. Paying for credits agrees beside the packs instead.
   */
  it('offer no Plus upgrade, and open read-only with the published edition', async () => {
    render(<AccountDialog onClose={jest.fn()} />);
    expect(screen.queryByText(/^account\.plus\./)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'terms.link' }));

    expect(
      screen.getByRole('heading', { name: 'terms.title' }),
    ).toBeInTheDocument();
    // The published edition, from the constant, so raising one does not send
    // somebody hunting for a hard-coded number in a test.
    expect(screen.getByText(`v${PLUS_TERMS_EDITION}`)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`^terms\\.meta:${PLUS_TERMS_EDITION},`)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`v${PLUS_TERMS_VERSION}`),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'terms.back' })).toHaveClass(
      'subtle',
    );
  });

  it('go back to the person', async () => {
    render(<AccountDialog onClose={jest.fn()} initialPage="terms" />);
    await userEvent.click(screen.getByRole('button', { name: 'terms.back' }));
    // Back to the person: signed in, the panel's front page is their profile
    // and its heading is their name, where it used to be a dialog header
    // saying "Account".
    expect(screen.getByRole('heading', { name: 'Ada' })).toBeInTheDocument();
  });

  /**
   * What a Plus member is promised at the move to credits is a number the
   * server's move has to honour (Ivan, 2026-10-21: at least 5 for anyone who
   * paid), so it comes from the constant, in every language, and no
   * language still quotes a price or a renewal to subscribe to.
   */
  it('promise Plus members the credits of the move, and sell no Plus, in every language', () => {
    const values = termsValues();
    const p1 = LOCALES.map(({ code }) => [
      code,
      translate(code, 'terms.membership.p1', values),
    ]);
    expect(
      p1.filter(([, text]) => !text.includes(String(PLUS_MOVE_CREDITS))),
    ).toEqual([]);
    expect(
      LOCALES.filter(({ code }) =>
        /\{price\}|\$\d/.test(translate(code, 'terms.membership.p1', {})),
      ),
    ).toEqual([]);
    // The positive control: the number is there because the value filled it,
    // not because the text carries it by hand.
    expect(translate('en', 'terms.membership.p1', {})).toContain(
      '{moveCredits}',
    );
  });

  /** Every section, and every thing the app sends with when and who sees it. */
  it('list every section and everything the app sends, from the link on the account', async () => {
    const { container } = render(<AccountDialog onClose={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'terms.link' }));

    // Read-only: a way back, and no agreement.
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'terms.back' }),
    ).toBeInTheDocument();

    const sections = container.querySelectorAll('.plus-terms__section');
    expect(sections).toHaveLength(SHOWN.sections.length);
    const rows = container.querySelectorAll('.plus-terms__sent-row');
    expect(rows).toHaveLength(SHOWN.sentRows.length);
    SHOWN.sentRows.forEach((row, index) => {
      const item = within(rows[index] as HTMLElement);
      expect(item.getByText(new RegExp(`^${row.what}`))).toBeInTheDocument();
      expect(item.getByText(new RegExp(`^${row.when}`))).toBeInTheDocument();
      expect(item.getByText(new RegExp(`^${row.who}`))).toBeInTheDocument();
    });
    // The numbers are filled from the code that keeps them, not typed in.
    // The membership's fourteen-day refund went in revision 8 and stays gone;
    // what is refunded now is unspent credits (terms.credits.p7).
    expect(screen.queryByText(/^terms\.membership\.p3/)).toBeNull();
    expect(
      screen.getByText(
        new RegExp(`^terms\\.account\\.p1:.*\\b${PLUS_MINIMUM_AGE}\\b`),
      ),
    ).toBeInTheDocument();
  });

  /**
   * Unspent credits are refunded within a number of days the code keeps
   * (Ivan, 2026-10-21), and a creator is promised the share and the minimum
   * the server pays: each is filled from its constant in every language,
   * and the payouts section says the sign-up dialog's own sentences, so the
   * two can never promise different things.
   */
  it('quote the refund and the creator terms from the code that keeps them, in every language', () => {
    // Once creators can be paid, what payouts send has its row, and the
    // creator terms their section.
    expect(OPEN.sentRows.map((row) => row.what)).toContain(
      'terms.sent.payouts.what',
    );
    const lines = OPEN.sections.flatMap((section) => section.lines);
    expect(lines).toEqual(
      expect.arrayContaining([
        'terms.credits.p7',
        'creator.terms.share',
        'creator.terms.minimum',
      ]),
    );
    const wrong = LOCALES.flatMap(({ code }) => {
      const values = termsValues(code);
      const said = (
        key:
          'terms.credits.p7' | 'creator.terms.share' | 'creator.terms.minimum',
      ) => translate(code, key, values);
      return [
        said('terms.credits.p7').includes(String(CREDIT_REFUND_DAYS))
          ? []
          : [`${code} refund`],
        said('creator.terms.share').includes(String(CREATOR_SHARE_PERCENT))
          ? []
          : [`${code} share`],
        said('creator.terms.minimum').includes(
          String(CREATOR_MINIMUM_CENTS / 100),
        )
          ? []
          : [`${code} minimum`],
      ].flat();
    });
    expect(wrong).toEqual([]);
    // The positive control: the numbers are placeholders, not typed by hand.
    expect(translate('en', 'terms.credits.p7', {})).toContain('{refundDays}');
    expect(translate('en', 'creator.terms.share', {})).toContain('{share}');
  });

  /**
   * Nothing about how anybody uses FluidEQ is sent (Ivan, 2026-10-24; premium
   * 0068 and 0071): no row for listening time, time on screen or the engine,
   * and the one sentence that says so is true because of it. A sent row
   * that came back would contradict "no tracking or analytics" on the same
   * page.
   */
  it('list nothing sent about how FluidEQ is used, and say there is no tracking', () => {
    const rows = [...OPEN.sentRows, ...CLOSED.sentRows];
    expect(
      rows.filter((row) => /listening|scene-time|engine/.test(row.id)),
    ).toEqual([]);
    const told = rows.map((row) => translate('en', row.what));
    expect(
      told.filter((what) =>
        /on your screen|audio engine|how long music/i.test(what),
      ),
    ).toEqual([]);
    // The positive control: the sentence is there to be contradicted.
    expect(translate('en', 'terms.protect.p4')).toMatch(
      /no tracking or analytics/,
    );
  });

  /**
   * FluidEQ cannot pay creators yet (Ivan, 2026-10-24), so the terms this
   * build shows must not promise it: no payouts section, no row of what
   * payouts send, and every sentence that mentioned payouts in its twin
   * without them — each twin a real rewrite in every language, so opening
   * payouts later brings the full text back.
   */
  it('say nothing about paying creators while payouts are closed, and keep it ready for when they open', () => {
    expect(CREATOR_PAYOUTS_OPEN).toBe(false);
    const closed = keysOf(CLOSED);
    expect(closed.filter((key) => /payout|creator\./i.test(key))).toEqual([]);
    expect(
      CLOSED.sections.find((section) => section.id === 'payouts'),
    ).toBeUndefined();
    expect(CLOSED.sentRows.find((row) => row.id === 'payouts')).toBeUndefined();
    const values = termsValues();
    const mentions = closed.filter((key) =>
      /payout|be paid|getting paid|money/i.test(translate('en', key, values)),
    );
    expect(mentions).toEqual([]);
    // The positive control: the open form says all of it, and each twin
    // differs from the sentence it stands in for, in every language.
    const opened = keysOf(OPEN);
    expect(opened).toEqual(
      expect.arrayContaining([
        'terms.introPayouts',
        'terms.payouts.p1',
        'terms.keep.p8',
        'terms.sent.payouts.what',
      ]),
    );
    expect(
      opened.filter((key) =>
        /payout|be paid|getting paid|money/i.test(translate('en', key, values)),
      ).length,
    ).toBeGreaterThan(0);
    const twins = opened.filter((key) => key.endsWith('Payouts'));
    expect(twins).toHaveLength(5);
    const same = LOCALES.flatMap(({ code }) =>
      twins
        .filter(
          (twin) =>
            translate(code, twin) ===
            translate(code, twin.replace(/Payouts$/, '') as typeof twin),
        )
        .map((twin) => `${code} ${twin}`),
    );
    expect(same).toEqual([]);
  });

  /**
   * A placeholder the document does not fill reaches the reader as
   * "{computers}" in the middle of a promise. Every language, every line the
   * document says, filled from the same values the page uses.
   */
  it('fill every number they quote, in every language', () => {
    const said = [
      ...TERMS_HIGHLIGHTS.flatMap((item) => [item.title, item.body]),
      ...keysOf(OPEN),
      ...keysOf(CLOSED),
    ];
    const values = termsValues();
    const unfilled = LOCALES.flatMap(({ code }) =>
      said
        .map((key) => `${code} ${key}: ${translate(code, key, values)}`)
        .filter((line) => /\{\w+\}/.test(line)),
    );
    expect(unfilled).toEqual([]);
    // The positive control: an unknown placeholder is left as written, so the
    // check above can see one.
    expect(translate('en', 'terms.account.p4', {})).toMatch(/\{computers\}/);
  });

  /**
   * The terms tell a reader which switch lets an AI tool look at the Studio,
   * by the name the Studio's card wears. A card renamed in one place and not
   * the other sends the reader looking for a switch that is not there.
   */
  it('name the Studio’s AI link by its card’s own title, in every language', () => {
    expect(SHOWN.sections.flatMap((section) => section.lines)).toContain(
      'terms.elsewhere.p9',
    );
    const namesTheCard = (
      code: (typeof LOCALES)[number]['code'],
      key: 'terms.elsewhere.p9' | 'terms.elsewhere.p3',
    ) => translate(code, key).includes(translate(code, 'studio.agent.title'));
    const unnamed = LOCALES.filter(
      ({ code }) => !namesTheCard(code, 'terms.elsewhere.p9'),
    ).map(({ code }) => code);
    expect(unnamed).toEqual([]);
    // The positive control: a line that does not name the card is seen as
    // not naming it.
    expect(namesTheCard('en', 'terms.elsewhere.p3')).toBe(false);
  });

  /**
   * The User guide's video, the first steps, is the app's one connection to
   * fluideq.com from Help (the Plus tour left with Plus's sale). The terms
   * name it by the title its card wears and the button that opens it in a
   * browser, so a reader can find it; a card renamed in one place and not
   * the other points them at something that is not there.
   */
  it('name the Help video and its button as the guide shows them, in every language', () => {
    expect(SHOWN.sections.flatMap((section) => section.lines)).toContain(
      'terms.elsewhere.p10',
    );
    const namesTheVideo = (
      code: (typeof LOCALES)[number]['code'],
      key: 'terms.elsewhere.p10' | 'terms.elsewhere.p2',
    ) =>
      translate(code, key).includes(translate(code, 'help.start.videoTitle')) &&
      translate(code, key).includes(translate(code, 'help.video.open'));
    const unnamed = LOCALES.filter(
      ({ code }) => !namesTheVideo(code, 'terms.elsewhere.p10'),
    ).map(({ code }) => code);
    expect(unnamed).toEqual([]);
    // The positive control: a line about another download is not read as
    // naming the video.
    expect(namesTheVideo('en', 'terms.elsewhere.p2')).toBe(false);
  });

  /**
   * A scene can carry 3D models, which an export and a publish send and the
   * Studio keeps. Every line that lists what a scene is made of has to name
   * them, in every language: a reader who is told "code, settings and
   * pictures" has not been told that a model of theirs leaves the computer.
   */
  it('name the 3D models a scene can carry, wherever a scene is listed', () => {
    // Per language, what that language calls them, as the terms say it.
    const models: Record<string, string> = {
      en: '3D models',
      es: 'modelos 3D',
      pt: 'modelos 3D',
      fr: 'modèles 3D',
      de: '3D-Modelle',
      it: 'modelli 3D',
      ru: '3D-модел',
      ko: '3D 모델',
      'zh-Hant': '3D 模型',
      zh: '3D 模型',
      ja: '3D モデル',
      hi: '3D मॉडल',
    };
    const listsAScene = [
      'terms.sent.sceneExport.what',
      'terms.never.p4',
      'terms.scenes.p6',
    ] as const;
    const silent = LOCALES.flatMap(({ code }) =>
      listsAScene
        .filter((key) => !translate(code, key).includes(models[code]))
        .map((key) => `${code} ${key}`),
    );
    expect(silent).toEqual([]);
    // The positive control: a line that lists nothing of a scene's contents
    // does not name them, so the check above can see a line that stops doing
    // so.
    expect(translate('en', 'terms.never.p2')).not.toContain(models.en);
  });

  /**
   * Buy Me a Coffee, which takes the payment, requires every account holder
   * to be 18. Terms that let a younger person join promise a membership the
   * payment side will not sell.
   */
  it('never admit anyone younger than the payment side allows', () => {
    expect(PLUS_MINIMUM_AGE).toBeGreaterThanOrEqual(18);
  });

  it('ask for an account before showing the terms page', () => {
    mockAccountState = { status: 'signed-out' };
    render(<AccountDialog onClose={jest.fn()} />);
    expect(
      screen.getByRole('heading', { name: 'account.title' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
