import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, PresentationControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { playCoinClink } from "../lib/sound";

export const JAR_CAPACITY = 100;

const JAR_HEIGHT = 2.6;
const COIN_RADIUS = 0.3;
const COIN_THICKNESS = 0.13;
const COINS_PER_LAYER = 8;

const clay = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });

/** Deterministic pseudo-random generator so coin piles look stable. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function coinTransform(indexInJar: number) {
  const rand = mulberry32(indexInJar * 7919 + 13);
  const layer = Math.floor(indexInJar / COINS_PER_LAYER);
  const maxR = 0.78;
  const angle = rand() * Math.PI * 2;
  const radius = Math.sqrt(rand()) * maxR;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = 0.3 + layer * (COIN_THICKNESS + 0.05) + rand() * 0.03;
  const tiltX = (rand() - 0.5) * 0.5;
  const tiltZ = (rand() - 0.5) * 0.5;
  const rotY = rand() * Math.PI;
  return {
    position: [x, y, z] as [number, number, number],
    rotation: [tiltX, rotY, tiltZ] as [number, number, number],
  };
}

const coinGeometry = new THREE.CylinderGeometry(COIN_RADIUS, COIN_RADIUS, COIN_THICKNESS, 22);
const coinMaterial = new THREE.MeshStandardMaterial({
  color: "#ffce4f",
  roughness: 0.5,
  metalness: 0.1,
});

interface CoinProps {
  indexInJar: number;
  falling: boolean;
  onLand?: () => void;
}

function Coin({ indexInJar, falling, onLand }: CoinProps) {
  const ref = useRef<THREE.Mesh>(null);
  const { position, rotation } = useMemo(() => coinTransform(indexInJar), [indexInJar]);
  const state = useRef({
    y: falling ? JAR_HEIGHT + 2.0 : position[1],
    v: 0,
    spin: falling ? 5 + Math.random() * 3 : 0,
    bounces: 0,
    done: !falling,
  });

  useFrame((_, delta) => {
    if (!ref.current || state.current.done) return;
    const s = state.current;
    s.v += 15 * delta;
    s.y -= s.v * delta;
    ref.current.rotation.z += s.spin * delta;
    if (s.y <= position[1]) {
      s.bounces++;
      playCoinClink();
      onLand?.();
      if (s.v > 2.4 && s.bounces < 3) {
        s.y = position[1];
        s.v = -s.v * 0.3;
      } else {
        s.y = position[1];
        s.done = true;
        ref.current.rotation.set(...rotation);
      }
    }
    ref.current.position.y = s.y;
  });

  return (
    <mesh
      ref={ref}
      geometry={coinGeometry}
      material={coinMaterial}
      position={[position[0], state.current.done ? position[1] : state.current.y, position[2]]}
      rotation={rotation}
      castShadow
    />
  );
}

interface JarBellyProps {
  wobbleRef: React.MutableRefObject<number>;
  children: React.ReactNode;
}

/** Chubby lathe jar with a kawaii face; squash-stretches when wobbled. */
function JarBelly({ wobbleRef, children }: JarBellyProps) {
  const group = useRef<THREE.Group>(null);
  const jarPts = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i++) {
      const v = i / 18;
      const r = 1.05 + Math.sin(v * Math.PI) * 0.42 - v * 0.1;
      pts.push(new THREE.Vector2(r, v * JAR_HEIGHT));
    }
    return pts;
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    if (wobbleRef.current > 0) {
      wobbleRef.current = Math.max(0, wobbleRef.current - delta * 1.6);
      const w = Math.sin(wobbleRef.current * Math.PI * 4) * wobbleRef.current * 0.14;
      group.current.scale.set(1 + w, 1 - w, 1 + w);
    } else {
      const breathe = Math.sin(t * 1.6) * 0.014;
      group.current.scale.set(1 + breathe, 1 - breathe, 1 + breathe);
    }
  });

  const faceMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#46364a" }), []);
  const blushMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffb3a0" }), []);

  return (
    <group ref={group}>
      <mesh castShadow>
        <latheGeometry args={[jarPts, 40]} />
        <meshPhysicalMaterial
          color="#cfeaff"
          transparent
          opacity={0.42}
          roughness={0.35}
          clearcoat={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* peach clay lip */}
      <mesh position={[0, JAR_HEIGHT + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.98, 0.15, 14, 36]} />
        <meshStandardMaterial color="#ff9a76" roughness={0.85} />
      </mesh>
      {/* kawaii face */}
      <mesh position={[-0.38, 1.55, 1.32]} material={faceMat}>
        <sphereGeometry args={[0.085, 12, 12]} />
      </mesh>
      <mesh position={[0.38, 1.55, 1.32]} material={faceMat}>
        <sphereGeometry args={[0.085, 12, 12]} />
      </mesh>
      <mesh position={[0, 1.33, 1.36]} rotation={[0, 0, Math.PI]} material={faceMat}>
        <torusGeometry args={[0.15, 0.04, 8, 16, Math.PI]} />
      </mesh>
      <mesh position={[-0.64, 1.34, 1.24]} rotation={[0, -0.45, 0]} material={blushMat}>
        <circleGeometry args={[0.1, 12]} />
      </mesh>
      <mesh position={[0.64, 1.34, 1.24]} rotation={[0, 0.45, 0]} material={blushMat}>
        <circleGeometry args={[0.1, 12]} />
      </mesh>
      {children}
    </group>
  );
}

/** Soft clay cloud drifting across the sky. */
function Cloud({ start, y, z, scale, speed }: { start: number; y: number; z: number; scale: number; speed: number }) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => clay("#ffffff"), []);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.x += speed * delta;
    if (group.current.position.x > 9) group.current.position.x = -9;
  });
  return (
    <group ref={group} position={[start, y, z]} scale={scale}>
      {[[0, 0, 0, 0.7], [0.6, 0.12, 0, 0.5], [-0.6, 0.06, 0, 0.5], [0.15, 0.32, 0, 0.42]].map(
        ([x, cy, cz, r], i) => (
          <mesh key={i} position={[x, cy, cz]} material={mat}>
            <sphereGeometry args={[r, 18, 14]} />
          </mesh>
        )
      )}
    </group>
  );
}

/** Island float + idle sway. */
function IslandRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = -1.9 + Math.sin(t * 0.8) * 0.1;
    group.current.rotation.y = Math.sin(t * 0.3) * 0.05;
  });
  return <group ref={group}>{children}</group>;
}

interface Jar3DProps {
  /** number of coins in the displayed jar (0..100) */
  coinsInJar: number;
  /** when true, the newest coin drops with an animation */
  animateLast: boolean;
}

export default function Jar3D({ coinsInJar, animateLast }: Jar3DProps) {
  const coins = Math.max(0, Math.min(JAR_CAPACITY, coinsInJar));
  const wobbleRef = useRef(0);
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2.4, 9.8], fov: 38 }}>
      <ambientLight intensity={1.1} color="#fff1e0" />
      <directionalLight position={[5, 9, 5]} intensity={2.0} castShadow />
      <directionalLight position={[-6, 3, -4]} intensity={0.7} color="#b9a6f2" />
      <PresentationControls
        global
        cursor
        snap
        speed={1.4}
        polar={[-0.2, 0.3]}
        azimuth={[-Math.PI / 2, Math.PI / 2]}
      >
        <IslandRig>
          {/* clay island pedestal */}
          <mesh position={[0, -0.45, 0]} receiveShadow scale={[1, 0.34, 0.92]}>
            <sphereGeometry args={[2.6, 40, 24]} />
            <meshStandardMaterial color="#9fe0b6" roughness={0.85} />
          </mesh>
          <mesh position={[0, -1.15, 0]} scale={[0.82, 0.55, 0.74]}>
            <sphereGeometry args={[2.2, 32, 20]} />
            <meshStandardMaterial color="#d9a97c" roughness={0.9} />
          </mesh>
          <group position={[0, -0.1, 0]}>
            <JarBelly wobbleRef={wobbleRef}>
              {coins === 0 && (
                <RoundedBox args={[1.2, 0.08, 1.2]} radius={0.04} position={[0, 0.1, 0]} visible={false} />
              )}
              {Array.from({ length: coins }, (_, i) => (
                <Coin
                  key={i}
                  indexInJar={i}
                  falling={animateLast && i === coins - 1}
                  onLand={() => {
                    wobbleRef.current = Math.max(wobbleRef.current, 0.6);
                  }}
                />
              ))}
            </JarBelly>
          </group>
          <ContactShadows position={[0, 0.42, 0]} opacity={0.22} blur={2.4} far={4} color="#46364a" />
        </IslandRig>
      </PresentationControls>
      <Cloud start={-6} y={2.8} z={-5} scale={1.1} speed={0.22} />
      <Cloud start={4} y={3.5} z={-7} scale={1.4} speed={0.16} />
      <Cloud start={-1} y={2.2} z={-8} scale={0.8} speed={0.28} />
    </Canvas>
  );
}
