// 共有ルームの中継先。Cloudflare Worker をデプロイしたら、ここのURLを差し替える。
//
// 空文字のあいだ同期機能は完全に無効（既存のビューアは何も変わらず動く）。
// URLに ?sync=ws://localhost:8787 を付けると一時的に上書きできる（ローカル検証用）。
// 中継サーバ（Cloudflare Workers）。worker/ を wrangler deploy して発行する。
//
// ⚠️ 暫定措置（2026-07-21）:
//   本来の宛先は学校アカウント(info@snm.ac.jp)の wss://anatomy-sync.snm-edu.workers.dev。
//   デプロイは成功し本番20項目も合格したが、その直後にサブドメイン名がDNSから消えた。
//   改名(long-wood-63b5 → snm-edu)の反映が途中で止まっているとみられ、旧名も新名も引けない。
//   Cloudflare側の処理待ちのため、当面は個人アカウント側の同一コードの中継に向けている。
//   学校アカウントの名前が公開されたら、下記を snm-edu 側へ戻すこと（この1行だけ）。
export const SYNC_URL = 'wss://anatomy-sync.iryopapa-jp.workers.dev';

// 上書き込みの解決とルーム設定の読み取りを1か所に集約する。
export function readRoomParams() {
  const q = new URLSearchParams(location.search);
  const url = q.get('sync') || SYNC_URL;
  const room = (q.get('room') || '').trim();
  const roleParam = (q.get('role') || '').trim().toLowerCase();
  const role = roleParam.startsWith('p') ? 'presenter' : roleParam.startsWith('f') ? 'follower' : '';
  return { url, room, role, enabled: !!url };
}
