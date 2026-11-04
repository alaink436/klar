"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Center, Environment, Lightformer, MeshTransmissionMaterial, Text3D } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Headlines as glass: "Klar / Studios." and "Consults & / Collaborations."
// (Alain, 2026-11-04: "glass, 3d, von links ein Licht", then "auch noch 3d").
// Inter Tight 500 like the headings, extruded and bevelled, in transmission
// glass. Light comes from a warm panel on the left, so the left bevels flare and
// the light runs through the letters; it drifts slowly so the glints move. The
// glass refracts a paper backdrop with a warm streak from the left, drawn here,
// because the canvas cannot see the page behind it. Every glyph used must be in
// the typeface file (AI-Brain Projects/Klar/Content/web-hero/glyphen.py).

const FONT = "/home/3d/intertight-500.json";
const LINE = 0.86; // line height in font units

function backdrop() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  // paper, darker towards the right where the light does not reach
  const shade = g.createLinearGradient(0, 0, 512, 0);
  shade.addColorStop(0, "#f4f2ee");
  shade.addColorStop(1, "#bdbcb8");
  g.fillStyle = shade;
  g.fillRect(0, 0, 512, 512);
  // the light falling in from the left, a warm band
  const beam = g.createLinearGradient(0, 120, 0, 400);
  beam.addColorStop(0, "rgba(255,238,210,0)");
  beam.addColorStop(0.5, "rgba(255,238,210,0.95)");
  beam.addColorStop(1, "rgba(255,238,210,0)");
  g.fillStyle = beam;
  g.fillRect(0, 120, 300, 280);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Word({ text, y, left, onSize }: { text: string; y: number; left: boolean; onSize: (w: number, h: number) => void }) {
  const bg = useMemo(() => backdrop(), []);
  return (
    // `right` puts the line's left edge on x = 0, so left-aligned lines start together
    <Center right={left} position={[0, y, 0]} onCentered={({ width, height }) => onSize(width, height)}>
      <Text3D
        font={FONT}
        size={1}
        height={0.22}
        letterSpacing={-0.015}
        curveSegments={12}
        bevelEnabled
        bevelSize={0.03}
        bevelThickness={0.045}
        bevelSegments={6}
      >
        {text}
        <MeshTransmissionMaterial
          background={bg}
          backside
          backsideThickness={0.25}
          samples={6}
          resolution={768}
          thickness={0.6}
          roughness={0.02}
          ior={1.5}
          chromaticAberration={0.09}
          anisotropicBlur={0.02}
          distortion={0.04}
          distortionScale={0.3}
          temporalDistortion={0}
          clearcoat={1}
          clearcoatRoughness={0.02}
          color="#ffffff"
          attenuationColor="#f3ece2"
          attenuationDistance={2.4}
        />
      </Text3D>
    </Center>
  );
}

function Title({ lines, left, onReady }: { lines: string[]; left: boolean; onReady: () => void }) {
  const group = useRef<THREE.Group>(null);
  const block = useRef<THREE.Group>(null);
  // the lines' sizes in font units, kept out of React state (measuring re-renders)
  const sizes = useRef(lines.map(() => ({ w: 4, h: 0.8 })));
  useEffect(onReady, [onReady]);

  useFrame(({ pointer, clock, viewport }) => {
    const g = group.current;
    if (!g || !block.current) return;
    const w = Math.max(...sizes.current.map((s) => s.w));
    const h = LINE * (lines.length - 1) + Math.max(...sizes.current.map((s) => s.h));
    // centred: room around for the tilt; left-aligned: as wide as the column, which
    // is the canvas minus the 6 % it reaches out on each side (GlassTitle)
    const fill = left ? 0.86 : 0.8;
    g.scale.setScalar(Math.min((viewport.width * fill) / w, (viewport.height * fill) / h));
    block.current.position.x = left ? -w / 2 : 0;
    const t = clock.elapsedTime;
    // turned a little towards the light, so the lit left sides of the letters show
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, 0.1 + pointer.x * 0.06 + Math.sin(t * 0.3) * 0.04, 3, 1 / 60);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -0.06 - pointer.y * 0.05, 3, 1 / 60);
  });

  return (
    <group ref={group}>
      <group ref={block}>
        {lines.map((text, i) => (
          <Word
            key={text}
            text={text}
            left={left}
            y={((lines.length - 1) / 2 - i) * LINE}
            onSize={(w, h) => (sizes.current[i] = { w, h })}
          />
        ))}
      </group>
    </group>
  );
}

function Light() {
  const key = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (key.current) key.current.position.y = Math.sin(clock.elapsedTime * 0.35) * 2.5;
  });
  return (
    <Environment resolution={256} frames={Infinity}>
      {/* a dark room, so the glass edges read; all light comes from the panels */}
      <color attach="background" args={["#5c5c5e"]} />
      <Lightformer ref={key} form="rect" intensity={9} color="#fff0d8" position={[-9, 0, 3]} rotation-y={Math.PI / 2.4} scale={[3, 12, 1]} />
      <Lightformer form="rect" intensity={2} position={[0, 7, 2]} rotation-x={Math.PI / 2} scale={[14, 2, 1]} />
      <Lightformer form="rect" intensity={0.6} position={[9, 0, -2]} rotation-y={-Math.PI / 2} scale={[2, 10, 1]} />
    </Environment>
  );
}

export default function GlassTitleScene({ lines, left, onReady, run }: { lines: string[]; left: boolean; onReady: () => void; run: boolean }) {
  return (
    // flat: no tone mapping, so the paper seen through the glass stays paper white
    <Canvas
      flat
      frameloop={run ? "always" : "never"}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 10], fov: 22 }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <Light />
        <Title lines={lines} left={left} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
