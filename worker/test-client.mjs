// sync/room.js（実際にビューアが読み込むクライアント）の受け入れテスト。
//   使い方: npx wrangler dev --port 8787 を起動してから  node test-client.mjs
// HoloLens 2 のブラウザは接続を頻繁に切るので、切断からの自動復帰までを確認する。
import { createRoom } from '../sync/room.js';

const URL_BASE = process.env.SYNC_URL || 'ws://localhost:8787';
const room = 'CLIENTTEST' + Math.floor(Math.random() * 1e6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 強制切断を起こすため、生成された WebSocket を捕まえておく
const sockets = [];
const RealWS = globalThis.WebSocket;
globalThis.WebSocket = class extends RealWS {
  constructor(...a) { super(...a); sockets.push(this); }
};

let fail = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) fail++; };

const fPoses = [], fStates = [], fStatus = [];
let fIsPresenter = null;

// 参加者が先に入室（教室の実際の順番）
const follower = createRoom({
  url: URL_BASE, room,
  onStatus: (s) => fStatus.push(s),
  onRole: (isP) => { fIsPresenter = isP; },
  onPose: (d) => fPoses.push(d),
  onState: (d) => fStates.push(d),
});
await sleep(600);
check('参加者が接続する', follower.isConnected());
check('参加者は発表者ではない', fIsPresenter === false);

// 先生が入室して操作権を取る
const presenter = createRoom({ url: URL_BASE, room, onStatus: () => {}, onRole: () => {}, onPose: () => {}, onState: () => {} });
await sleep(600);
presenter.claim();
await sleep(500);
check('先生が操作権を得る', presenter.isPresenter());
check('参加者が「自分は発表者でない」と認識し続ける', fIsPresenter === false);

// 先生が視点と表示状態を配る
presenter.sendState({ hid: ['VH_F_skin'], sel: 'VH_F_bare_area_of_liver' });
presenter.sendPose({ d: [0.7, 0.3, 0.65], z: 2.2 });
await sleep(500);
check('参加者が表示状態を受け取る', fStates.length > 0, JSON.stringify(fStates.at(-1)));
check('参加者が視点を受け取る', fPoses.length > 0, JSON.stringify(fPoses.at(-1)));

// 参加者が送っても他へ漏れない（誤操作対策）
const before = fPoses.length;
follower.sendPose({ d: [1, 0, 0], z: 9 });
await sleep(400);
check('参加者の送信は中継が捨てる', fPoses.length === before);

// ここが本題: 参加者の接続が切れても自動で復帰し、現況に追いつくか
const stateCountBefore = fStates.length;
sockets[0].close();                                                         // 参加者の socket を強制切断
await sleep(800);
check('切断を検知する', fStatus.includes('closed'));
await sleep(2500);                                                          // バックオフで再接続
check('自動で再接続する', follower.isConnected(), '状態遷移: ' + fStatus.join(' → '));
check('再接続後に現在の表示状態へ追いつく', fStates.length > stateCountBefore,
  JSON.stringify(fStates.at(-1)));

follower.close(); presenter.close();
console.log(fail ? `\n${fail} 件 失敗` : '\nすべて合格');
process.exit(fail ? 1 : 0);
