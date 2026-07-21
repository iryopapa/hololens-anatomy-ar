# anatomy-sync — 共有ルーム中継サーバ

複数のHoloLens 2 / iPad / PC で同じ解剖モデルを同時に見るための中継。
発表者(先生)1人の操作を、参加者(学生)全員へリアルタイムで配る。

Cloudflare Workers + Durable Objects。**無料枠内で動く**（送出=ブロードキャストは課金対象外、
受信は20:1で計上。45分授業×10台でも1日の無料枠の数%）。

## デプロイ手順

**① Cloudflare アカウントを作る（この作業だけは本人が行う）**
https://dash.cloudflare.com/sign-up — 無料プランでよい。クレジットカード登録は不要。

**② デプロイ**
```bash
cd worker
npx wrangler login      # ブラウザが開くので許可する
npx wrangler deploy
```
成功すると `https://anatomy-sync.<アカウント名>.workers.dev` が表示される。

**③ ビューアに中継先を教える**
`sync/config.js` の `SYNC_URL` を、上のURLの `https://` を `wss://` に変えたものにする。

```js
export const SYNC_URL = 'wss://anatomy-sync.<アカウント名>.workers.dev';
```

`git push` すれば GitHub Pages に反映され、`/atlas/` に「🔗 共有」ボタンが現れる。
（`SYNC_URL` が空のあいだは共有機能そのものが無効で、ビューアは従来どおり動く。）

## 使い方

1. 先生が iPad か PC で `/atlas/` を開き「🔗 共有」→ ルーム番号を決めて「参加」→「操作権を取る」
2. 学生の HoloLens 2 は、下のURLを焼いたQRを見つめて Open するだけ（打鍵ゼロ）
   `https://snm-edu.github.io/hololens-anatomy-ar/?room=<ルーム番号>&role=f`
3. 先生が回す・寄る・構造をタップすると、全員の目の前のモデルに同じ向き・同じ注目点が反映される

参加者は自分の目の前の「置き場所」だけ片手で自由に動かせる（回転と拡縮は先生に従う）。

⚠️ QRの生成条件: Type=Text/Raw Text・border≥4・前景 `#000000` / 背景 `#BBBCBF`・
QRバージョン1〜10・一辺5cm以上。ルーム番号を長くしすぎるとバージョン10を超えて
HoloLens が読めなくなるので注意。

## ローカルで動かす（Cloudflareアカウント不要）

```bash
cd worker && npx wrangler dev --port 8787     # Durable Object がローカルで動く
python3 -m http.server 8080                   # リポジトリのルートで
```
ブラウザで `http://127.0.0.1:8080/atlas/?sync=ws://localhost:8787&room=TEST&role=p`
（参加者側は `role=f`）。`?sync=` は `SYNC_URL` を一時的に上書きする検証用パラメータ。

## 設計メモ

- メッセージは**差分でなく全量スナップショット**。取りこぼしても次の1通で復旧し、
  途中参加者は中継が保持した最新スナップショットだけで追いつける。
- `pose`（視点・12Hz）はメモリ保持、`state`（系統の表示切替など・まれ）は
  `ctx.storage` 保持。Durable Object は待機中に hibernate してメモリを失うため。
- 操作権は中継側が1つだけ保持する（`claim` の last-write-wins）。発表者以外の
  `pose`/`state` は中継側で捨てるので、参加者の誤操作が全体に漏れることはない。
