import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GraphSceneRemove from '../../../renderer/graph/GraphSceneRemove';
import List from '../../../renderer/widgets/List';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/utils/memberScenes', () => ({
  refreshMemberScenes: jest.fn(),
}));
jest.mock('../../../renderer/utils/scenePacks', () => ({
  refreshScenePacks: jest.fn(),
}));

const removeOfficial = jest.fn();
const removeMember = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  removeOfficial.mockResolvedValue(true);
  removeMember.mockResolvedValue(true);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        removeScenePack: removeOfficial,
        removeMemberScene: removeMember,
      },
    },
  });
});

it.each(['skyline-auto', 'bars', 'custom:saved'])(
  'does not offer removal for the standard or custom style %s',
  (lookId) => {
    render(<GraphSceneRemove lookId={lookId} name="Scene" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  },
);

it.each([
  'premium:aurora',
  'member:11111111-1111-4111-8111-111111111111:neon-city',
])(
  'requires inline confirmation without selecting the row: %s',
  async (lookId) => {
    const user = userEvent.setup();
    const choose = jest.fn();
    render(
      <List
        name="looks"
        value="skyline-auto"
        isDisabled={false}
        handleChange={choose}
        options={[
          {
            value: lookId,
            label: 'Scene',
            display: 'Scene',
            action: <GraphSceneRemove lookId={lookId} name="Scene" />,
          },
        ]}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'plus.card.remove Scene' }),
    );
    expect(screen.getByText('plus.remove.confirm')).toBeInTheDocument();
    expect(removeOfficial).not.toHaveBeenCalled();
    expect(removeMember).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'plus.report.cancel' }),
    );
    expect(screen.queryByText('plus.remove.confirm')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'plus.card.remove Scene' }),
    );
    screen.getByRole('button', { name: 'plus.card.remove' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.queryByText('plus.remove.confirm')).not.toBeInTheDocument(),
    );
    expect(choose).not.toHaveBeenCalled();
    expect(removeOfficial.mock.calls.concat(removeMember.mock.calls)).toEqual([
      [lookId.startsWith('premium:') ? 'aurora' : lookId],
    ]);
  },
);

it('keeps the confirmation open and reports a failed removal', async () => {
  removeOfficial.mockResolvedValue(false);
  const user = userEvent.setup();
  render(<GraphSceneRemove lookId="premium:aurora" name="Aurora" />);
  await user.click(
    screen.getByRole('button', { name: 'plus.card.remove Aurora' }),
  );
  await user.click(screen.getByRole('button', { name: 'plus.card.remove' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'plus.remove.failed',
  );
  expect(
    screen.getByRole('button', { name: 'plus.report.cancel' }),
  ).toBeEnabled();
});
