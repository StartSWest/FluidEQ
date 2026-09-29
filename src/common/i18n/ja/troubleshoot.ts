const troubleshoot = {
  'troubleshoot.title': 'オーディオの問題を解決',
  'troubleshoot.description':
    '上から順に試し、効果があったところで止めてください。下に行くほど影響が大きくなり、ほとんどの問題は最初の手順で解決します。',
  'troubleshoot.footer':
    'それでも直らない場合は、同じメニューの **{report}** を使ってください。ログを集め、あなたを特定できる情報を取り除いたうえで、送信前にすべての内容を表示します。',
  'troubleshoot.tried': '試しました',
  'troubleshoot.restart.title': 'Windows のオーディオを再起動',
  'troubleshoot.restart.when':
    '音が止まった、または再生中なのにグラフが平らなままになっている場合。ほぼすべてのケースで効く、最初に試すべき手順です。',
  'troubleshoot.restart.cost':
    '数秒間、音が出なくなります。Windows が許可を求めます。',
  'troubleshoot.apo.reselect.title': 'Equalizer APO でデバイスを選び直す',
  'troubleshoot.apo.reselect.when':
    'あるデバイスにはイコライザーがかかるのに別のデバイスにはかからない、または接続したばかりのヘッドセットが無視される場合。Equalizer APO は出力ごとに個別に組み込まれ、新しいデバイスはチェックを入れるまで対象になりません。',
  'troubleshoot.apo.reselect.cost':
    'Equalizer APO の Device Selector が開きます。その後、再起動が必要です。',
  'troubleshoot.apo.openSelector': 'Device Selector を開く',
  'troubleshoot.apo.mode.title': 'もう一方のインストール方式を試す',
  'troubleshoot.apo.mode.when':
    'Device Selector でチェックを入れても効果がない、またはチェックを入れるとそのデバイスの音がまったく出なくなる場合。Equalizer APO は Windows のオーディオに 2 通りの方法で組み込めますが、ハードウェアによっては片方でしか動きません。',
  'troubleshoot.apo.mode.cost':
    '再起動が 1 回必要です。同じ手順で元に戻せます。',
  'troubleshoot.apo.mode.detail':
    'Device Selector で **Troubleshooting options** を開きます。既定は **APO** としてのインストールで、ほとんどのパソコンで動作します。**Install as SFX/EFX** がもう一方の方式で、ドライバーが独自のエフェクトを持つデバイス（ノートパソコンやゲーミング向けのオーディオに多い）で試すべきものです。チェックを入れたらデバイスが動かなくなった場合は、イコライザーをかけられないと判断する前に、もう一方の方式を試してください。',
  'troubleshoot.apo.reinstall.title': 'Equalizer APO を再インストール',
  'troubleshoot.apo.reinstall.when':
    '最初の 2 つで変化がなかった場合や、Windows の更新以降イコライザーが動かなくなった場合。インストーラーは修復ツールも兼ねていて、オーディオコンポーネントを登録し直し、デバイスの一覧を開き直します。',
  'troubleshoot.apo.reinstall.cost':
    '管理者の許可が必要で、その後パソコンの再起動が必要です。FluidEQ のプロファイルとプリセットはそのままです。',
  'troubleshoot.apo.readd.title': 'デバイスを外して再起動し、もう一度追加する',
  'troubleshoot.apo.readd.when':
    '再インストール後も特定のデバイスだけがおかしい場合に限ります。Device Selector でチェックを外してパソコンを再起動し、もう一度チェックを入れて、さらにもう一度再起動します。',
  'troubleshoot.apo.readd.cost': '再起動が 2 回必要です。',
  'troubleshoot.apo.readd.detail':
    '2 回の再起動は迷信ではありません。Equalizer APO はパソコンの起動時にオーディオのエンドポイントへ組み込まれるため、Windows の動作中に外したデバイスは再起動するまで中途半端に組み込まれたままになり、その前に追加し直すと壊れた状態がそのまま戻ってしまいます。',
  'troubleshoot.engine.enable.title': 'FluidEQ エンジンを出力に付け直す',
  'troubleshoot.engine.enable.when':
    'あるデバイスにはイコライザーがかかるのに別のデバイスにはかからない、または接続したばかりのヘッドセットが無視される場合。エンジンは出力ごとに個別に組み込まれ、Windows の更新で組み込み済みの出力から外れることがあります。',
  'troubleshoot.engine.permission':
    'Windows が許可を求め、オーディオが一瞬再起動します。パソコンの再起動は不要です。',
  'troubleshoot.engine.remove.title': 'この出力から FluidEQ エンジンを外す',
  'troubleshoot.engine.remove.when':
    'この出力だけが上のどの手順でも直らない、または別のオーディオソフトに戻したい場合。Windows が今再生している出力からエンジンを外し、置き換える前の状態に戻します。',
  'troubleshoot.engine.remove.cost':
    'Windows が許可を求め、オーディオが一瞬再起動します。ほかの出力はそのままで、ひとつ上の手順で元に戻せます。',
  'troubleshoot.engine.remove.action': 'この出力から外す',
} as const;

export default troubleshoot;
