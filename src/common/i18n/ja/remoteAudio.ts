/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': '音声を共有',
  'remoteAudio.eyebrow': 'LAN オーディオリンク',
  'remoteAudio.title': 'ほかのコンピューターの音をここで聴く',
  'remoteAudio.subtitle':
    '2 台のコンピューターをリンクすると、互いの音を再生します。それぞれ自分の音を手を加えずに送り、聴いている側のコンピューターが自分の EQ・カーブ・DSP をかけます。',
  'remoteAudio.security': '接続の特性',
  'remoteAudio.badge.local': 'プライベート LAN のみ',
  'remoteAudio.badge.lossless': 'ロスレス Float32 PCM 伝送',
  'remoteAudio.badge.encrypted': 'AES-256-GCM 暗号化',
  'remoteAudio.link.section': 'コンピューターをリンク',
  'remoteAudio.link.thisComputer': 'このコンピューター',
  'remoteAudio.link.thisHint':
    'このコードをもう一方のコンピューターに貼り付けるか、そのコンピューターのコードをここに貼り付けます。どちらでも構いません。',
  'remoteAudio.link.or': 'または',
  'remoteAudio.link.otherComputer': 'もう一方のコンピューターのコード',
  'remoteAudio.link.codeLabel': '接続コード',
  'remoteAudio.link.placeholder': 'FLUIDEQ-LAN-2… を貼り付け',
  'remoteAudio.link.start': 'リンク',
  'remoteAudio.link.otherHint':
    '2 台はすぐに互いの音を再生します。片方向だけにしたい場合は、あとで一方をオフにしてください。',
  'remoteAudio.link.once':
    '一度だけで済みます。リンクしたコンピューターは、どちらが再起動しても自動でまたつながります。',
  'remoteAudio.rule.echoTitle': '双方向、エコーなし',
  'remoteAudio.rule.echo':
    '各コンピューターは自分で再生している音だけを送り、受け取っている音は送らないので、何も戻ってきません。',
  'remoteAudio.rule.eqTitle': '聴く場所で EQ',
  'remoteAudio.rule.eq':
    '音は手を加えずに送られます。聴いているコンピューターが EQ・ヘッドホンカーブ・DSP を 1 回だけかけます。',
  'remoteAudio.rule.steadyTitle': '安定、ずれなし',
  'remoteAudio.rule.steady':
    '遅れは約 30 ms で一定です。2 台のクロックを揃えるので、音切れも、じわじわとしたずれもありません。',
  'remoteAudio.linked.section': 'リンク中',
  'remoteAudio.linked.cardLabel': '{name} とのリンク',
  'remoteAudio.linked.bothWays': '双方向',
  'remoteAudio.linked.incomingOnly': '受信のみ',
  'remoteAudio.linked.outgoingOnly': '送信のみ',
  'remoteAudio.linked.paused': '一時停止',
  'remoteAudio.linked.looking': 'ネットワーク上で {name} を探しています…',
  'remoteAudio.linked.lossless': 'ロスレス',
  'remoteAudio.linked.unlink': 'リンク解除',
  'remoteAudio.linked.noEcho':
    'エコーなし：{name} の音が送り返されることはありません。',
  'remoteAudio.linked.untouched':
    '双方向とも手を加えずに送られ、それぞれのコンピューターが自分の EQ と DSP をかけます。',
  'remoteAudio.lane.from': '{name} から',
  'remoteAudio.lane.to': '{name} へ',
  'remoteAudio.lane.playsHere': 'ここで再生',
  'remoteAudio.lane.yourSound': 'あなたの音',
  'remoteAudio.lane.playItHere': 'ここで再生する',
  'remoteAudio.lane.sendMySound': '自分の音を送る',
  'remoteAudio.lane.delay': '遅延',
  'remoteAudio.lane.sent': '送信',
  'remoteAudio.lane.milliseconds': '{milliseconds} ms',
  'remoteAudio.lane.megabits': '{megabits} Mb/s',
  'remoteAudio.lane.receiving': '受信中',
  'remoteAudio.lane.paused': '一時停止',
  'remoteAudio.lane.inQuiet': '{name} では何も再生されていません',
  'remoteAudio.lane.inOff':
    'オフ：{name} の音はこのコンピューターでは再生されません。',
  'remoteAudio.lane.inNotSent': '{name} は「自分の音を送る」がオフです。',
  'remoteAudio.lane.inOld':
    '{name} がここへ音を送るには、最新の FluidEQ が必要です。',
  'remoteAudio.lane.inOneWay':
    '双方向で再生するには、このコンピューターに Windows が必要です。',
  'remoteAudio.lane.outQuiet': 'このコンピューターでは何も再生されていません',
  'remoteAudio.lane.outOff':
    '送信していません。{name} にはこのコンピューターの音は聞こえません。',
  'remoteAudio.lane.outNotPlayed': '{name} は「ここで再生する」がオフです。',
  'remoteAudio.lane.outOld':
    '{name} がこのコンピューターの音を再生するには、最新の FluidEQ が必要です。',
  'remoteAudio.lane.outOneWay':
    '双方向で送信するには、このコンピューターに Windows が必要です。',
  'remoteAudio.lane.outFailed':
    'このコンピューターの音をキャプチャできませんでした。「自分の音を送る」をオフにしてからオンにし直してください。',
  'remoteAudio.another.section': 'ほかのコンピューターをリンク',
  'remoteAudio.another.hub':
    'このコンピューターのコードを別のコンピューターに貼り付けます。リンクしたコンピューターごとに、上に行が追加されます。',
  'remoteAudio.another.spoke':
    '3 台目をリンクするには、そのコンピューターに {name} のコードを貼り付けます。コンピューターは、使ったコードの相手とリンクします。',
  'remoteAudio.singlePlayer.title': '再生はひとつだけ',
  'remoteAudio.singlePlayer.body':
    'はリンクしたコンピューターにも及びます。片方で再生を始めると、もう片方で再生中のものが一時停止します。',
  'remoteAudio.code.copy': 'コードをコピー',
  'remoteAudio.code.copied': 'コピー済み',
  'remoteAudio.code.forAddress': '{address} のペアリングコード',
  'remoteAudio.status.preparing': '準備中…',
  'remoteAudio.status.playbackBlocked':
    '音声を聴くには「音声を再開」を押してください',
  'remoteAudio.resume': '音声を再開',
  'remoteAudio.retry': '再試行',
  'remoteAudio.monitor.networkHealthy': 'ネットワーク良好',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms 待機中',
  'remoteAudio.note.title': '小さい音量から始めてください。',
  'remoteAudio.note.body':
    '2 台が同時に鳴ると音量が重なります。最初のリンクの前に音量を下げてください。',
  'remoteAudio.error.lan':
    'ローカル接続を開始できませんでした。両方のコンピューターが同じプライベートネットワークにあり、ファイアウォールで FluidEQ が許可されていることを確認してください。',
  'remoteAudio.error.capture':
    'このコンピューターのシステム音声をキャプチャできませんでした。現在の出力デバイスを確認して、もう一度お試しください。',
  'remoteAudio.error.playback':
    'ロスレス音声エンジンを開始できませんでした。FluidEQ を再起動して、もう一度お試しください。',
  'remoteAudio.error.connection':
    '暗号化された音声接続が途切れました。FluidEQ はもう一方のコンピューターを探し続け、戻ってきたら自動で再接続します。',
};

export default remoteAudio;
