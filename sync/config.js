// 共有ルームの中継先。Cloudflare Worker をデプロイしたら、ここのURLを差し替える。
//
// 空文字のあいだ同期機能は完全に無効（既存のビューアは何も変わらず動く）。
// URLに ?sync=ws://localhost:8787 を付けると一時的に上書きできる（ローカル検証用）。
export const SYNC_URL = '';

// 上書き込みの解決とルーム設定の読み取りを1か所に集約する。
export function readRoomParams() {
  const q = new URLSearchParams(location.search);
  const url = q.get('sync') || SYNC_URL;
  const room = (q.get('room') || '').trim();
  const roleParam = (q.get('role') || '').trim().toLowerCase();
  const role = roleParam.startsWith('p') ? 'presenter' : roleParam.startsWith('f') ? 'follower' : '';
  return { url, room, role, enabled: !!url };
}
