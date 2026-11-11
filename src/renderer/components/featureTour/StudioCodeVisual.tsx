/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';

/**
 * The Studio's Code tab on a scene with a 3D world: every file the scene is
 * made of, each folded to its name and its count of lines, and one of the
 * world's materials open with the line the AI just changed marked as Show
 * changes marks it. The words around the code are the tab's own labels; the
 * code is code, and stays as written.
 *
 * One loop of CSS (`_tour-release25.scss`).
 */

const FILES: readonly { name: string; lines: number; open?: boolean }[] = [
  { name: 'scene.frag', lines: 214 },
  { name: 'pack.json', lines: 48 },
  { name: 'world.json', lines: 131 },
  { name: 'materials/water.frag', lines: 8, open: true },
  { name: 'animations/koi.json', lines: 26 },
  { name: 'studio-notes.json', lines: 12 },
];

/** The open material, a token at a time: keyword, name, number or plain. */
type TToken = [kind: 'k' | 'n' | 'd' | 'p', text: string];

const CODE: readonly { tokens: readonly TToken[]; changed?: boolean }[] = [
  {
    tokens: [
      ['k', 'uniform float '],
      ['n', 'uBass'],
      ['p', ';'],
    ],
  },
  {
    tokens: [
      ['k', 'void '],
      ['n', 'main'],
      ['p', '() {'],
    ],
  },
  {
    tokens: [
      ['k', '  vec2 '],
      ['n', 'uv'],
      ['p', ' = vUv;'],
    ],
  },
  {
    tokens: [
      ['k', '  float '],
      ['n', 'ripple'],
      ['p', ' = sin(uv.x * '],
      ['d', '40.0'],
      ['p', ' + uTime * '],
      ['d', '2.0'],
      ['p', ');'],
    ],
  },
  {
    tokens: [
      ['k', '  vec3 '],
      ['n', 'deep'],
      ['p', ' = mix(uShallow, uDeep, uv.y);'],
    ],
  },
  {
    tokens: [
      ['p', '  deep += ripple * uBass * '],
      ['d', '0.08'],
      ['p', ';'],
    ],
    changed: true,
  },
  {
    tokens: [
      ['p', '  gl_FragColor = vec4(deep, '],
      ['d', '1.0'],
      ['p', ');'],
    ],
  },
  { tokens: [['p', '}']] },
];

export default function StudioCodeVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="code-visual"
      role="img"
      aria-label={t('tour.code.imageAlt')}
    >
      <div className="code-visual__head">
        <strong>{t('studio.code.title')}</strong>
        <span className="code-visual__watching">
          <i />
          {t('studio.code.watching')}
        </span>
        <span className="code-visual__fold">{t('studio.code.expandAll')}</span>
        <span className="code-visual__fold">
          {t('studio.code.collapseAll')}
        </span>
      </div>
      <div className="code-visual__files">
        {FILES.map((file) => (
          <div
            key={file.name}
            className={`code-visual__file${file.open ? ' is-open' : ''}`}
          >
            <span className="code-visual__file-head">
              <i className="code-visual__chevron" />
              <span className="code-visual__file-name">{file.name}</span>
              <small>{t('studio.code.lines', { count: file.lines })}</small>
            </span>
            {file.open && (
              <span className="code-visual__code">
                {CODE.map((line, index) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key -- fixed lines of a fixed file, never reordered
                    key={index}
                    className={`code-visual__line${
                      line.changed ? ' is-changed' : ''
                    }`}
                  >
                    <span className="code-visual__number">{index + 1}</span>
                    <span className="code-visual__text">
                      {line.tokens.map(([kind, text], tokenIndex) => (
                        <span
                          // eslint-disable-next-line react/no-array-index-key -- fixed tokens of a fixed line
                          key={tokenIndex}
                          className={`code-visual__${kind}`}
                        >
                          {text}
                        </span>
                      ))}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
