/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import GithubHtml from '../../../renderer/forum/GithubHtml';
import { applyFormat } from '../../../renderer/forum/MarkdownEditor';
import { relativeTime } from '../../../renderer/forum/forumTime';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

/**
 * A post body is a stranger's markup arriving in the app's own window. These
 * pin what survives the rebuild and, as the positive control beside every
 * refusal, what still comes through looking like the post.
 */
describe('a post body, rebuilt from GitHub’s rendering', () => {
  it('keeps the writing and drops anything that could run or reach out', () => {
    const { container } = render(
      <GithubHtml
        html={
          '<p>Hello <strong>there</strong></p>' +
          '<script>window.hacked = true</script>' +
          '<iframe src="https://evil.test"></iframe>' +
          '<svg><path d="M0 0"/></svg>' +
          '<p onclick="steal()" style="color:red">styled</p>'
        }
      />,
    );
    expect(screen.getByText('there').tagName).toBe('STRONG');
    expect(container.querySelector('script, iframe, svg')).toBeNull();
    const styled = screen.getByText('styled');
    expect(styled.getAttribute('onclick')).toBeNull();
    expect(styled.getAttribute('style')).toBeNull();
  });

  it('sends links to the browser and refuses every other kind', () => {
    render(
      <GithubHtml
        html={
          '<a href="https://github.com/StartSWest">@StartSWest</a>' +
          '<a href="javascript:alert(1)">bad</a>' +
          '<a href="#heading"></a>'
        }
      />,
    );
    const link = screen.getByText('@StartSWest');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    expect(screen.getByText('bad').tagName).not.toBe('A');
  });

  it('shows pictures from GitHub and only their words from anywhere else', () => {
    const { container } = render(
      <GithubHtml
        html={
          '<img src="https://camo.githubusercontent.com/abc" alt="curve">' +
          '<img src="https://tracker.test/pixel.png" alt="elsewhere">'
        }
      />,
    );
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute(
      'src',
      'https://camo.githubusercontent.com/abc',
    );
    expect(screen.getByText('elsewhere').tagName).toBe('SPAN');
  });

  it('turns a picture that will not load into a link to it', () => {
    render(
      <GithubHtml html='<img src="https://github.com/x.png" alt="shot">' />,
    );
    fireEvent.error(screen.getByAltText('shot'));
    expect(screen.getByText('shot').tagName).toBe('A');
  });

  it('moves headings down, keeps task boxes shut and code colours', () => {
    const { container } = render(
      <GithubHtml
        html={
          '<h1>Title</h1>' +
          '<ul class="contains-task-list"><li><input type="checkbox" checked> done</li></ul>' +
          '<pre><span class="pl-k">const</span> <span class="evil">x</span></pre>' +
          '<div class="markdown-alert markdown-alert-warning"><p class="markdown-alert-title">Warning</p></div>'
        }
      />,
    );
    expect(screen.getByText('Title').tagName).toBe('H3');
    const box = container.querySelector('input');
    expect(box).toBeDisabled();
    expect(box).toBeChecked();
    expect(container.querySelector('.pl-k')?.textContent).toBe('const');
    expect(container.querySelector('.evil')).toBeNull();
    expect(
      container.querySelector('.forum-prose__alert--warning'),
    ).not.toBeNull();
  });

  it('builds tables without the line breaks between their rows', () => {
    const errors = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    render(
      <GithubHtml
        html={
          '<table>\n<thead>\n<tr>\n<th align="right">A</th>\n</tr>\n</thead>\n</table>'
        }
      />,
    );
    expect(screen.getByText('A')).toHaveStyle({ textAlign: 'right' });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('the formatting buttons', () => {
  const at = (value: string, start: number, end = start) => ({
    value,
    start,
    end,
  });

  it('wraps a selection and keeps it selected inside the marks', () => {
    expect(applyFormat(at('make this bold', 5, 9), 'bold')).toEqual({
      value: 'make **this** bold',
      start: 7,
      end: 11,
    });
  });

  it('fences code that runs over lines, and ticks code that does not', () => {
    expect(applyFormat(at('a\nb', 0, 3), 'code').value).toBe('```\na\nb\n```');
    expect(applyFormat(at('x', 0, 1), 'code').value).toBe('`x`');
  });

  it('selects the address of a new link, since that is left to type', () => {
    const edit = applyFormat(at('see docs', 4, 8), 'link');
    expect(edit.value).toBe('see [docs](https://)');
    expect(edit.value.slice(edit.start, edit.end)).toBe('https://');
  });

  it('quotes every line a selection touches, and just moves the caret without one', () => {
    expect(applyFormat(at('one\ntwo', 1, 5), 'quote').value).toBe(
      '> one\n> two',
    );
    const caret = applyFormat(at('item', 2), 'list');
    expect(caret).toEqual({ value: '- item', start: 4, end: 4 });
  });
});

describe('when something was posted', () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('says it in the unit a forum would', () => {
    expect(relativeTime(ago(20_000), 'en', now)).toBe('now');
    expect(relativeTime(ago(5 * 60_000), 'en', now)).toBe('5 minutes ago');
    expect(relativeTime(ago(3 * 3_600_000), 'en', now)).toBe('3 hours ago');
    expect(relativeTime(ago(26 * 3_600_000), 'en', now)).toBe('yesterday');
    expect(relativeTime(ago(21 * 86_400_000), 'en', now)).toBe('3 weeks ago');
    expect(relativeTime('not a date', 'en', now)).toBe('');
  });
});
