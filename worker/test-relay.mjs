// 中継の受け入れテスト（ブラウザ不要・Node 22+ の組み込み WebSocket を使用）
//   使い方: npx wrangler dev --port 8787  を起動してから  node test-relay.mjs
// 教室の実際の順番＝「参加者が先に入室 → 先生が後から操作権を取る」を再現する。
const URL_BASE = process.env.SYNC_URL || 'ws://localhost:8787';
const room = 'NODETEST' + Math.floor(Math.random() * 1e6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(tag, seen) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${URL_BASE}/?room=${room}`);
    ws.onmessage = (e) => seen.push({ tag, msg: JSON.parse(e.data) });
    ws.onerror = () => rej(new Error(tag + ' connect error'));
    ws.onopen = () => res(ws);
  });
}

const seen = [];
let fail = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) fail++; };

// 参加者が先に入室
const follower = await connect('follower', seen);
await sleep(300);
const helloF = seen.find((s) => s.tag === 'follower' && s.msg.k === 'hello');
check('参加者が hello を受け取る', !!helloF, helloF ? `id=${helloF.msg.id} presenter=${helloF.msg.presenter}` : '');
check('最初は操作権が空', helloF && helloF.msg.presenter === null);

// 先生が後から入室して操作権を取る
const presenter = await connect('presenter', seen);
await sleep(300);
presenter.send(JSON.stringify({ k: 'claim' }));
await sleep(400);

const roleF = seen.find((s) => s.tag === 'follower' && s.msg.k === 'role');
check('先生の claim が参加者へ届く', !!roleF, roleF ? `presenter=${roleF.msg.presenter}` : '(届いていない)');

// 表示状態と視点を配る
presenter.send(JSON.stringify({ k: 'state', d: { hid: ['VH_F_skin'], sel: 'VH_F_liver' } }));
presenter.send(JSON.stringify({ k: 'pose', d: { d: [0, 0, -1], z: 2.6 } }));
await sleep(400);
const stF = seen.find((s) => s.tag === 'follower' && s.msg.k === 'state');
const poF = seen.find((s) => s.tag === 'follower' && s.msg.k === 'pose');
check('表示状態が参加者へ届く', !!stF, stF ? JSON.stringify(stF.msg.d) : '');
check('視点が参加者へ届く', !!poF, poF ? JSON.stringify(poF.msg.d) : '');
check('先生に自分の pose が返ってこない', !seen.some((s) => s.tag === 'presenter' && s.msg.k === 'pose'));

// 参加者が勝手に送っても無視される（誤操作が全体に漏れない）
follower.send(JSON.stringify({ k: 'pose', d: { d: [1, 0, 0], z: 9 } }));
await sleep(400);
check('参加者の送信は中継が捨てる',
  !seen.some((s) => s.tag === 'presenter' && s.msg.k === 'pose'));

// 途中参加者が現況を即受け取る
const late = await connect('late', seen);
await sleep(400);
const lateSt = seen.find((s) => s.tag === 'late' && s.msg.k === 'state');
const latePo = seen.find((s) => s.tag === 'late' && s.msg.k === 'pose');
const lateHello = seen.find((s) => s.tag === 'late' && s.msg.k === 'hello');
check('途中参加者が現在の操作権を知る', !!lateHello && lateHello.msg.presenter !== null);
check('途中参加者が現在の表示状態を受け取る', !!lateSt, lateSt ? JSON.stringify(lateSt.msg.d) : '');
check('途中参加者が現在の視点を受け取る', !!latePo, latePo ? JSON.stringify(latePo.msg.d) : '');

for (const w of [follower, presenter, late]) w.close();
console.log(fail ? `\n${fail} 件 失敗` : '\nすべて合格');
process.exit(fail ? 1 : 0);
