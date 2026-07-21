// 共有ルーム中継（Cloudflare Durable Object）
//
// Durable Object 1インスタンス = 1ルーム。発表者(presenter)1人が送り、参加者(follower)全員へ配る。
// 無料枠の勘所: WebSocketの「送出」は課金対象外・「受信」は20:1で計上される。
//   → 発表者→N人のブロードキャストは何人に増えても受信側課金が増えない構造。
//
// Hibernation API(ctx.acceptWebSocket)を使うため、アイドル時はインスタンスが眠り課金時間を消費しない。
// 眠ると this.* のメモリは失われる。したがって:
//   pose  = メモリ保持（毎秒12回来るので失っても次のフレームで復旧する）
//   state = ctx.storage 保持（系統の表示切替など、まれにしか変わらない＝失うと復旧できない）
export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.pose = null; // 揮発。hibernate で消えてよい
  }

  async fetch(req) {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const id = crypto.randomUUID().slice(0, 8);

    this.ctx.acceptWebSocket(server);
    // hibernate をまたいでも各接続のIDを保つ
    server.serializeAttachment({ id });

    const presenter = (await this.ctx.storage.get('presenter')) || null;
    const state = (await this.ctx.storage.get('state')) || null;

    // 途中参加者へ現況を即送る（遅れて入った学生が自動で追いつく）
    server.send(JSON.stringify({ k: 'hello', id, presenter }));
    if (state) server.send(JSON.stringify({ k: 'state', d: state }));
    if (this.pose) server.send(JSON.stringify({ k: 'pose', d: this.pose }));

    return new Response(null, { status: 101, webSocket: client });
  }

  idOf(ws) {
    const a = ws.deserializeAttachment();
    return a && a.id ? a.id : null;
  }

  broadcast(text, except) {
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === except) continue;
      try { peer.send(text); } catch { /* 切断済みは無視 */ }
    }
  }

  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const id = this.idOf(ws);

    if (m.k === 'ping') { try { ws.send('{"k":"pong"}'); } catch {} return; }

    if (m.k === 'claim') {
      await this.ctx.storage.put('presenter', id);
      this.broadcast(JSON.stringify({ k: 'role', presenter: id }));   // 宣言者自身にも届く
      return;
    }

    if (m.k === 'pose' || m.k === 'state') {
      const presenter = await this.ctx.storage.get('presenter');
      // 発表者未設定なら最初の送信者が暗黙に取得する。以後は発表者以外の送信を捨てる。
      if (!presenter) {
        await this.ctx.storage.put('presenter', id);
        this.broadcast(JSON.stringify({ k: 'role', presenter: id }));
      } else if (presenter !== id) {
        return;
      }
      if (m.k === 'pose') this.pose = m.d; else await this.ctx.storage.put('state', m.d);
      this.broadcast(raw, ws);
    }
  }

  async webSocketClose(ws) {
    const id = this.idOf(ws);
    const presenter = await this.ctx.storage.get('presenter');
    if (presenter && presenter === id) {
      // 発表者が抜けたら操作権を空にする（次に操作した人が引き継ぐ）
      await this.ctx.storage.delete('presenter');
      this.broadcast(JSON.stringify({ k: 'role', presenter: null }));
    }
    // サーバ側からも閉じてクローズ手順を完了させる。これを省くとクライアントは
    // CLOSING のまま止まり onclose が発火しない＝自動再接続が働かない。
    // HoloLens 2 はブラウザが頻繁に接続を切るので、ここが抜けると学生の端末が
    // 黙って追従を止めたまま復帰しなくなる。
    // ⚠️ 相手のコードをそのまま返さないこと。コード無しの切断は 1005、異常切断は 1006 で
    //    報告されるが、この2つは「送ってはいけない予約コード」なので close() が例外を投げ、
    //    catch に飲まれて再び手順が完了しなくなる。常に 1000 で閉じる。
    try { ws.close(1000, 'peer closed'); } catch {}
  }

  async webSocketError(ws) { try { ws.close(1011, 'error'); } catch {} }
}

export default {
  fetch(req, env) {
    const u = new URL(req.url);
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('anatomy-sync: WebSocketで /?room=<code> に接続してください', {
        status: 426, headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    const room = (u.searchParams.get('room') || 'default').slice(0, 32);
    const stub = env.ROOM.get(env.ROOM.idFromName(room));
    return stub.fetch(req);
  },
};
