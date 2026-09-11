const account = {
  'account.menu': 'アカウント',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'アカウント',
  'account.close': '閉じる',

  'account.optional':
    'サインインは任意です。アカウントがなくても FluidEQ はこれまでどおり動作します。すべてこのマシン上で動き、何も追跡されません。アカウントは本当に必要な機能のためだけにあります。',

  'account.signIn': 'サインイン',
  'account.signUp': 'アカウントを作成',
  'account.signInHint':
    'パスワードはアカウントサービスに直接送られ、アプリ内には一切保存されません。',
  'account.signUpHint':
    'そのアドレスに6桁のコードを送ります。ここに入力して完了してください。',
  'account.working': 'しばらくお待ちください…',
  'account.signOut': 'サインアウト',
  'account.signedIn': 'サインイン済み',
  'account.backToSignIn': 'サインインに戻る',

  'account.field.email': 'メールアドレス',
  'account.field.emailHint':
    '誰にも表示されません。サインインとコードの受け取りにのみ使います',
  'account.field.password': 'パスワード',
  'account.field.passwordHint': '{count} 文字以上',
  'account.field.name': '名前',
  'account.field.optional': '任意',
  'account.field.code': 'メールのコード',

  'account.code.sent': '{email} に6桁のコードを送りました。',
  'account.code.confirm': '確認',
  'account.code.sendAgain': 'コードを再送する',
  'account.code.sentAgain': '再送しました',
  'account.code.otherEmail': '別のメールアドレスを使う',
  'account.code.hint':
    '届きませんか？迷惑メールフォルダを確認してください。また、このアドレスですでにアカウントがある場合はコードは送られません。代わりにサインインしてください。',

  'account.forgot.link': 'パスワードをお忘れですか？',
  'account.forgot.lead':
    '登録に使ったアドレスを入力すると、そこにコードを送ります。',
  'account.forgot.submit': 'リセットコードを送る',
  'account.reset.sent':
    '{email} に6桁のコードを送りました。ここにコードと新しいパスワードを入力してください。',
  'account.reset.submit': '新しいパスワードを設定',

  'account.unavailable': 'このシステムではサインインできません',
  'account.unavailableHint':
    'このマシンにはサインイン情報を安全に保存できる場所がないため、FluidEQ は保存しません。それ以外はすべて通常どおり動作します。',

  'account.error.network':
    'アカウントサービスに接続できません。接続を確認してもう一度お試しください。',
  'account.error.rejected':
    'アカウントサービスが拒否しました。しばらくしてからもう一度お試しください。',
  'account.error.expired':
    'このサインインは無効になりました。もう一度サインインしてください。',
  'account.error.malformed':
    'アカウントサービスから FluidEQ が読めない応答が返りました。',
  'account.error.wrongCredentials': 'メールアドレスかパスワードが違います。',
  'account.error.unconfirmed':
    'このアカウントはまだ確認されていません。メールのコードを入力して完了してください。',
  'account.error.weakPassword':
    'このパスワードは推測されやすすぎます。もっと長く、以前使っていないものを試してください。',
  'account.error.badCode':
    'コードが違うか、期限が切れています。新しいコードを取得してください。',
  'account.error.rateLimited':
    '短時間に試行が多すぎます。1分ほど待ってからもう一度お試しください。',
  'account.error.invalidEmail': 'メールアドレスの形式ではないようです。',
  'account.error.alreadyRegistered':
    'このアドレスのアカウントはすでにあります。代わりにサインインしてください。',

  'account.plus.eyebrow': 'FluidEQ Plus',
  'account.plus.pitch':
    'ここにしかないビジュアライザー、コミュニティへの投稿、ランキング、機能リクエストの直通窓口。そしてこれから追加されるすべての新機能は、メンバーが最初に使えます。今日無料のものはずっと無料のままです。',
  'account.plus.upgrade': 'Plus にアップグレード',
  'account.plus.opening': '開いています…',
  'account.plus.checkoutHint':
    'ブラウザで Buy Me a Coffee を開きます。FluidEQ が認識できるよう、このアカウントと同じメールアドレスで支払ってください。アプリがカード情報を見ることはありません。',
  'account.plus.active': '有効',
  'account.plus.renews': '{date} に更新',
  'account.plus.ends': '{date} に終了',
  'account.plus.manage': 'サブスクリプションを管理',
  'account.plus.grace':
    'サブスクリプションを確認できませんでした。{date} まで有効です。それまでにインターネットに接続すると維持されます。',
  'account.plus.checkAgain': 'もう一度確認',
  'account.plus.perMonth': '{price} / 月',
  'account.plus.perYear': '{price} / 年',
  'account.plus.priceChoice': '{monthly} または {yearly}',
  'account.plus.checkoutOpened':
    'ブラウザで Buy Me a Coffee が開いています。お支払い後にここへ戻ると、Plus が有効になります。',
  'account.plus.error.rejected':
    '決済ページを開けませんでした。しばらくしてからもう一度お試しください。',

  'account.dev.label': '開発',
  'account.dev.start': '支払いを模擬する',
  'account.dev.cancel': '解約を模擬する',
  'account.dev.working': '送信中…',

  'account.perk.looks': 'グラフィックカードで描かれる Plus のルック。',
  'account.perk.community': '誰でも読めて、メンバーが投稿できるコミュニティ。',
  'account.perk.board': '最もよく聴く人のランキング。',
} as const;

export default account;
