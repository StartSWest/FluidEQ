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

/** The Look Designer, the support panel, the creature and its game. */
import { Dictionary } from '../en';

const look: Partial<Dictionary> = {
  'look.edit': '表示を編集',
  'look.create': '表示を作成',
  'look.new': '新しい表示',
  'look.close': '表示エディターを閉じる',
  'look.closeHint': '保存せずに閉じる（Esc）',
  'look.pickForm': '上の選択欄から形を選ぶか、スペースキーを押します。',
  'look.colourBy': '色の基準',
  'look.palette.cycle': '配色',
  'look.palette.flat': '単色',
  'look.palette.flatHint': '図形全体を1色で表示',
  'look.palette.frequency': '周波数',
  'look.palette.frequencyHint':
    '軸に沿って色が変わり、各バーの周波数位置を示します。',
  'look.palette.level': 'レベル',
  'look.palette.levelHint': '軸の上方向に色が変わり、各バーの音量を示します。',
  'look.palette.heat': 'ヒート',
  'look.palette.heatHint': '音量に応じて色が変化します。寒色から赤へ。',
  'look.colours': '色',
  'look.colourValue': '色 {number}：{colour}',
  'look.removeColour': '色 {number} を削除',
  'look.custom': 'カスタム',
  'look.customColour': '別の色を選択',
  'look.reset': 'リセット',
  'look.addColour': '色を追加',
  'look.addColourHint': 'グラデーションの末尾に色を追加',
  'look.pieces': '分割数',
  'look.gap': '間隔',
  'look.continuous': 'この形は連続した図形として描画されます',
  'look.attack': 'アタック',
  'look.release': 'リリース',
  'look.releaseHint': 'ピークが下がるまで保持される時間',
  'look.drawnAs': '描画方法',
  'look.filled': '塗りつぶし',
  'look.stroked': '輪郭',
  'look.fill': '塗り',
  'look.weight': '太さ',
  'look.rainbow': 'レインボー',
  'look.glow': 'グロー',
  'look.off': 'オフ',
  'look.glowHint': 'ビートに合わせて図形が膨らみ、明るくなる強さです。',
  'look.glowNeedsRainbow':
    'レインボーモードが必要です。オフではグローは描画を変えません。',
  'look.needsRainbow': 'レインボーモードが必要です。',
  'look.rainbowBorder': 'レインボー枠',
  'look.rainbowBorderHint': '全色相を巡る色でグラフを囲みます。',
  'look.borderWeight': '枠の太さ',
  'look.litPeaks': 'ピーク発光',
  'look.litPeakWeight': 'ピークの太さ',
  'look.peakStyle': 'マーク',
  'look.peak.fall': 'フォール',
  'look.peak.ghost': 'ゴースト',
  'look.peak.ripple': 'リップル',
  'look.peak.sparks': 'スパーク',
  'look.peak.beam': 'ビーム',
  'look.peak.ceiling': 'シーリング',
  'look.peak.comet': 'コメット',
  'look.peak.drip': 'ドリップ',
  'look.peak.bead': 'ボックス',
  'look.peak.cap': 'キャップ',
  'look.peak.ring': 'リング',
  'look.peak.spark': 'スパーク',
  'look.peak.chevron': 'シェブロン',
  'look.peak.halo': 'ハロー',
  'look.peak.pin': 'ピン',
  'look.peak.crown': 'クラウン',
  'look.peak.cross': 'クロス',
  'look.peak.wave': 'ウェーブ',
  'look.noLitPeaks': 'この形には発光する先端がありません',
  'look.name': '名前',
  'look.resetAll': 'すべての設定をリセット',
  'look.resetAllHint': 'この形の初期設定に戻します',
  'look.export': 'この表示をファイルに書き出す',
  'look.exportHint': '共有できるファイルとして保存',
  'look.import': 'ファイルから表示を読み込む',
  'look.delete': 'この表示を削除',
  'look.save': '保存',
  'look.saveHint': 'この表示を保存して選択',
  'look.full': '一覧がいっぱいです — 表示を削除して空きを作ってください',
  'look.error.emptyFile': 'このファイルに表示設定が見つかりません。',
  'look.error.readFile': 'FluidEQ はこの表示ファイルを読み込めませんでした。',
  'support.eyebrow': '完全に任意です',
  'support.petHint': 'スペースキーで跳ねさせられます',
  'support.game.hint': 'ピークが線に達したらリズムに合わせて押します',
  'support.game.howTo':
    'ビートに合わせてペットをタップするかスペースキーを押してください。続けると ×10 で何かが起こります。',
  'support.game.thanks':
    '少しでも楽しんでいただけたなら、アイデアや支援がこの先を作ります。',
  'support.game.noAudio': '何か再生するとビートがここに出ます',
  'support.game.listening': 'ビートを探しています…',
  'support.game.share': '共有',
  'support.game.shareEuphoria': 'レインボーを共有',
  'support.game.shareTitle': 'スコアを共有',
  'support.game.shareUnlock':
    '×10 に到達すると、このカードはレインボーモードになります。スペクトラムもすべて。',
  'support.game.shareNote':
    'カードを保存して投稿に添付してください。これらのサービスはリンクから画像を取り込めません。',
  'support.game.shareSave': 'カードを保存',
  'support.game.shareCopyCard': 'カードをコピー',
  'support.game.shareCardCopied': 'コピーしました — 貼り付けてください',
  'support.game.shareCopy': 'テキストをコピー',
  'support.game.shareCopied': 'コピーしました',
  'support.game.shareLinkOnly':
    '共有されるのはリンクのみです。テキストはご自身で貼り付けてください',
  'support.game.euphoria': 'レインボーモード',
  'support.game.euphoriaToggle': 'レインボーモードのオン・オフ',
  'support.game.perfect': 'パーフェクト',
  'support.game.great': 'グレート',
  'support.game.good': 'グッド',
  'support.game.miss': 'ミス',
  'support.title': 'この仕事を支える',
  'support.close': '閉じる',
  'support.pitch':
    'FluidEQ は無料でオープンソースです。これからもそうです — ソースは公開されていて、いつでも無償で自分でビルドできますし、何も追跡しません。販売しているのは、署名済みですぐ使えるビルドです。あなたの環境で居場所を得られたなら、支援はこれを保守する時間と、同じ工房から次に生まれるアイデアに使われます。',
  'support.craft':
    'これは一人の手による仕事で、たっぷりの愛情と、常識外れなほどの細部へのこだわりで作られています。どのパネルも手描きで、何度も考え直しました。周波数特性が一瞬でどう見えるか、メニューがどう開くか、ノブをゆっくり動かしたときにどう反応するか、ボタンにどの言葉を置くか。既製の部品にテーマを被せただけの箇所はひとつもありません。',
  'support.card': 'カード / ウォレット',
  'support.card.hint':
    'Stripe による安全な決済です。ブラウザで開きます — アプリがカード情報を見ることはありません。',
  'support.coffee': 'コーヒーをおごる',
  'support.coffee.hint':
    'アカウント不要の一回きりの寄付です。クリックでブラウザが開きます。スマートフォンでコードを読み取ることもできます。',
  'support.verify': '送る前にアドレスを確認してください。',
  'support.copy': 'アドレスをコピー',
  'support.copied': 'コピーしました',
  'support.openWallet': 'ウォレットで開く',
  'support.contributed': '支援しました — 星とダンスを解除',
  'support.thanks': 'ありがとうございます — 相棒に星がつき、踊りはじめました。',
  'support.releaseNotes': 'このバージョンの新機能を見る',
  'support.footerBefore':
    '時間で貢献したいですか？ Issue や Pull Request も同じように歓迎です：',
};

export default look;
