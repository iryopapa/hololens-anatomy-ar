// 視点の共有表現（/atlas/ と /index.html の橋渡し）
//
// なぜ回転をそのまま送れないか:
//   /atlas/  は OrbitControls で「カメラが回る」（モデルは動かない）
//   /index.html(HL2) は両手ターンテーブルで「モデルが回る」（カメラ=頭は動かせない）
// この2つで意味が一致する唯一の量は「モデル自身の座標系から見て、観察者がどの方向にいるか」。
// それを単位ベクトル d（モデルローカル）と、見かけの大きさ z（距離÷モデル半径）で表す。
//
// 前提: 発表者のカメラの上方向はワールド上方向（OrbitControls既定）。
//       この前提のもとで d と z だけから画面の見え方（ロール込み）が一意に決まる。
//
// THREE を引数で受け取る＝importmap の設定に依存せずどのページからでも使える。

// /atlas/ の初期表示（HOME）における z。両ページでこの値を基準にすると初期の見かけが揃う。
export const HOME_ZOOM = 3.62;

export function makeViewSync(THREE) {
  const ORIGIN = new THREE.Vector3(0, 0, 0);
  const UP_Y = new THREE.Vector3(0, 1, 0);
  const UP_Z = new THREE.Vector3(0, 0, 1);
  const r4 = (n) => Math.round(n * 1e4) / 1e4;

  // 視点方向が上下軸とほぼ平行だと lookAt が退化するので、上ヒントを倒す
  const upHint = (v) => (Math.abs(v.y) > 0.999 ? UP_Z : UP_Y);

  // +Z が dir を向く基準系
  function basis(dir) {
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(ORIGIN, dir.clone().negate(), upHint(dir))
    );
  }

  return {
    HOME_ZOOM,

    /**
     * 現在の見え方を共有表現へ。発表者側で毎フレーム呼ぶ。
     * model        : GLBのルート（両ページとも同じGLBなのでローカル座標の意味が一致する）
     * centerWorld  : モデル中心のワールド座標
     * radiusWorld  : モデル半径のワールド長さ
     * camWorld     : カメラ（HL2では頭）のワールド座標
     */
    encode({ model, centerWorld, radiusWorld, camWorld }) {
      const dirWorld = camWorld.clone().sub(centerWorld);
      const dist = dirWorld.length() || 1e-6;
      dirWorld.divideScalar(dist);
      const inv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
      const dirLocal = dirWorld.applyQuaternion(inv);
      return { d: [r4(dirLocal.x), r4(dirLocal.y), r4(dirLocal.z)], z: r4(dist / radiusWorld) };
    },

    /**
     * OrbitControls側（/atlas/）へ適用。カメラを動かして同じ面を見る。
     * t = 0..1 の補間率（1で即座に一致、0.2程度で滑らかに追従）
     */
    applyOrbit({ camera, controls, model, centerWorld, radiusWorld }, pose, t) {
      const dirLocal = new THREE.Vector3().fromArray(pose.d).normalize();
      const q = model.getWorldQuaternion(new THREE.Quaternion());
      const dirWorld = dirLocal.applyQuaternion(q);
      const want = centerWorld.clone().addScaledVector(dirWorld, Math.max(1e-4, pose.z) * radiusWorld);
      camera.position.lerp(want, t);
      controls.target.lerp(centerWorld, t);
      camera.up.copy(UP_Y);
      controls.update();
    },

    /**
     * ターンテーブル側（HL2 /index.html）へ適用。カメラは動かせないのでモデルを回す。
     * 観察者の実際の方向 dirWorld に対し、モデルが pose.d の面を向けるような root 姿勢を作る。
     * 上方向のロールも lookAt 基準系の差として正しく再現される。
     */
    // applyScale=false のとき大きさは同期しない。カメラ透過ARでは実物大と置き場所は
    // 各自のものなので、向きだけ合わせる（HL2で位置を同期しないのと同じ考え方）。
    applyTurntable({ root, camWorld, applyScale = true }, pose, t) {
      const dirWorld = camWorld.clone().sub(root.position);
      if (dirWorld.lengthSq() < 1e-8) return;
      dirWorld.normalize();
      const dirLocal = new THREE.Vector3().fromArray(pose.d).normalize();
      // Q = B * A⁻¹  （A: モデル系→基準系, B: ワールド系→基準系）
      const want = basis(dirWorld).multiply(basis(dirLocal).invert());
      root.quaternion.slerp(want, t);
      if (!applyScale) return;
      const s = THREE.MathUtils.clamp(HOME_ZOOM / Math.max(1e-4, pose.z), 0.05, 8);
      root.scale.setScalar(THREE.MathUtils.lerp(root.scale.x, s, t));
    },

    // ポインタ（注目点）はGLBローカル座標で送る＝両ページでスケールも配置も違うが同じ点を指せる
    encodePoint(model, worldPoint) {
      const p = model.worldToLocal(worldPoint.clone());
      return [r4(p.x), r4(p.y), r4(p.z)];
    },
    decodePoint(model, arr) {
      return model.localToWorld(new THREE.Vector3().fromArray(arr));
    },
  };
}
