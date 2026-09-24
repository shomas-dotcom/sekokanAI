// ログインの連続失敗を数え、上限に達したら一定時間ログイン試行を拒否する(総当たり攻撃対策)。
// 運営者(PlatformAdmin)ログイン用。DBの列追加(移行)なしで入れられるよう、サーバーのメモリ上で数える。
// 制約: サーバー再起動で回数が消える・複数台構成では台ごとに数える。Render無料プランの1台構成では有効。
// 将来DBへ移す場合も、この関数の呼び出し側は変えずに済むようにしている。

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

type Entry = { failures: number; lockedUntil: number | null };

export function createLoginThrottle(max = MAX_FAILED_ATTEMPTS, lockMinutes = LOCK_MINUTES) {
  const entries = new Map<string, Entry>();

  return {
    /** ロック中ならtrue。ロック期限が過ぎていれば記録を消してfalse。 */
    isLocked(key: string, now = Date.now()): boolean {
      const entry = entries.get(key);
      if (!entry?.lockedUntil) return false;
      if (entry.lockedUntil > now) return true;
      entries.delete(key);
      return false;
    },
    recordFailure(key: string, now = Date.now()): void {
      const failures = (entries.get(key)?.failures ?? 0) + 1;
      entries.set(key, {
        failures,
        lockedUntil: failures >= max ? now + lockMinutes * 60 * 1000 : null,
      });
    },
    recordSuccess(key: string): void {
      entries.delete(key);
    },
  };
}

export const adminLoginThrottle = createLoginThrottle();
