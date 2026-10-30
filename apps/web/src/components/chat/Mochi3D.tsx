import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MochiStatus } from "./MochiFace";

const CLAY = { roughness: 0.9, metalness: 0 };

function MochiModel({ status }: { status: MochiStatus }) {
  const group = useRef<THREE.Group>(null);
  const sprout = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const prevStatus = useRef<MochiStatus>(status);
  const statusSince = useRef(0);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    if (prevStatus.current !== status) {
      prevStatus.current = status;
      statusSince.current = t;
    }
    const inStatus = t - statusSince.current;

    // idle breathing: gentle squash & stretch
    const breathe = Math.sin(t * 1.8) * 0.03;
    let scaleX = 1 - breathe;
    let scaleY = 1 + breathe;
    let y = 0;
    let rotZ = 0;
    let rotY = 0;

    if (status === "thinking") {
      rotZ = Math.sin(t * 2.2) * 0.1;
      if (sprout.current) sprout.current.rotation.z = Math.sin(t * 3.4) * 0.35;
    } else if (status === "tool") {
      const p = Math.min(inStatus / 0.45, 1);
      y = Math.sin(p * Math.PI) * 0.38;
      scaleY = 1 + Math.sin(p * Math.PI) * 0.08;
    } else if (status === "celebrate") {
      const p = Math.min(inStatus / 0.7, 1);
      y = Math.sin(p * Math.PI) * 0.55;
      rotY = p * Math.PI * 2;
    } else if (status === "error") {
      rotZ = Math.sin(t * 11) * 0.07;
    }

    if (status !== "thinking" && sprout.current) {
      sprout.current.rotation.z = THREE.MathUtils.lerp(sprout.current.rotation.z, 0, 0.2);
    }

    g.position.y = y;
    g.rotation.z = rotZ;
    g.rotation.y = rotY;
    g.scale.set(scaleX, scaleY, 1);

    if (mouth.current) {
      const open =
        status === "speaking" ? 0.35 + Math.abs(Math.sin(t * 9)) * 0.75 : status === "celebrate" ? 0.9 : 0.3;
      mouth.current.scale.set(1, open, 1);
    }
    void delta;
  });

  return (
    <group ref={group}>
      {/* body */}
      <mesh scale={[1, 0.92, 0.95]}>
        <sphereGeometry args={[1.05, 28, 22]} />
        <meshStandardMaterial color="#ffb59d" {...CLAY} />
      </mesh>
      {/* sprout */}
      <group ref={sprout} position={[0.05, 0.95, 0]}>
        <mesh position={[0, 0.16, 0]} rotation={[0, 0, -0.25]}>
          <cylinderGeometry args={[0.035, 0.045, 0.34, 8]} />
          <meshStandardMaterial color="#2ea06a" {...CLAY} />
        </mesh>
        <mesh position={[-0.17, 0.36, 0]} scale={[1, 0.55, 0.6]} rotation={[0, 0, 0.5]}>
          <sphereGeometry args={[0.21, 14, 10]} />
          <meshStandardMaterial color="#7fd8a6" {...CLAY} />
        </mesh>
        <mesh position={[0.19, 0.4, 0]} scale={[1, 0.55, 0.6]} rotation={[0, 0, -0.45]}>
          <sphereGeometry args={[0.18, 14, 10]} />
          <meshStandardMaterial color="#7fd8a6" {...CLAY} />
        </mesh>
      </group>
      {/* eyes */}
      <mesh position={[-0.36, 0.12, 0.92]}>
        <sphereGeometry args={[0.085, 12, 12]} />
        <meshBasicMaterial color="#46364a" />
      </mesh>
      <mesh position={[0.36, 0.12, 0.92]}>
        <sphereGeometry args={[0.085, 12, 12]} />
        <meshBasicMaterial color="#46364a" />
      </mesh>
      {/* mouth */}
      <mesh ref={mouth} position={[0, -0.22, 0.97]} scale={[1, 0.3, 1]}>
        <sphereGeometry args={[0.13, 14, 10]} />
        <meshBasicMaterial color="#46364a" />
      </mesh>
      {/* cheeks */}
      <mesh position={[-0.62, -0.12, 0.82]} rotation={[0, -0.5, 0]}>
        <circleGeometry args={[0.13, 14]} />
        <meshBasicMaterial color="#ff8f78" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.62, -0.12, 0.82]} rotation={[0, 0.5, 0]}>
        <circleGeometry args={[0.13, 14]} />
        <meshBasicMaterial color="#ff8f78" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export default function Mochi3D({ status }: { status: MochiStatus }) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");

  useEffect(() => {
    const onVisibility = () => setFrameloop(document.hidden ? "never" : "always");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <Canvas
      dpr={1}
      frameloop={frameloop}
      camera={{ position: [0, 0.1, 4.2], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ width: 72, height: 72 }}
    >
      <ambientLight intensity={1.15} color="#fff1e0" />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <MochiModel status={status} />
    </Canvas>
  );
}
