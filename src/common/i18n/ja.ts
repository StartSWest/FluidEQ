/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { Dictionary } from './en';

/** Japanese. です・ます throughout, as desktop software normally is. */
const ja: Partial<Dictionary> = {
  'app.tagline': 'あなたの音を、どの機器でも、自動で。',
  'app.actions': 'FluidEQ の操作',
  'app.actions.title': 'オーディオ操作',
  'app.status.ready': 'Equalizer APO に接続済み',
  'app.status.checking': 'Equalizer APO を確認しています…',
  'app.status.error': 'Equalizer APO が応答しません',
  'app.menu.importEq': 'EQ 設定を読み込む…',
  'app.menu.importConvolution': 'インパルス応答を読み込む…',
  'app.menu.restartAudio': 'Windows オーディオを再起動',
  'app.menu.reconfigure': 'Equalizer APO を再設定',
  'app.menu.apoSettings': 'Equalizer APO の設定',
  'app.menu.support': 'プロジェクトを支援する',
  'app.menu.language': '言語',
  'app.window.minimize': '最小化',
  'app.window.maximize': '最大化',
  'app.window.restore': '元に戻す',
  'app.window.close': '閉じる',
  'app.window.minimizeApp': 'FluidEQ を最小化',
  'app.window.maximizeApp': 'FluidEQ を最大化',
  'app.window.restoreApp': 'FluidEQ を元に戻す',
  'app.window.closeApp': 'FluidEQ を閉じる',
  'app.dismiss': '閉じる',

  'tabs.aria': 'サウンド作業領域',
  'tabs.eq': 'EQ とドライバー種別',
  'tabs.voicing': '音の傾向',
  'tabs.convolution': 'コンボリューション',

  'notice.apoReconfigured':
    'Equalizer APO がインストールまたは再設定されました。音が出ない場合は PC を再起動せず、Windows オーディオを再起動してください。',
  'notice.restartNow': 'いますぐオーディオを再起動',
  'notice.importComplete': '読み込みが完了しました',
  'notice.restartConfirm':
    '音が数秒とまり、Windows が管理者権限を求めます。続けますか？',
  'notice.restartDone':
    'Windows オーディオを再起動しました。まだ無音のアプリは開き直してください。',

  'sidebar.engine': '処理',
  'sidebar.systemEq': 'システム EQ',
  'sidebar.preamp': 'プリアンプ',
  'sidebar.preampAria': 'プリアンプゲイン（dB）',
  'sidebar.preampAuto':
    '自動で設定されます。自分で決めるには自動ノーマライズをオフにしてください。',
  'sidebar.headroom': 'APO ヘッドルーム',
  'sidebar.autoPreamp': '自動ノーマライズ',
  'sidebar.visualizer': 'ビジュアライザー',
  'sidebar.graphView': '周波数特性',

  'output.eyebrow': '出力に追従します',
  'output.title': '自動プロファイル',
  'output.device': '出力デバイス',
  'output.active': '使用中',
  'output.none': '有効な出力が見つかりません',
  'output.mapping': '自動割り当て',
  'output.mapping.neutral': '無処理の出力',
  'output.mapping.live': '現在の調整を割り当て済み',
  'output.mapping.hint':
    'EQ をどれか動かすと、この出力に自動で保存・割り当てされます。',
  'output.hint':
    'FluidEQ はデバイスの固定 ID を記録するため、Windows がその機器を選ぶたびにこの音が付いてきます。',

  'driver.eyebrow': '何で聴いているか',
  'driver.title': 'ドライバー種別',
  'driver.none': '補正なし',
  'driver.none.hint': '自分のバンドと音の傾向だけ',
  'driver.strength': '強さ',
  'driver.range': '±1.5 dB',

  'profiles.eyebrow': 'あなたの音',
  'profiles.title': '保存したプロファイル',
  'profiles.name': 'プロファイル名',
  'profiles.nameAria': 'プロファイル名',
  'profiles.new': '新規プロファイル',
  'profiles.newAria': '現在の EQ から新しいプロファイルを作る',
  'profiles.untitled': '無題のプロファイル',
  'profiles.save': '新規保存',
  'profiles.update': '更新',
  'profiles.saveAria': '設定をプロファイルに保存',
  'profiles.restore': '復元',
  'profiles.restoring': '復元中…',
  'profiles.restoreAria': 'このプロファイルを手動保存した最後の状態に戻す',
  'profiles.attached': '再生中',
  'profiles.attachedTitle': 'この出力で再生中',
  'profiles.detecting': '出力を検出しています…',
  'profiles.empty': 'まだプロファイルがありません。最初の音を作りましょう。',
  'profiles.error.empty': 'プロファイル名は空にできません。',
  'profiles.error.restricted': '使えない名前です。別の名前にしてください。',
  'profiles.error.duplicate': '同じ名前があります。別の名前にしてください。',
  'profiles.edit': 'プロファイル名を編集',

  'autoeq.eyebrow': 'リファレンスから始める',
  'autoeq.title': 'AutoEQ ライブラリ',
  'autoeq.selectSource': 'ソースを選択',
  'autoeq.source': '測定ソース',
  'autoeq.model': 'ヘッドホンの機種',
  'autoeq.target': '測定 / ターゲット',
  'autoeq.apply': 'この機種の EQ を適用',
  'autoeq.applyAria': '選んだ機種の EQ を適用',
  'autoeq.checking': '公式データベースを確認しています…',
  'autoeq.updateAvailable': '更新があります（{count} 機種）',
  'autoeq.upToDate': '公式データベースは最新です — {count} 機種',
  'autoeq.updateUnknown': '更新を確認できません',
  'autoeq.update': 'データベースを更新',
  'autoeq.updating': '更新中…',
  'autoeq.updateAria': 'AutoEq データベースを更新',

  'eq.eyebrow': '微調整',
  'eq.title': 'パラメトリック EQ',
  'eq.smart': 'スマート EQ',
  'eq.smart.cancel': 'キャンセル',
  'eq.smart.aria': '再生中の出力からスマート EQ を作成',
  'eq.smart.cancelAria': 'スマート EQ の測定をキャンセル',
  'eq.smart.fromFlat': 'フラットから',
  'eq.layers': '同時に適用中',
  'eq.layers.aria': 'この出力に効いているその他の処理',
  'eq.layers.convolution': 'コンボリューション',
  'eq.layers.voicing': '音の傾向',
  'eq.layers.driver': 'ドライバー',
  'eq.layers.remove': '{layer} のレイヤーを外す',

  'convolution.eyebrow': 'APO インパルス応答',
  'convolution.title': 'コンボリューション ライブラリ',
  'convolution.intro':
    '検証済みの最小位相インパルス応答をダウンロードし、パラメトリック EQ の前段に適用します。下のグラフには両方の曲線が出ます。',
  'convolution.import': 'WAV を読み込む…',
  'convolution.importing': '読み込み中…',
  'convolution.applied': 'この出力に適用中',
  'convolution.clear': '外す',
  'convolution.search': 'ヘッドホンの機種を検索',
  'convolution.searchPlaceholder':
    '「Kraken」「HD 650」や測定元の名前で試してください',
  'convolution.notice':
    'ダウンロード可能なカタログは AutoEq が提供しています。Equalizer APO はインパルス応答が出力のサンプリング周波数と一致することを要求するため、48 kHz WAV として取り込みます。',
  'convolution.loading': '公式カタログを読み込んでいます…',
  'convolution.empty':
    '一致するインパルス応答がありません。機種名を短くしてみてください。',
  'convolution.source': '出典',
  'convolution.apply': 'ダウンロードして適用',
  'convolution.downloading': 'ダウンロード中…',
  'convolution.isApplied': '適用済み',
  'convolution.none':
    'コンボリューションは未読み込みです。EQ タブは完全に独立しています。',

  'voicing.eyebrow': 'ターゲットカーブ',
  'voicing.title': '音の傾向',
  'voicing.intro':
    'いま実際にやっていることに合わせて調整したターゲットです。どれもあなたのバンドの後ろに独立したレイヤーとして書かれるので、自分の調整は一切触られず、「なし」に戻せばそのまま元通りになります。',
  'voicing.none': 'なし',
  'voicing.none.hint': '自分の EQ バンドだけ。上に重ねるものはありません',
  'voicing.strength': '強さ',
  'voicing.off': 'オフ',
  'voicing.full': '最大',
  'voicing.inert': '強さ 0% では、この傾向は何もしません。',
  'voicing.headroom':
    '最大 +{peak} dB 増えます。自動ノーマライズが余裕を確保するので、プリアンプを手動で決めるのでなければオンのままにしてください。',

  'support.eyebrow': '完全に任意です',
  'support.title': 'この仕事を支える',
  'support.close': '閉じる',
  'support.pitch':
    'FluidEQ は無料でオープンソースです。これからもそうです — 有料の壁は一切なく、何も追跡しません。あなたの環境で居場所を得られたなら、支援はこれを保守する時間と、同じ工房から次に生まれるアイデアに使われます。',
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
  'support.footerBefore':
    '時間で貢献したいですか？ Issue や Pull Request も同じように歓迎です：',

  'language.title': '言語',
  'language.aria': '表示言語',
};

export default ja;
