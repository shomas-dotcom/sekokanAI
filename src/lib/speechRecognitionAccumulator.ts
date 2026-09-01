// ブラウザのWeb Speech API(SpeechRecognition)のonresultイベントは、同じ認識
// セッション内では「これまでに確定した分も含めた累積結果」を毎回渡してくる。
// そのため、確定するたびに前回までの内容も含めて丸ごと追記すると、確定するたびに
// 同じ内容が重複して増えていく不具合になる(VoiceInputButtonで実際に発生した
// 「音声入力が重複して5行になる」バグの原因)。
//
// このモジュールは「今回のイベントで新しく確定した分だけ」を取り出す処理を、
// DOM/ブラウザAPIに依存しない純粋関数として切り出したもの(ユニットテストのため)。

export type SpeechRecognitionResultLike = {
  isFinal: boolean;
  transcript: string;
};

export type AccumulateResult = {
  /** このイベントで新しく確定した(まだ取り込んでいなかった)テキスト */
  newFinalText: string;
  /** まだ確定していない、認識中の暫定テキスト */
  interimText: string;
  /** このイベント時点でのresults配列中の確定件数(次回呼び出し時にalreadyCommittedCountとして渡す) */
  finalCount: number;
};

/**
 * @param results 現在の認識セッションでこれまでに得られている全結果(累積配列)
 * @param alreadyCommittedCount 前回までにnewFinalTextとして取り込み済みの確定件数
 */
export function accumulateSpeechResults(
  results: SpeechRecognitionResultLike[],
  alreadyCommittedCount: number
): AccumulateResult {
  let newFinalText = "";
  let interimText = "";
  let finalCount = 0;

  for (const result of results) {
    if (result.isFinal) {
      finalCount++;
      if (finalCount > alreadyCommittedCount) {
        newFinalText += result.transcript;
      }
    } else {
      interimText += result.transcript;
    }
  }

  return { newFinalText, interimText, finalCount };
}
