/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': '音声を共有',
  'remoteAudio.eyebrow': 'LAN オーディオリンク',
  'remoteAudio.title': 'ほかのコンピューターの音をここで聴く',
  'remoteAudio.subtitle':
    'このコンピューターの役割を 1 つ選びます。受信側はヘッドセットを接続した PC、ほかの PC は送信側として接続できます。',
  'remoteAudio.choose': 'このコンピューターの役割を選択',
  'remoteAudio.security': '接続の特性',
  'remoteAudio.badge.local': 'プライベート LAN のみ',
  'remoteAudio.badge.lossless': 'ロスレス Float32 PCM 伝送',
  'remoteAudio.badge.encrypted': 'AES-256-GCM 暗号化',
  'remoteAudio.listen.kicker': '受信側 · サーバー',
  'remoteAudio.listen.title': 'このコンピューターで音声を再生',
  'remoteAudio.listen.body':
    'ヘッドセットまたはスピーカーを接続したコンピューターで使います。1 台以上の送信側を受け入れ、FluidEQ で選択中の出力から再生します。',
  'remoteAudio.listen.start': '接続コードを作成',
  'remoteAudio.listen.activeTitle': 'このコンピューターで受信中',
  'remoteAudio.listen.newCode': '新しいコードを作成',
  'remoteAudio.listen.stop': '受信を停止',
  'remoteAudio.stream.title': 'ストリーム優先度',
  'remoteAudio.stream.lossless': 'どちらもロスレス PCM で送信',
  'remoteAudio.stream.video.title': 'ゲーム/動画',
  'remoteAudio.stream.video.body':
    '口の動きに合う最小遅延。混雑した Wi-Fi では途切れやすくなります。',
  'remoteAudio.stream.video.buffer': '開始時 約100 ms',
  'remoteAudio.stream.music.title': '音楽',
  'remoteAudio.stream.music.body':
    '途切れない再生を優先する大きな安全バッファー。',
  'remoteAudio.stream.music.buffer': '開始時 約240 ms',
  'remoteAudio.send.kicker': '送信側 · クライアント',
  'remoteAudio.send.title': 'このコンピューターの音声を送信',
  'remoteAudio.send.body':
    '聴きたい各コンピューターで実行します。ヘッドセット側に表示されたコードを貼り付けます。',
  'remoteAudio.send.codeLabel': '接続コード',
  'remoteAudio.send.codePlaceholder': 'FLUIDEQ-LAN-2… を貼り付け',
  'remoteAudio.send.start': '接続して送信',
  'remoteAudio.send.activeTitle': 'システム音声を送信中',
  'remoteAudio.send.activeBody':
    '両方のコンピューターで FluidEQ を開いたままにしてください。受信側では、このロスレス音声とほかの送信元の音声をまとめて再生します。',
  'remoteAudio.send.destination': '{name} で再生中',
  'remoteAudio.send.stop': '送信を停止',
  'remoteAudio.send.readyHint': '停止後も保存済みコードはここに残ります。',
  'remoteAudio.status.preparing': '準備中…',
  'remoteAudio.status.waiting': 'コンピューターを待機中',
  'remoteAudio.status.connecting': '接続中…',
  'remoteAudio.status.connectedOne': '{count} 台接続済み',
  'remoteAudio.status.connectedMany': '{count} 台接続済み',
  'remoteAudio.status.sending': 'ロスレス音声を送信中',
  'remoteAudio.status.playbackBlocked':
    '音声を聴くには「再開」を押してください',
  'remoteAudio.status.disconnected': '受信側が切断されました',
  'remoteAudio.monitor.title': 'ライブ接続',
  'remoteAudio.monitor.inactive': '開始する役割を選択してください',
  'remoteAudio.monitor.ready': '接続コードを入力できます',
  'remoteAudio.monitor.waveform': '共有音声のライブ波形',
  'remoteAudio.monitor.waveformFor': '{name} のライブ音声波形',
  'remoteAudio.monitor.buffer': '再生 {milliseconds} ms',
  'remoteAudio.monitor.sendQueue': '送信待ち {milliseconds} ms',
  'remoteAudio.monitor.noRole': '役割が選択されていません',
  'remoteAudio.monitor.noSources': '接続中の送信元コンピューターはありません',
  'remoteAudio.monitor.waitingSource': '送信元を待機中',
  'remoteAudio.monitor.outgoing': 'このコンピューターから送信する音声',
  'remoteAudio.monitor.transmitting': '送信中',
  'remoteAudio.monitor.receiving': '受信中',
  'remoteAudio.monitor.quiet': '無音',
  'remoteAudio.monitor.nowPlaying': '再生中',
  'remoteAudio.monitor.paused': '一時停止',
  'remoteAudio.monitor.peakLevel': 'ライブ音声のピークレベル',
  'remoteAudio.monitor.peak': 'ピーク {decibels} dB',
  'remoteAudio.monitor.networkUsage': 'LAN {megabits} Mb/s',
  'remoteAudio.monitor.networkHealthy': 'ネットワーク良好',
  'remoteAudio.monitor.networkQueued': '{milliseconds} ms 待機中',
  'remoteAudio.code.title': 'ほかのコンピューターをペアリング',
  'remoteAudio.code.hint':
    '各送信元にコードをコピーします。アプリを閉じたり PC を再起動したりしてもペアリングは保存されます。複数のアドレスがある場合は、両方のコンピューターが共有するネットワークを選んでください。',
  'remoteAudio.code.copy': 'コードをコピー',
  'remoteAudio.code.copied': 'コピー済み',
  'remoteAudio.code.forAddress': '{address} のペアリングコード',
  'remoteAudio.resume': '音声を再開',
  'remoteAudio.note.title': '小さい音量から始めてください。',
  'remoteAudio.note.body':
    '複数のコンピューターの音声がミックスされるため、音量が急に大きくなることがあります。最初の接続前にヘッドセットの音量を下げてください。保存済みのペアリングを切断するのは新しいコードを作成したときだけです。',
  'remoteAudio.error.lan':
    'ローカル接続を開始できませんでした。両方のコンピューターが同じプライベートネットワークにあり、ファイアウォールで FluidEQ が許可されていることを確認してください。',
  'remoteAudio.error.capture':
    'このコンピューターのシステム音声を取り込めませんでした。現在の出力デバイスを確認し、停止してからやり直してください。',
  'remoteAudio.error.playback':
    'ロスレス音声エンジンを開始できませんでした。FluidEQ を再起動して、もう一度お試しください。',
  'remoteAudio.error.connection':
    '暗号化された音声接続が停止しました。保存済みコードは下に残っています。受信側の準備後に再接続してください。',
};

export default remoteAudio;
