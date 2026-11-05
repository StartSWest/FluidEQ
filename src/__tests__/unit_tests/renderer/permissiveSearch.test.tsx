/* FluidEQ — GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { translate, type Translate } from '../../../common/i18n';
import { dspPresetCatalog } from '../../../renderer/dsp/dspPresetCatalog';
import Dropdown from '../../../renderer/widgets/Dropdown';
import RichPick from '../../../renderer/widgets/RichPick';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: Parameters<Translate>[0]) => translate('en', key),
  }),
}));

const english: Translate = (key, vars) => translate('en', key, vars);

// Main EQ and DSP use the same catalogue and rich picker. Exercise their
// real translated names rather than a fixture that already says "kpop".
it.each(['kpop', 'K POP', 'K‑pop'])(
  'finds and selects the real K-pop preset with %s',
  async (query) => {
    const onPick = jest.fn();
    const entries = dspPresetCatalog(english).map((preset) => ({
      ...preset,
      hint: '',
      icon: <span />,
    }));
    const preset = entries.find((entry) => entry.name === 'K-pop');
    expect(preset).toBeDefined();
    render(
      <RichPick
        entries={entries}
        groupLabel={() => ''}
        activeId=""
        onPick={onPick}
        placeholder="Choose preset"
        triggerAriaLabel="Preset"
        triggerTitle="Preset"
        placeholderIcon={<span />}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Preset' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search…' }), {
      target: { value: query },
    });
    const found = screen.getByRole('menuitemradio', { name: 'K-pop' });
    expect(
      screen.queryByRole('menuitemradio', { name: 'Classical' }),
    ).toBeNull();
    await userEvent.click(found);
    expect(onPick).toHaveBeenCalledWith(preset?.id);
  },
);

it.each([
  ['v4pro razer', 'Razer Kraken V4 Pro'],
  ['deja cafe', 'Déjà Café'],
  ['中文', '中文音樂'],
])(
  'finds %s in a searchable dropdown without unrelated rows',
  async (query, name) => {
    const onPick = jest.fn();
    const options = [name, 'Unrelated model'].map((label) => ({
      value: label,
      label,
      display: <span>{label}</span>,
    }));
    render(
      <Dropdown
        name="Model"
        value=""
        options={options}
        isDisabled={false}
        isFilterable
        handleChange={onPick}
      />,
    );
    await userEvent.click(screen.getByLabelText('Model'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter options' }), {
      target: { value: query },
    });
    const found = await screen.findByRole('menuitem', { name });
    expect(
      screen.queryByRole('menuitem', { name: 'Unrelated model' }),
    ).toBeNull();
    await userEvent.click(found);
    expect(onPick).toHaveBeenCalledWith(name);
  },
);
