const leaderboard = {
  'leaderboard.title': 'ランキング',
  'leaderboard.card.title': 'ランキング',
  'leaderboard.card.body':
    'Plus メンバーの中で誰が一番聴いているか。参加しない限りオフです。参加すると、アプリは一日ごとにひとつの数字だけを送ります — 実際に再生された音楽の分数（上限16時間）とその日付。パソコンに戻ったときやランキングを開いたときに更新します。何を聴いたか、どこから聴いたかは決して送りません。',
  'leaderboard.card.today': '今日はここまで：{hours} 時間',
  'leaderboard.card.join': 'ランキングに参加',
  'leaderboard.card.leave': 'ランキングから離れる',
  'leaderboard.card.remove': '自分のデータをすべて削除',
  'leaderboard.card.removed':
    '削除しました。ランキングにあなたのデータは残っていません。',
  'leaderboard.card.removeConfirmTitle': '送信したデータをすべて削除しますか？',
  'leaderboard.card.removeConfirmBody':
    'あなたの順位とランキング上の毎日の視聴記録は完全に削除され、元に戻せません。再び参加するとゼロから始まります。',
  'leaderboard.card.removeKeep': 'データを残す',
  'leaderboard.card.removeConfirm': 'すべて削除',
  'leaderboard.card.plusOnly':
    'ランキングに載るのは Plus メンバーだけです。それまで参加しても何も起きません。',
  'leaderboard.allTime': '全期間',
  'leaderboard.thisMonth': '今月',
  'leaderboard.hours': '{hours} 時間',
  'leaderboard.you': 'あなた',
  'leaderboard.players': '{count} 人がランキング中',
  'leaderboard.points': '{points} pt',
  'leaderboard.hero.title': 'あなたの順位',
  'leaderboard.hero.of': '{count} 人中',
  'leaderboard.hero.toPass': 'あと {points} pt で {name} を抜けます',
  'leaderboard.hero.leading': '首位です。',
  'leaderboard.part.hours': '視聴',
  'leaderboard.part.days': 'アクティブな日',
  'leaderboard.part.likes': 'シーンへのいいね',
  'leaderboard.guide.title': 'ポイントの獲得方法',
  'leaderboard.guide.lead':
    '誰でも同じ方法でポイントを獲得します。制作者も同じです。',
  'leaderboard.guide.hours': '音楽が再生された1時間ごと。1日{limit}時間まで。',
  'leaderboard.guide.days': '{limit}分以上聴いた日ごと。',
  'leaderboard.guide.likes':
    'あなたが作成したシーンに他のメンバーがつけたいいね1件ごと。',
  'leaderboard.guide.value': '+{points}',
  'leaderboard.guide.fairTitle': '数字の出どころ',
  'leaderboard.guide.fair':
    '音楽の分数はあなたのパソコンが数え、参加後にだけ1日ひとつの合計を送ります。何を聴いたかは送りません。いいねはサーバーで数えます。すべての数字はサーバーで確認され、不正をするとランキングから外されます。',
  'leaderboard.guide.terms': 'アプリが送るすべての情報',
  'leaderboard.stat.hours': '{hours} 時間視聴',
  'leaderboard.stat.days': 'アクティブな日 {count} 日',
  'leaderboard.stat.likes': 'シーンへのいいね {count} 件',
  'leaderboard.scoring':
    'ポイント：視聴1時間ごとに{hours}、アクティブな日ごとに{days}、作成したシーンへのいいね1件ごとに{likes}。制作者も同じ方法で獲得します。',
  'leaderboard.rail.blurb': '誰が一番聴いているか',
  'leaderboard.role.admin': '作者',

  // The name the board ranks, chosen once on the board itself.
  'leaderboard.name.title': 'ランキングでの表示を決める',
  'leaderboard.name.body':
    'ハンドルと名前です。ランキングではこの名前であなたの順位が表示され、ビジュアライザーのギャラリーではあなたのシーンの作者として表示されます。サインインしている人なら誰でも見られますが、メールアドレスは誰にも見えません。',
  'leaderboard.name.handle': 'ハンドル',
  'leaderboard.name.handleHint': '半角英数字と _ で 3〜20 文字',
  'leaderboard.name.name': '表示名',
  'leaderboard.name.previewName': 'あなたの名前',
  'leaderboard.name.save': '保存',
  'leaderboard.name.choose': '名前を決める',
  'leaderboard.name.error.handleTaken':
    'そのハンドルは使われています。別のものをお試しください。',
  'leaderboard.name.error.signedOut':
    'サインアウトされました。もう一度サインインしてください。',
  'leaderboard.name.error.network':
    'サーバーに接続できません。接続を確認してもう一度お試しください。',
  'leaderboard.name.error.rejected':
    'サーバーがその名前を拒否しました。別の名前をお試しください。',
  'leaderboard.empty': 'まだ誰もいません。',
  'leaderboard.notJoined':
    'ランキングに載っていません。アカウントパネルから参加できます。',
  'leaderboard.loading': '読み込み中…',
  'leaderboard.error.network':
    'ランキングに接続できません。接続を確認してください。',
  'leaderboard.error.plusRequired':
    'ランキングに載るのは Plus メンバーだけです。',
  'leaderboard.error.signedOut':
    'サインアウトされました。もう一度サインインしてください。',
  'leaderboard.error.rejected': 'ランキングサービスが拒否しました。',
} as const;

export default leaderboard;
