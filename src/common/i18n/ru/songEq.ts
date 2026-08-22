/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/** Smart EQ song memory — the tick, its progress, and the notice. */
export default {
  'songEq.save': 'Сохранять для этой песни',
  'songEq.saveAria':
    'Запоминать коррекцию умного EQ для того, что сейчас играет',
  'songEq.waiting': 'Ничего не играет',
  'songEq.listening': 'Осталось {remaining}',
  'songEq.willSave': 'Будет сохранено — {title}',
  'songEq.noticeTitle': 'Для этой песни используется сохранённый EQ',
  // Phrased as a label rather than a count, so the numeral never has to agree
  // with the noun: `{plays} прослушиваний` is right for 0 and 5+ and wrong for
  // 2, 3 and 4 — which is the early life of every remembered song.
  'songEq.noticeBody': '{title} — изучено, прослушиваний: {plays}',
  'songEq.noticeBodyOnce': '{title} — изучено за одно прослушивание',
  'songEq.undo': 'Отменить',
  'songEq.forget': 'Забыть эту песню',
  'songEq.badgeAria': 'Умный EQ изучает эту песню',
};
