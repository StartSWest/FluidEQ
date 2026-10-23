const account = {
  'account.validation.passwordRequired': 'パスワードを入力してください。',
  'account.validation.passwordShort': '{count}文字以上にしてください。',
  'account.validation.passwordLong': '128文字以内にしてください。',
  'account.validation.nameLong': '80文字以内にしてください。',
  'account.validation.code': '6桁のコードを入力してください。',
  'account.menu': 'アカウント',
  'account.eyebrow': 'FluidEQ',
  'account.title': 'アカウント',
  'account.checking': 'アカウントを確認しています…',
  'account.close': '閉じる',

  'account.optional':
    'サインインは任意です。アカウントがなければ FluidEQ はこれまでどおり動作し、すべてこのマシン上で動いて、何も追跡されません。アカウントがあると、オフにしない限り、聴いた時間が FluidEQ の統計のために数えられます。アカウントは本当に必要な機能のためだけにあります。',

  'account.signIn': 'サインイン',
  'account.signUp': 'アカウントを作成',
  'account.signInHint':
    'パスワードはアカウントサービスに直接送られ、アプリ内には一切保存されません。',
  'account.signUpHint':
    'そのアドレスに6桁のコードを送ります。ここに入力して完了してください。',
  'account.working': 'しばらくお待ちください…',
  'account.signOut': 'サインアウト',
  'account.signOut.confirm': 'このアカウントからサインアウトしますか？',
  'account.signOut.detail': 'いつでもサインインし直せます。',
  'account.signOut.detailPlus':
    '再びサインインするまで、ここではあなたのシーンはロックされたままです。',
  'account.signOut.kept': 'このパソコンのものは何も削除されません。',
  'account.name.change': '名前を変更',
  'account.name.changeTitle': '表示のされ方を変える',
  'account.name.changeBody':
    'あなたが公開したシーンに表示されるハンドルと名前です。変更はすべての場所に同時に反映されます。メールアドレスは公開されません。',
  'account.name.cancel': 'キャンセル',
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
  'account.error.signedOutElsewhere':
    'あなたのアカウントが別のコンピューターでサインインしたため、このコンピューターはサインアウトされました。アカウントは同時に最大 5 台のコンピューターでサインインしたままにできます。ここで使うにはもう一度サインインしてください。代わりに最も長く使われていないコンピューターがサインアウトされます。',
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

  'account.perk.looks': '永久にあなたのものになるシーン。1シーン1クレジット。',
  'account.perk.visualizers':
    'ビジュアライザー：メンバーが作ったシーンを、すべてのアカウントに公開。',
  // Signing in with Google, in the browser (main/account/googleSignIn.ts).
  'account.google': 'Googleで続行',
  'account.or': 'または',
  'account.google.waiting': 'ブラウザでGoogleのサインインを完了してください。',
  'account.google.cancel': 'キャンセル',
  'account.error.googleUnfinished':
    'Googleでのサインインが完了しませんでした。もう一度試すか、メールアドレスでサインインしてください。',
  'account.google.doneTitle': 'サインインしました',
  'account.google.doneBody': 'このタブを閉じてFluidEQに戻れます。',
  'account.google.failedTitle': 'サインインが完了しませんでした',
  'account.google.failedBody':
    'FluidEQに戻ってもう一度試すか、メールアドレスでサインインしてください。',
} as const;

export default account;
