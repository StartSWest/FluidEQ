import {
  parsePlusTrialOffer,
  parsePlusTrialSettings,
} from '../../../common/plusTrial';

const offer = {
  enabled: true,
  days: 15,
  state: 'eligible',
  startedAt: null,
  endsAt: null,
  termsVersion: 8,
  trialTermsVersion: 1,
};

describe('trial responses from the server', () => {
  it('keeps the configured anonymous offer without inventing a grant', () => {
    expect(parsePlusTrialOffer({ ...offer, state: 'sign-in' })).toEqual({
      enabled: true,
      days: 15,
      state: 'sign-in',
      termsVersion: 8,
      trialTermsVersion: 1,
    });
  });

  it('reads the exact start and end of a grant even after new offers stop', () => {
    expect(
      parsePlusTrialOffer({
        ...offer,
        enabled: false,
        state: 'active',
        startedAt: '2026-09-19T12:00:00.000Z',
        endsAt: '2026-10-19T12:00:00.000Z',
      }),
    ).toEqual({
      enabled: false,
      days: 15,
      state: 'active',
      startedAt: 1789819200000,
      endsAt: 1792411200000,
      termsVersion: 8,
      trialTermsVersion: 1,
    });
  });

  it.each([
    null,
    [],
    { ...offer, enabled: 'true' },
    { ...offer, days: 31 },
    { ...offer, state: 'unknown' },
    { ...offer, termsVersion: 0 },
    { ...offer, trialTermsVersion: 1.5 },
    { ...offer, state: 'active' },
    { ...offer, state: 'ended', startedAt: '2026-09-19T12:00:00Z' },
    { ...offer, startedAt: '1', endsAt: '2' },
    {
      ...offer,
      startedAt: '2026-10-19T12:00:00Z',
      endsAt: '2026-09-19T12:00:00Z',
    },
    { ...offer, enabled: false },
  ])('fails closed on an invalid offer: %j', (value) => {
    expect(parsePlusTrialOffer(value)).toBeUndefined();
  });

  it('reads the original eligibility date after the offer is disabled', () => {
    expect(
      parsePlusTrialSettings({
        enabled: false,
        days: 15,
        eligibleSince: '2026-09-19T12:00:00Z',
      }),
    ).toEqual({ enabled: false, days: 15, eligibleSince: 1789819200000 });
    expect(
      parsePlusTrialSettings({ enabled: false, days: 15, eligibleSince: null }),
    ).toEqual({ enabled: false, days: 15 });
  });

  it.each([
    { enabled: true, days: 15, eligibleSince: null },
    { enabled: true, days: 15, eligibleSince: 'not a date' },
    { enabled: false, days: 0, eligibleSince: null },
    { enabled: 1, days: 15, eligibleSince: null },
  ])('refuses malformed administrator settings: %j', (value) => {
    expect(parsePlusTrialSettings(value)).toBeUndefined();
  });
});
