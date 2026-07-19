# HoloLens 2 解剖 AR ビューア（女性・全臓器）

Mac 不要・トンネル不要で HoloLens 2（や WebXR 対応ヘッドセット）から開ける、静的な immersive-AR 解剖ビューアです。GitHub Pages 上でホストされ、端末の Wi-Fi だけで動作します。

## 使い方
1. HoloLens 2 の Edge で本ページ（GitHub Pages URL）を開く
2. モデル読込後、**ENTER AR** を押す
3. 片手でつまむ＝移動／回転、両手でつまむ＝拡大縮小

## 技術
- Three.js（r160・CDN）＋ GLTFLoader ＋ DRACOLoader
- `immersive-ar`（`local` 参照空間・任意で `hand-tracking`）
- HoloLens 2 では `antialias:false` ＋ `clearColor α=0` が必須（Babylon.js は HL2 でハングするため不採用）

## ページ
- `/` — 全身の解剖ビューア（女性・臓器・血管など）
- `/eye/` — **視能訓練士学科用**の眼球・視神経・外眼筋モジュール（眼球内部＋視覚路〔視神経→視交叉→視索→視放線〕＋外眼筋6本×左右）

## モデル出典・ライセンス
- **VH_Female（女性・全臓器）**: HuBMAP / Human Reference Atlas (HRA) Visible Human — **CC BY 4.0**
- 皮膚・筋肉は非表示、内臓（臓器）モデルを表示

再配布・改変は各ライセンス条件（表示 = Attribution）に従います。
