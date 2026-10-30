import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";

const CELL = 1;
const GAP = 0.16;
const STEP = CELL + GAP;
const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const clay = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Fat clay cross: two chunky bars popping in one after the other. */
function Cross({ visible }: { visible: boolean }) {
  const bar1 = useRef<THREE.Mesh>(null);
  const bar2 = useRef<THREE.Mesh>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    const target = visible ? 1 : 0;
    progress.current = THREE.MathUtils.damp(progress.current, target, 9, delta);
    const p = progress.current;
    const t1 = Math.min(p * 2, 1);
    const t2 = Math.max(0, Math.min(p * 2 - 0.55, 1));
    const pop = (t: number) => (t <= 0 ? 0.0001 : t * (1 + 0.4 * Math.sin(t * Math.PI)));
    bar1.current?.scale.setScalar(pop(t1));
    bar2.current?.scale.setScalar(pop(t2));
  });

  return (
    <group position={[0, 0.18, 0]}>
      <mesh ref={bar1} rotation={[0, Math.PI / 4, Math.PI / 2]} scale={0.0001} castShadow>
        <capsuleGeometry args={[0.09, CELL * 0.75, 6, 10]} />
        <meshStandardMaterial color="#f06d4f" roughness={0.75} />
      </mesh>
      <mesh ref={bar2} rotation={[0, -Math.PI / 4, Math.PI / 2]} scale={0.0001} castShadow>
        <capsuleGeometry args={[0.09, CELL * 0.75, 6, 10]} />
        <meshStandardMaterial color="#f06d4f" roughness={0.75} />
      </mesh>
    </group>
  );
}

interface DayCellProps {
  day: number;
  index: number;
  position: [number, number, number];
  marked: boolean;
  isToday: boolean;
  onClick: () => void;
}

function DayCell({ day, index, position, marked, isToday, onClick }: DayCellProps) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const born = useRef(0);

  useFrame((state, delta) => {
    if (!group.current) return;
    born.current = Math.min(born.current + delta, 2.5);
    const appear = THREE.MathUtils.clamp((born.current - index * 0.025) * 5, 0, 1);
    const overshoot = appear * (1 + 0.3 * Math.sin(appear * Math.PI));
    const targetY = hovered ? 0.26 : 0;
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 14, delta);
    group.current.scale.setScalar(Math.max(overshoot, 0.0001));
    if (isToday && !hovered) {
      group.current.position.y += Math.sin(state.clock.elapsedTime * 2.2) * 0.03;
    }
  });

  const color = isToday ? "#ffce4f" : hovered ? "#ffe3d6" : "#ffffff";

  return (
    <group position={position}>
      <group ref={group} scale={0.0001}>
        <RoundedBox
          args={[CELL, 0.22, CELL]}
          radius={0.09}
          smoothness={4}
          castShadow
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
        >
          <meshStandardMaterial color={color} roughness={0.8} />
        </RoundedBox>
        <Text
          position={[-CELL * 0.3, 0.13, -CELL * 0.28]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.26}
          color={isToday ? "#8a5a00" : "#8a7a90"}
          anchorX="left"
          anchorY="top"
          fontWeight="bold"
        >
          {String(day)}
        </Text>
        <Cross visible={marked} />
      </group>
    </group>
  );
}

/** Soft clay cloud drifting across the sky. */
function Cloud({ start, y, z, scale, speed }: { start: number; y: number; z: number; scale: number; speed: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.x += speed * delta;
    if (group.current.position.x > 10) group.current.position.x = -10;
  });
  const mat = useMemo(() => clay("#ffffff"), []);
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

/** Pulls the camera back on narrow canvases so the whole board stays in frame. */
function ResponsiveCamera() {
  const { camera, size } = useThree();
  const aspect = size.width / Math.max(size.height, 1);
  const scale = THREE.MathUtils.clamp(1.55 / aspect, 1, 1.9);
  camera.position.set(0, 8.6 * scale, 6.0 * scale);
  camera.lookAt(0, 0, 0);
  return null;
}

/** Tilts the whole board toward the pointer for a parallax feel. */
function ParallaxRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, pointer.y * 0.07, 6, delta);
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, -pointer.x * 0.06, 6, delta);
    // whole board floats like an island
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.1;
  });
  return <group ref={group}>{children}</group>;
}

interface Calendar3DProps {
  year: number;
  month: number; // 0-based
  markedDates: Set<string>;
  onToggle: (dateKey: string) => void;
}

export default function Calendar3D({ year, month, markedDates, onToggle }: Calendar3DProps) {
  const { cells, rows } = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number; col: number; row: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const idx = firstDow + day - 1;
      cells.push({ day, col: idx % 7, row: Math.floor(idx / 7) });
    }
    return { cells, rows: Math.ceil((firstDow + daysInMonth) / 7) };
  }, [year, month]);

  const now = new Date();
  const todayDay =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const width = 7 * STEP;
  const height = (rows + 0.8) * STEP;
  const originX = -width / 2 + STEP / 2;
  const originZ = -height / 2 + STEP / 2;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 8.6, 6.0], fov: 42 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <ambientLight intensity={1.1} color="#fff1e0" />
      <directionalLight position={[5, 10, 5]} intensity={2.0} castShadow />
      <directionalLight position={[-6, 4, -4]} intensity={0.7} color="#b9a6f2" />
      <ResponsiveCamera />
      <ParallaxRig>
        <group position={[0, 0, 0.4]} key={`${year}-${month}`}>
          {/* clay board: mint top + earth base, like a floating island slab */}
          <RoundedBox
            args={[width + 1.0, 0.5, height + 1.0]}
            radius={0.24}
            smoothness={4}
            position={[0, -0.36, 0]}
            receiveShadow
          >
            <meshStandardMaterial color="#9fe0b6" roughness={0.85} />
          </RoundedBox>
          <RoundedBox
            args={[width + 0.4, 0.5, height + 0.4]}
            radius={0.24}
            smoothness={4}
            position={[0, -0.78, 0]}
          >
            <meshStandardMaterial color="#d9a97c" roughness={0.9} />
          </RoundedBox>
          {/* day-of-week header */}
          {DAY_NAMES.map((d, i) => (
            <Text
              key={d}
              position={[originX + i * STEP, 0.0, originZ - STEP * 0.78]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.28}
              color={i === 0 ? "#f06d4f" : "#46364a"}
              anchorX="center"
              fontWeight="bold"
            >
              {d}
            </Text>
          ))}
          {cells.map(({ day, col, row }, i) => (
            <DayCell
              key={day}
              day={day}
              index={i}
              position={[originX + col * STEP, 0, originZ + row * STEP]}
              marked={markedDates.has(dateKey(year, month, day))}
              isToday={day === todayDay}
              onClick={() => onToggle(dateKey(year, month, day))}
            />
          ))}
        </group>
      </ParallaxRig>
      <Cloud start={-7} y={2.6} z={-4} scale={1.1} speed={0.25} />
      <Cloud start={4} y={3.4} z={-6} scale={1.4} speed={0.18} />
      <Cloud start={-2} y={3.0} z={-7} scale={0.8} speed={0.3} />
      <ContactShadows position={[0, -1.1, 0]} opacity={0.25} blur={2.6} far={5} color="#46364a" />
    </Canvas>
  );
}
