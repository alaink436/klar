"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { APPLE_PATH, PLAY_PATH } from "../StoreBadges";
import type { StageApp } from "./PhoneStage";

// The cinematic shot under the headline (Alain, 2026-11-04: "wie bei Basalt auf
// der Pre-Paywall von den Shortcuts"): the real iPhone model from that scene
// (Pod/Content/oberflaeche/proto/model/iphone.glb), big, tilted back, in front
// of the same sea of clouds (a still behind the transparent canvas, see
// PhoneStage). One phone per app, its screen the scene from the app's store
// film with the app's card on top (Alain, 2026-11-04: "das Logo drauf"). When
// the pill above names the next app, the phone turns away to the left or right
// and the next one turns in, each time in a new pose from POSES.

const PHONE = "/home/3d/iphone.glb";
const SCALE = 2.05;
const TURN = 1.3; // seconds for one change

// Model space: the phone lies flat, screen up (+y), long side along z.
const BODY = { w: 0.6115, h: 1.27, top: 0.0484 };
const SCREEN = { w: BODY.w * 0.915, h: BODY.h * 0.955, r: 0.075 };

// Tilted back (negative x), turned and rolled a little, never twice in a row the same.
const POSES: { p: [number, number, number]; r: [number, number, number] }[] = [
  { p: [0.4, 0.05, 0], r: [-0.68, -0.34, -0.12] },
  { p: [-0.38, 0.08, 0], r: [-0.6, 0.36, 0.12] },
  { p: [0.22, 0.02, 0.2], r: [-0.74, -0.2, 0.07] },
  { p: [-0.26, 0.06, 0.1], r: [-0.56, 0.28, -0.09] },
  { p: [0.42, 0.1, -0.1], r: [-0.64, -0.44, 0.14] },
  { p: [-0.16, 0.04, 0.15], r: [-0.7, 0.2, -0.13] },
];

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 12);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  return g;
}

// The screen: the scene with a dark glass card in its upper part, as the small
// phones had it (HeroPhones, until 2026-11-04), only larger: icon, name, where
// the app is out. Sizes in % of the screen width (u), like the cqw there.
function screenTexture(scene: HTMLImageElement, icon: HTMLImageElement, app: StageApp, font: string) {
  const c = document.createElement("canvas");
  c.width = 750;
  c.height = Math.round((c.width * scene.height) / scene.width);
  const g = c.getContext("2d")!;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; // tilted back, the card would blur without it
  const u = c.width / 100;

  const draw = () => {
    g.drawImage(scene, 0, 0, c.width, c.height);
    const x = 6 * u, y = 22 * u, w = 88 * u, h = (app.forSale ? 30 : 25) * u;
    g.save();
    g.beginPath();
    g.roundRect(x, y, w, h, 7 * u);
    g.clip();
    g.filter = "blur(14px)";
    g.drawImage(scene, 0, 0, c.width, c.height);
    g.filter = "none";
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(x, y, w, h);
    g.restore();

    const s = 17 * u, ix = x + 3 * u, iy = y + (h - s) / 2;
    g.save();
    g.beginPath();
    g.roundRect(ix, iy, s, s, s * 0.225);
    g.clip();
    g.drawImage(icon, ix, iy, s, s);
    g.restore();

    let tx = ix + s + 3.5 * u, ty = y + h / 2 - (app.forSale ? 9.2 : 6) * u;
    g.textBaseline = "top";
    g.fillStyle = "#fff";
    g.font = `600 ${8 * u}px ${font}`;
    g.fillText(app.name, tx, ty);
    ty += 10 * u;
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.font = `500 ${4.5 * u}px ${font}`;
    const glyph = (d: string, vw: number) => {
      const k = (4.5 * u) / 26;
      g.save();
      g.translate(tx, ty - 0.4 * u);
      g.scale(k, k);
      g.fill(new Path2D(d));
      g.restore();
      tx += vw * k + 1.6 * u;
    };
    const word = (text: string) => {
      g.fillText(text, tx, ty);
      tx += g.measureText(text).width + 1.6 * u;
    };
    if (app.soon) word("Coming soon");
    else {
      glyph(APPLE_PATH, 22);
      word("App Store");
      if (app.play) {
        word("·");
        glyph(PLAY_PATH, 22);
        word("Google Play");
      }
    }
    if (app.forSale) g.fillText("Available to be bought", ix + s + 3.5 * u, ty + 7 * u);
    t.needsUpdate = true;
  };
  draw();
  // the page font may still be on its way; draw again once it is there
  document.fonts.load(`600 ${8 * u}px ${font}`).then(draw);
  return t;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function Phone({ scene: src, screen, phone }: { scene: THREE.Object3D; screen: THREE.Texture; phone: React.Ref<THREE.Group> }) {
  const body = useMemo(() => src.clone(), [src]);
  const glass = useMemo(() => roundedRect(SCREEN.w, SCREEN.h, SCREEN.r), []);
  const island = useMemo(() => roundedRect(SCREEN.w * 0.3, SCREEN.h * 0.034, SCREEN.h * 0.017), []);
  return (
    <group ref={phone} visible={false}>
      <group rotation-x={Math.PI / 2} scale={SCALE}>
        <primitive object={body} />
        <group position-y={BODY.top + 0.0006} rotation-x={-Math.PI / 2}>
          <mesh geometry={glass}>
            {/* a faint reflection only: tilted back, a full one washes dark screens grey */}
            <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={screen} roughness={0.15} envMapIntensity={0.25} />
          </mesh>
          <mesh geometry={island} position={[0, SCREEN.h / 2 - SCREEN.h * 0.035, 0.0004]}>
            <meshPhysicalMaterial color="#000" roughness={0.25} clearcoat={1} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Phones({ apps, active, onReady }: { apps: StageApp[]; active: number; onReady: () => void }) {
  const { scene } = useGLTF(PHONE);
  const scenes = useTexture(apps.map((a) => `/home/scenes/${a.id}.webp`));
  const icons = useTexture(apps.map((a) => a.icon));
  const gl = useThree((st) => st.gl);
  const screens = useMemo(() => {
    const font = getComputedStyle(gl.domElement).fontFamily; // the page's own type
    return apps.map((a, i) => screenTexture(scenes[i].image as HTMLImageElement, icons[i].image as HTMLImageElement, a, font));
  }, [apps, scenes, icons, gl]);
  // all screens to the GPU now, not each one as its phone first turns in
  useEffect(() => screens.forEach((t) => gl.initTexture(t)), [screens, gl]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const rig = useRef<THREE.Group>(null);
  // t0 = -1: the first phone turns in as soon as the scene has its first frame
  const s = useRef({ cur: active, prev: -1, t0: -1, dir: 1, pose: new Map<number, number>([[active, 0]]), n: 0 });

  useEffect(onReady, [onReady]);

  useEffect(() => {
    const st = s.current;
    if (active === st.cur) return;
    st.prev = st.cur;
    st.cur = active;
    st.t0 = -1; // set on the next frame, from the clock
    st.dir = Math.random() < 0.5 ? -1 : 1;
    st.n += 1;
    st.pose.set(active, st.n % POSES.length);
  }, [active]);

  useFrame(({ clock, pointer, viewport }) => {
    const st = s.current;
    const now = clock.elapsedTime;
    if (st.t0 === -1) st.t0 = now;
    const k = ease(Math.min(1, (now - st.t0) / TURN));

    refs.current.forEach((g, i) => {
      if (!g) return;
      const leaving = i === st.prev && k < 1;
      g.visible = i === st.cur || leaving;
      if (!g.visible) return;
      const pose = POSES[st.pose.get(i) ?? 0];
      // in: from the far side, turned away; out: to the near side, turning on
      const off = i === st.cur ? 1 - k : leaving ? -k : 0;
      const side = st.dir * (i === st.cur ? -1 : 1) * Math.abs(off);
      const bob = Math.sin(now * 0.7 + i) * 0.035;
      g.position.set(pose.p[0] + side * 4, pose.p[1] + bob, pose.p[2] - Math.abs(off) * 1.2);
      g.rotation.set(pose.r[0], pose.r[1] + side * 1.5 + Math.sin(now * 0.4 + i) * 0.04, pose.r[2]);
    });

    if (rig.current) {
      // poses are set for a wide frame; on a narrow one (phones) everything shrinks with it
      rig.current.scale.setScalar(Math.min(1, viewport.aspect / 1.15));
      rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, pointer.x * 0.12, 3, 1 / 60);
      rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, -pointer.y * 0.06, 3, 1 / 60);
    }
  });

  return (
    <group ref={rig}>
      {apps.map((a, i) => (
        <Phone key={a.id} scene={scene} screen={screens[i]} phone={(g) => { refs.current[i] = g; }} />
      ))}
    </group>
  );
}

function Light() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={["#9b9893"]} />
      <Lightformer form="rect" intensity={5} color="#ffeccc" position={[-6, 1, 3]} rotation-y={Math.PI / 2.6} scale={[4, 10, 1]} />
      <Lightformer form="rect" intensity={2} position={[0, 6, 2]} rotation-x={Math.PI / 2} scale={[10, 3, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#e8eef8" position={[6, 0, -1]} rotation-y={-Math.PI / 2} scale={[3, 8, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[0, -5, 1]} rotation-x={-Math.PI / 2} scale={[10, 4, 1]} />
    </Environment>
  );
}

export default function PhoneStageScene({ apps, active, onReady, run }: { apps: StageApp[]; active: number; onReady: () => void; run: boolean }) {
  return (
    <Canvas
      // off screen: no frames, but the first one is drawn at load (see GlassTitleScene)
      frameloop={run ? "always" : "demand"}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 5.2], fov: 30 }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <Light />
        <Phones apps={apps} active={active} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(PHONE);
