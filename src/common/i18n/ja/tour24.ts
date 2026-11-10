// 2.4 の新機能（`renderer/components/featureTour/release24.tsx`）。
const tour24 = {
  'tour.animations.kicker': 'スタジオ · アニメーション',
  'tour.animations.title': 'AI が描く、動く生き物',
  'tour.animations.subtitle': 'シーンのアニメーションを 1 コマずつ',
  'tour.animations.lead':
    '鳥や魚、踊る人を頼むと、AI がシーンの中に 1 コマずつ描きます。アニメーションタブはそのすべてを再生します。',
  'tour.animations.point1':
    '地面・空・水の上で、上り坂でも下り坂でも、好きな速さで、1 コマずつ、またはスタジオ全体に大きく再生できます。',
  'tour.animations.point2':
    'アニメーションごとに専用のアニメーターが隣のチャットにいます。全コマを一度に見て、浮いたり跳ねたりするコマを見つけ、描き直します。',
  'tour.animations.point3':
    '新しいプロジェクトは、オーブの中の月とその上を飛ぶツバメから始まります。画像とアニメーションの仕組みを初日から学べます。',
  'tour.animations.how':
    'ビジュアライザーを開いてスタジオに進み、ステージの下のアニメーションを選びます。チャットに自分の言葉でアニメーションを頼んでください。',
  'tour.animations.open': 'ビジュアライザーを開く',
  'tour.animations.imageAlt':
    'スタジオのアニメーションタブ。空の背景で羽ばたくツバメと、帯に並んだ 8 コマ。隣ではアニメーターのチャットが跳ねるコマを見つけています。',
  'tour.animations.task': '羽ばたきの合間にツバメを滑空させて',
  'tour.animations.stepLook': '{count} コマすべてを並べて確認',
  'tour.animations.stepJump': '{frame} コマ目が他より跳ねています',
  'tour.animations.stepFix': '{frame} コマ目を他とそろえて描き直しました',
  'tour.animations.reply':
    '滑空が伝わるようになりました。翼が一拍長く開いたままで、跳ねるコマはありません。',

  'tour.pictures.kicker': 'スタジオ · 画像',
  'tour.pictures.title': '画像を見て、描き込んで、送り返す',
  'tour.pictures.subtitle': 'チャットの画像を拡大・コピーして描き込める',
  'tour.pictures.lead':
    'AI が作った画像も開いた画像も、すべてチャットに表示されます。クリックすると大きく開き、好きなだけ拡大できます。',
  'tour.pictures.point1':
    '拡大したその場所に描き込めます。丸で囲む、矢印で示す、文字を書く、大事な部分だけ切り抜く。そのまま次のメッセージに添付できます。',
  'tour.pictures.point2':
    'どの画像もボタン、Ctrl+C、右クリックでコピーして、好きな場所に貼り付けられます。',
  'tour.pictures.point3':
    '描き込みは画像と一緒に届くので、AI はあなたの意図をそのまま理解します。',
  'tour.pictures.how':
    'スタジオのチャットで画像をクリックして開き、描き込むで印を付けてから、チャットに添付を押します。',
  'tour.pictures.open': 'ビジュアライザーを開く',
  'tour.pictures.imageAlt':
    '大きく開いて拡大した月の画像。クレーターを囲む丸、矢印、文字が描かれ、切り抜き枠が狭まり、画像をコピーとチャットに添付のボタンがあります。下には画像が届いたチャット。',
  'tour.pictures.ask': 'オーブ用に、縁が光る月を。',
  'tour.pictures.reply': 'どうぞ。画像タブにも入っています。',
  'tour.pictures.mark': 'もっと明るく',
  'tour.pictures.followUp': 'このクレーターを低音で光らせて。',

  'tour.stage.kicker': 'スタジオ · ステージ',
  'tour.stage.title': '実際に表示される場所でシーンを試す',
  'tour.stage.subtitle':
    'ウルトラワイドのグラフ、コンパクトプレーヤー、穏やかと音楽',
  'tour.stage.lead':
    'ステージは、みんなが見るのと同じ形でシーンを映します。ウルトラワイドのグラフとして、またはコンパクトプレーヤーの列に、曲名と操作ボタンを重ねて。',
  'tour.stage.point1':
    'ステージを拡大して動き回れます。AI にはステージに映っているものがそのまま渡るので、「ここ」と言えば本当にそこです。',
  'tour.stage.point2':
    'ステージのボタンを 1 回押すだけで、音楽を「穏やか」に切り替えます。デスクトップ背景が再生する、ゆっくりしたアニメーションです。',
  'tour.stage.point3':
    '何も再生していないときはデモ曲に合わせて動くので、作業中にシーンが止まることはありません。',
  'tour.stage.how':
    'スタジオで、ステージのサイズメニューから形を選びます。音楽と穏やかのボタンはステージ上にあります。',
  'tour.stage.open': 'ビジュアライザーを開く',
  'tour.stage.imageAlt':
    'スタジオのステージに映る Alpine シーン。拡大しながら AI に見える範囲を枠で示し、音楽と穏やかのボタンがあります。隣には同じシーンのウルトラワイドのグラフと、操作ボタンを重ねたコンパクトプレーヤー。',
  'tour.stage.agentSees': 'AI に見える範囲',

  'tour.ai.kicker': 'スタジオ · あなたの AI',
  'tour.ai.title': 'すべてのシーンに取り組む AI',
  'tour.ai.subtitle': '複数のシーンを同時に、自分のツールで、好きなモデルで',
  'tour.ai.lead':
    'AI は複数のシーンに同時に取り組めるようになりました。シーンごとに専用のチャットがあり、Claude プランの消費も少なくなりました。',
  'tour.ai.point1':
    'あなた自身の Claude Code のツールやプラグインも使えます。それぞれ使う前にチャットのカードで確認します。1 回だけ許可、このチャットでは常に許可、許可しない。作業はシーンのフォルダーの中だけです。',
  'tour.ai.point2':
    '3D ワールド、3D 写真、アニメーションのための FluidEQ 独自のスキルがアプリに同梱され、常に最新です。',
  'tour.ai.point3':
    'チャットごとにモデルと労力を選べます。一覧は Claude Code に連動するので、新しいモデルも出てすぐに表示されます。',
  'tour.ai.how':
    'スタジオでシーンを開き、そのチャットに書き込みます。モデルと労力は入力欄の下にあります。',
  'tour.ai.open': 'ビジュアライザーを開く',
  'tour.ai.imageAlt':
    '同時に作業中の 3 つのシーン。2 つは進行中、1 つはバージョン 7 として保存済み。その下に FluidEQ のスキル。隣にはあなたのツールの許可を求めるカードと、モデルと労力のメニュー。',
  'tour.ai.skills': 'FluidEQ のスキル',
  'tour.ai.skillWorlds': '3D ワールド',
  'tour.ai.skillPhotos': '3D 写真',
  'tour.ai.skillAnimation': 'アニメーション',

  'tour.controls.kicker': 'シーン',
  'tour.controls.title': '自分好みに仕上げられるシーン',
  'tour.controls.subtitle':
    'パレット、選択肢、3D ワールド、保存されるバージョン',
  'tour.controls.lead':
    'シーンは、カラーパレット、アイコン付きの選択肢、単色、そしてそれを使う選択肢のときだけ現れる調整項目を提供できるようになりました。',
  'tour.controls.point1':
    '3D ワールドには曲がった円柱や円錐、本物の床が加わり、シーンはデモ曲に合わせた昼間の、より鮮明なプレビュー動画付きで公開されます。',
  'tour.controls.point2':
    '公開画面にシーンの容量が表示されます。バージョンが上がるのは公開したときだけで、ステータス行に今のバージョンが表示されます。',
  'tour.controls.point3':
    'ギャラリーは各シーンの直近 10 バージョンを保管し、シーンのページからどれでもこのコンピューターに保存できます。',
  'tour.controls.how':
    'スタジオでシーンの調整タブを開きます。シーンのバージョンはギャラリーのそのページにあります。',
  'tour.controls.open': 'ビジュアライザーを開く',
  'tour.controls.imageAlt':
    '2 つのカラーパレットと、晴れ・雨・雪と切り替わる天気の選択肢がある調整タブ。雪のときだけ降雪量のスライダーが現れます。隣にはシーンのページと、そのサイズ、バージョン、保存されたバージョン。',
  'tour.controls.weather': '天気',
  'tour.controls.clear': '晴れ',
  'tour.controls.rain': '雨',
  'tour.controls.snow': '雪',
  'tour.controls.glow': '月の輝き',
  'tour.controls.snowfall': '降雪量',

  'tour.camera.kicker': 'ビジュアライザー',
  'tour.camera.title': 'グラフでもデスクトップでも、シーンの中を動き回る',
  'tour.camera.subtitle': '自分のカメラキーと、マウスに応えるデスクトップ',
  'tour.camera.lead':
    '3D シーンのカメラを動かすキー（Ctrl、Alt、Shift、または好きなキー）と、押したままドラッグするか、押したまま動かすだけかを選べます。',
  'tour.camera.point1':
    '「マウスに追従」をオンにするとシーンがポインターの方へ傾き、「自動で回る」に任せることもできます。視点をリセットはキーを押している間だけ表示されます。',
  'tour.camera.point2':
    'デスクトップのビジュアライザーは、何もないデスクトップ上のマウスに反応します。モニターごとに時刻を持ち、スタジオは最新バージョンをデスクトップに設定します。',
  'tour.camera.point3':
    'ビートのフラッシュはキックに合わせて光り、何も再生していないときギャラリーのプレビューはデモ曲で動き、壊れたシーンはシンプルな見た目ではなく最後に動いたバージョンを再生します。',
  'tour.camera.how':
    'カメラの設定は、グラフの表示メニューのシーンの下にあります。',
  'tour.camera.open': 'EQ を開く',
  'tour.camera.imageAlt':
    'それぞれのデスクトップにビジュアライザーを映した 2 台のモニター。1 台目ではシーンがポインターの方へ傾き、Ctrl を押している間だけ視点をリセットが表示されます。どちらも独自の時刻を持ち、下にはカメラの設定。',

  'tour.v24.also': '2.4 のその他の更新',
  'tour.v24.level':
    '一時停止のあとの曲はその曲の音量で始まり、Windows が出力を開き直しても自動ノーマライズの音量が保たれます。',
  'tour.v24.heroes':
    'Heroes of the Storm に、オプションのワイドステージ付きの、より厚みのある専用ミックスが加わり、ゲームフィルターは合図を目立たせながら音楽をより安定させます。',
  'tour.v24.graphSettings':
    'グラフは標準の見た目とビジュアライザーで、別々の設定を保ちます。',
  'tour.v24.colourful': 'カラフルモードはグラフのシーンの色を使います。',
  'tour.v24.gallery': 'ギャラリーは新着シーンから開きます。',
  'tour.v24.credits': 'ブラウザーで購入したクレジットは自動で届きます。',
  'tour.v24.sponsors':
    '「このアプリについて」やサポートページから、GitHub Sponsors で FluidEQ を支援できます。',
  'tour.v24.crashes':
    '万一 FluidEQ がクラッシュしても、記録はこのコンピューターにだけ残り、送るかどうかはあなたが決めるバグレポートに使えます。',
} as const;

export default tour24;
