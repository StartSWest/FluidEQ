/* FluidEQ — GPL-3.0-or-later */
import { Dictionary } from '../en';

const remoteAudio: Partial<Dictionary> = {
  'tabs.share': '共有',
  'remoteAudio.eyebrow': 'LAN オーディオリンク',
  'remoteAudio.title': 'ほかのコンピューターの音をここで聴く',
  'remoteAudio.subtitle':
    'ヘッドセットを接続したコンピューターを受信側にします。同じローカルネットワーク上の複数の FluidEQ コンピューターが参加し、システム音声をここへ送信できます。',
  'remoteAudio.security': '接続の特性',
  'remoteAudio.badge.local': 'ローカルネットワークのみ',
  'remoteAudio.badge.lossless': 'ロスレス 32 ビット PCM',
  'remoteAudio.badge.encrypted': 'AES-256 暗号化',
  'remoteAudio.listen.kicker': 'コンピューター B · ヘッドセット',
  'remoteAudio.listen.title': 'このコンピューターで音声を再生',
  'remoteAudio.listen.body':
    'ここに接続したヘッドセットまたはスピーカーを選び、聴きたい各コンピューターにペアリングコードを共有します。',
  'remoteAudio.listen.start': '受信を開始',
  'remoteAudio.listen.activeTitle': 'このコンピューターで受信中',
  'remoteAudio.listen.stop': '受信を停止',
  'remoteAudio.send.kicker': 'コンピューター A · 送信元',
  'remoteAudio.send.title': 'このコンピューターの音声を送信',
  'remoteAudio.send.body':
    'ヘッドセット側のコンピューターのコードを貼り付けます。FluidEQ はシステムのループバック音声を圧縮せずに送信します。',
  'remoteAudio.send.codeLabel':
    'ヘッドセット側コンピューターのペアリングコード',
  'remoteAudio.send.codePlaceholder': 'FLUIDEQ-LAN-1… を貼り付け',
  'remoteAudio.send.start': '送信を開始',
  'remoteAudio.send.activeTitle': 'システム音声を送信中',
  'remoteAudio.send.activeBody':
    '両方のコンピューターで FluidEQ を開いたままにしてください。受信側では、このロスレス音声とほかの送信元の音声をまとめて再生します。',
  'remoteAudio.send.stop': '送信を停止',
  'remoteAudio.output.label': '再生先',
  'remoteAudio.output.default': '既定のオーディオ出力',
  'remoteAudio.output.unnamed': 'オーディオ出力 {number}',
  'remoteAudio.status.preparing': '準備中…',
  'remoteAudio.status.waiting': 'コンピューターを待機中',
  'remoteAudio.status.connecting': '接続中…',
  'remoteAudio.status.connectedOne': '{count} 台接続済み',
  'remoteAudio.status.connectedMany': '{count} 台接続済み',
  'remoteAudio.status.sending': 'ロスレス音声を送信中',
  'remoteAudio.status.playbackBlocked':
    '音声を聴くには「再開」を押してください',
  'remoteAudio.status.disconnected': '受信側が切断されました',
  'remoteAudio.code.title': 'ほかのコンピューターをペアリング',
  'remoteAudio.code.hint':
    '各送信元にコードをコピーします。受信側が動作している間は、同じコードで複数のコンピューターを接続できます。複数のアドレスがある場合は、両方のコンピューターが共有するネットワークを選んでください。',
  'remoteAudio.code.copy': 'コードをコピー',
  'remoteAudio.code.copied': 'コピー済み',
  'remoteAudio.code.forAddress': '{address} のペアリングコード',
  'remoteAudio.resume': '音声を再開',
  'remoteAudio.note.title': '小さい音量から始めてください。',
  'remoteAudio.note.body':
    '複数のコンピューターの音声がミックスされるため、音量が急に大きくなることがあります。最初の接続前にヘッドセットの音量を下げてください。受信を停止するとコードはすぐに無効になります。',
  'remoteAudio.error.lan':
    'ローカル接続を開始できませんでした。両方のコンピューターが同じプライベートネットワークにあり、ファイアウォールで FluidEQ が許可されていることを確認してください。',
  'remoteAudio.error.capture':
    'このコンピューターのシステム音声を取り込めませんでした。現在の出力デバイスを確認し、停止してからやり直してください。',
  'remoteAudio.error.connection':
    '暗号化された音声接続が停止しました。このセッションを停止し、最新のコードで再接続してください。',
};

export default remoteAudio;
