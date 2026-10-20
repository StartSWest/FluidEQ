/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  IssueFoot,
  IssueLabels,
  IssueState,
} from '../../../renderer/forum/IssueParts';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

/**
 * What only an issue shows in the Forum: where it stands, its labels, and the
 * way to GitHub where it is answered.
 */

describe('an issue in the Forum', () => {
  it('says open in the open colour', () => {
    render(<IssueState issue={{ closed: false, labels: [] }} />);
    const chip = screen.getByText('forum.issue.open');
    expect(chip).toHaveClass('forum__chip--issue');
    expect(chip).not.toHaveClass('is-closed');
  });

  it('says closed in the closed colour', () => {
    render(<IssueState issue={{ closed: true, labels: [] }} />);
    expect(screen.getByText('forum.issue.closed')).toHaveClass(
      'forum__chip--issue',
      'is-closed',
    );
    expect(screen.queryByText('forum.issue.open')).toBeNull();
  });

  it('shows every label, quietly, in the owner’s words', () => {
    render(
      <IssueLabels issue={{ closed: false, labels: ['bug', 'engine'] }} />,
    );
    expect(screen.getByText('bug')).toHaveClass('forum__chip--label');
    expect(screen.getByText('engine')).toHaveClass('forum__chip--label');
  });

  it('ends the thread with the way to answer it on GitHub, as the loud action', () => {
    const url = 'https://github.com/StartSWest/FluidEQ/issues/30';
    render(<IssueFoot url={url} />);
    expect(screen.getByText('forum.issue.commentHint')).toBeInTheDocument();
    const link = screen.getByRole('link', {
      name: 'forum.issue.commentOnGithub',
    });
    expect(link).toHaveAttribute('href', url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveClass('button', 'small');
    expect(link).not.toHaveClass('subtle');
  });
});
