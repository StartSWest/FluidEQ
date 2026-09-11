const engineHealth = {
  'engineHealth.offTitle': 'FluidEQ エンジンが {device} で動作していません',
  'engineHealth.offBody':
    'この出力では EQ なしで音が再生されています。Windows オーディオを再起動すると通常はエンジンが戻ります。その間も FluidEQ のほかの機能はそのまま使えます。',
  'engineHealth.partlyOff': '一部オフ',
  'engineHealth.problemsTitle': 'サウンドの一部が {device} に届いていません',
  'engineHealth.problem.convolution':
    'コンボリューションはオフです：エンジンがインパルス応答を読み込めませんでした。別のファイルを試してください。',
  'engineHealth.problem.graphic-eq':
    'グラフィック EQ はオフです：エンジンがカーブを作成できませんでした。',
  'engineHealth.problem.dsp-rack':
    'DSP エフェクトはオフです：エンジンが起動できませんでした。',
  'engineHealth.problem.reload-failed':
    '最後の変更を読み込めなかったため、その前の設定が再生され続けています。',
  'engineHealth.problem.unwatched':
    'この出力に対して行った変更がエンジンに伝わりません。',
  'engineHealth.problem.other':
    'エンジンに依頼したほかの処理が実行されていません。',
  'engineHealth.useApo': 'Equalizer APO を使う…',
} as const;

export default engineHealth;
