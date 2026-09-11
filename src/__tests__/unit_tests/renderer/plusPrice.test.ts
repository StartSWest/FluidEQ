/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAccountConfig } from '../../../common/accountConfig';
import type { Translate } from '../../../common/i18n';
import plusPriceText from '../../../renderer/account/plusPrice';

// Shows which sentence was chosen and what went into it.
const t: Translate = (key, vars) =>
  vars ? `${key}(${Object.values(vars).join('|')})` : key;

const config = (
  plusPrice: string,
  plusYearlyPrice: string,
): IAccountConfig => ({
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'sb_publishable_example',
  apiUrl: 'https://example.supabase.co/functions/v1',
  plusPrice,
  plusYearlyPrice,
});

describe('the Plus price, as the card and the terms say it', () => {
  it('quotes the month alone when there is no yearly plan', () => {
    expect(plusPriceText(t, config('$5', ''))).toBe(
      'account.plus.perMonth($5)',
    );
  });

  it('quotes both, each with its own period, when there is one', () => {
    expect(plusPriceText(t, config('$5', '$40'))).toBe(
      'account.plus.priceChoice(account.plus.perMonth($5)|account.plus.perYear($40))',
    );
  });
});
