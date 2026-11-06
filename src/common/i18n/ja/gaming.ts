/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The Gaming Lab. See `en/gaming.ts`. */
export default {
  'gaming.tab': 'ゲーミングラボ',
  'gaming.view.games': 'ゲーム',
  'gaming.view.profiles': 'ゲーミングプロファイル',
  'gaming.switch': 'ゲームが前面にあるとき切り替える',
  'gaming.switch.hint':
    'オフのときは、ゲームも音楽用のサウンドのままで、勝手に切り替わることはありません。',
  'gaming.add': 'ゲームを追加',
  'gaming.list.show': 'ゲーム名を表示',
  'gaming.list.hide': 'ゲームアイコンを表示',
  'gaming.list.resize': 'ゲーム一覧のサイズを変更',
  'gaming.list.count': 'あなたのゲーム · {count}',
  'gaming.list.from': '元: {profile}',
  'gaming.list.tuned': '調整済み',
  'gaming.list.playing': 'プレイ中',
  'gaming.empty.title': 'まだゲームがありません',
  'gaming.empty.more':
    'ゲームを追加すると、そのゲーム用に作られたゲーミングプロファイルからコピーした専用のサウンドが付きます。ここで調整するのはコピーで、プロファイルは元のままです。',
  'gaming.game.where': '{source} · {output} で再生',
  'gaming.profile.label': 'ゲーミングプロファイル',
  'gaming.profile.kind.title': 'このゲーム用',
  'gaming.profile.kind.kind': 'ジャンル別',
  'gaming.profile.kind.yours': 'マイ',
  'gaming.profile.kind.chain': 'DSP プリセット',
  'gaming.profile.gone': '存在しなくなったプロファイル',
  'gaming.profile.pickHint':
    '別のプロファイルを選ぶと、このゲームにそのコピーが新しく作られます。',
  'gaming.save': 'プロファイルとして保存',
  'gaming.save.new': '新しいプロファイルとして保存…',
  'gaming.save.newHint':
    '「マイ」に入り、ほかのゲームもここから始められます。{game} もここから始まるようになります。',
  'gaming.save.update': '{profile} を更新',
  'gaming.save.updateHint':
    'あなたのプロファイルにこの変更が入ります。ここから始めたゲームはそれぞれのコピーを保ちます。',
  'gaming.save.reset': '{profile} に戻す',
  'gaming.save.resetHint':
    'このゲームの調整を破棄して、プロファイルからやり直します。',
  'gaming.save.rename': 'このコピーの名前を変更…',
  'gaming.save.delete': 'このコピーを削除',
  'gaming.save.deleteHint':
    'このゲームとその調整を削除します。プロファイルはそのまま残ります。',
  'gaming.action.unload': 'アンロード',
  'gaming.action.unloadHint': '音楽用のサウンドが今すぐ戻ります。',
  'gaming.action.try': '今すぐ試す',
  'gaming.action.tryHint':
    '{game} 専用のサウンドを今すぐ有効にして、聴きながら調整できるようにします。',
  'gaming.status.tuned':
    'このゲーム用の {profile} のコピー。調整済み: {parts}。プロファイル自体は変わっていません。',
  'gaming.status.tunedNamed':
    '{copy}: このゲーム用の {profile} のコピー。調整済み: {parts}。プロファイル自体は変わっていません。',
  'gaming.status.same':
    'プロファイルと同じです。ここで変えたものはこのゲームにだけ残り、プロファイル自体は変わりません。',
  'gaming.rail.game': 'ゲーム',
  'gaming.rail.sound': 'サウンド',
  'gaming.rail.dsp': 'DSP',
  'gaming.rail.tuned': '調整済み',
  'gaming.stage.footsteps': 'ゲームフィルター',
  'gaming.stage.mainEq': 'EQ',
  'gaming.stage.curve': 'カーブ',
  'gaming.curve.any': 'どのゲームでも',
  'gaming.editor.notLoaded': '{game} 専用のサウンドは再生されていません',
  'gaming.editor.notLoadedMore':
    '今すぐ試すと、聴きながらここで調整できます。音楽用のサウンドは「アンロード」か、ゲームを閉じたときに戻ります。',
  'gaming.editor.eqNote':
    'このゲーム専用のバンドです。上のグラフが表示されているときはそこに描かれます。',
  'gaming.editor.curveNote':
    'このゲームで鳴るヘッドホン補正(あなたのカーブ、またはヘッドホンのもの)と、一緒にかかっているすべてのカーブ。それぞれの × で外せます。',
  'gaming.saveDialog.title': 'ゲーミングプロファイルとして保存',
  'gaming.saveDialog.hint':
    'ゲーミングプロファイルの一覧から、ほかのゲームもここから始められます。',
  'gaming.saveDialog.placeholder': 'プロファイル名',
  'gaming.renameDialog.title': 'このコピーの名前を変更',
  'gaming.renameDialog.hint': 'この名前が付くのはこのゲームのコピーだけです。',
  'gaming.renameDialog.placeholder': 'コピーの名前',
  'gaming.addDialog.title': 'ゲームを追加',
  'gaming.addDialog.intro':
    'ゲームを選んでください。ゲーミングプロファイルから始まり、専用のコピーが作られます。調整するのはこのゲームのコピーで、プロファイル自体は変わりません。',
  'gaming.addDialog.running': '起動中',
  'gaming.addDialog.installed': 'この PC で見つかったゲーム',
  'gaming.addDialog.startsFrom': '開始プロファイル',
  'gaming.addDialog.browse': '見つからない場合はゲームのプログラムを参照…',
  'gaming.addDialog.later':
    'あとからいつでも別のゲーミングプロファイルを選べます。',
  'gaming.addDialog.add': '{game} を追加',
  'gaming.addDialog.cancel': 'キャンセル',
  'gaming.addDialog.loading': 'ゲームを探しています…',
  'gaming.addDialog.none':
    'まだここにないゲームはどのランチャーにもありません。代わりにゲームのプログラムを参照してください。',
  'gaming.addDialog.close': '閉じる',
  'gaming.profiles.intro':
    'ゲームはプロファイルの専用コピーを受け取ります。調整するのはコピーで、プロファイルは変わりません。',
  'gaming.profiles.search': 'プロファイルとゲームを検索',
  'gaming.profiles.searchClear': '検索をクリア',
  'gaming.profiles.noMatch':
    '「{query}」に一致するゲーミングプロファイルはありません。',
  'gaming.profiles.filterLabel': '表示',
  'gaming.profiles.noCurve': 'カーブなし：ゲームのミックスのまま',
  'gaming.profiles.filter.all': 'すべて',
  'gaming.profiles.filter.yours': 'マイ',
  'gaming.profiles.yours': 'マイ · ゲームのコピーから保存',
  'gaming.profiles.yoursEmpty':
    'まだありません。ゲームを調整して「プロファイルとして保存」を使うと、そのサウンドをここに残せます。',
  'gaming.profiles.readyGroup': '既製 · {group}',
  'gaming.profiles.savedFrom': '{game} のコピーから保存',
  'gaming.profiles.usedBy': '{games} がここから開始',
  'gaming.profiles.use': 'ゲームに使う',
  'gaming.profiles.rename': '名前を変更',
  'gaming.profiles.delete': '削除',
  'gaming.profiles.confirmDelete':
    '削除しますか? ゲームはそれぞれのコピーを保ちます。',
  'gaming.profiles.keep': '残す',
  'gaming.profiles.renameTitle': 'ゲーミングプロファイルの名前を変更',
  'gaming.profiles.renameHint':
    'ここから始めたゲームはコピーを保ちます。変わるのは名前だけです。',
  'gaming.toast.loaded': 'ゲーム用プロファイルを読み込みました',
  'gaming.toast.restored': '音楽用プロファイルに戻りました',
  'gaming.paused.notice': '一時停止中: {game} 専用のサウンドを再生中',
  'gaming.paused.tune': '{game} を調整',
  'gaming.paused.title': '音楽用のラックは待機中です',
  'gaming.paused.body':
    '{game} の起動中は専用のサウンドがオンになり、このラックは一時停止します。ゲームを閉じたとき、または今すぐ「アンロード」すると、元のとおりに戻ります。',
  'gaming.paused.stages': '{preset} · 戻ってくるもの',
  'gaming.paused.none': 'すべての段がオフです。',
  'gaming.profileSelect.game': '{game} · ゲームのサウンド',
  'gaming.preset.tuned': '{game}(カスタム)',
  'gaming.preset.openHint':
    '{game} 専用のサウンドが読み込まれています。プリセットはゲーミングラボで変更します。',
  'gaming.now.hint': '{game} 専用のサウンドが再生中です。ゲームを表示します。',
} as const;
