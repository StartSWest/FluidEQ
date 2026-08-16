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

/** The Remote Media tab. */
import { Dictionary } from '../en';

const video: Partial<Dictionary> = {
  'video.sites': '動画サイト',
  'video.back': '戻る',
  'video.forward': '進む',
  'video.reload': '再読み込み',
  'video.stop': '中止',
  'video.searchAria': '現在のサイト内を検索',
  'video.searchOn': '{site} で検索',
  'video.searchGo': '検索',
  'video.searchClear': '検索内容を消去',
  'video.searchRecent': '最近の検索',
  'video.searchForget': '「{term}」を削除',
  'video.searchForgetAll': '最近の検索を消去',
  'video.adBlock': '広告をブロック',
  'video.adBlockHint': 'YouTube の動画広告をスキップし、広告枠を隠します。',
  'video.signOut': 'すべてのサイトからログアウト',
  'video.signOutBusy': 'ログアウト中…',
  'video.signOutHint':
    'プレーヤーが保持している Cookie、ログイン情報、キャッシュされたページをすべて消去します。',
  'video.signOutDone': 'ログアウトしました',
  'video.signOutFailed': 'ログアウトできませんでした',
  'video.blockedTitle': 'このリンクはプレーヤーの外に出ます',
  'video.openInBrowser': 'ブラウザで開く',
  'video.downloadChoosing': 'ファイルの保存先を選択',
  'video.downloadSaving': '{file} を保存中',
  'video.downloadComplete': 'コンピューターに保存しました',
  'video.downloadFailed': 'ダウンロードを保存できませんでした',
  'video.downloadProgress': 'ダウンロードの進行状況',
  'video.downloadCopyPath': 'パスをコピー',
  'video.downloadCopied': 'パスをコピーしました',
  'video.downloadShowFolder': 'フォルダーに表示',
  'video.resize': 'ドラッグしてプレーヤーの大きさを変更',
};

export default video;
