import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function Dumbbell({ position = [0, 0, 0], scale = 1, speed = 0.35 }) {
  const ref = useRef();
  const glow = useRef();

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * speed;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.6) * 0.22;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.9) * 0.16;
    if (glow.current) glow.current.intensity = 6 + Math.sin(state.clock.elapsedTime * 2) * 2.4;
  });

  const plate = (x, r, w) => (
    <mesh position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
      <cylinderGeometry args={[r, r, w, 48]} />
      <meshStandardMaterial color="#12141d" metalness={0.85} roughness={0.24} emissive="#00E5A0" emissiveIntensity={0.16} />
    </mesh>
  );

  return (
    <group ref={ref} position={position} scale={scale}>
      {/* bar */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.075, 0.075, 3.1, 32]} />
        <meshStandardMaterial color="#d7dbe6" metalness={1} roughness={0.15} />
      </mesh>
      {/* knurling rings */}
      {[-0.5, 0, 0.5].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.088, 0.088, 0.16, 32]} />
          <meshStandardMaterial color="#9aa3b5" metalness={0.95} roughness={0.35} />
        </mesh>
      ))}
      {plate(-1.05, 0.62, 0.16)}
      {plate(-1.26, 0.5, 0.13)}
      {plate(1.05, 0.62, 0.16)}
      {plate(1.26, 0.5, 0.13)}
      {/* collars */}
      {[-0.88, 0.88].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.12, 24]} />
          <meshStandardMaterial color="#FF4D6D" metalness={0.7} roughness={0.3} emissive="#FF4D6D" emissiveIntensity={0.5} />
        </mesh>
      ))}
      <pointLight ref={glow} position={[0, 0.4, 1.2]} color="#00E5A0" intensity={6} distance={6} />
    </group>
  );
}

function OrbitPlate({ radius = 3.2, size = 0.44, speed = 0.4, offset = 0, color = '#7B61FF', y = 0 }) {
  const ref = useRef();
  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    ref.current.position.set(Math.cos(t) * radius, y + Math.sin(t * 1.4) * 0.5, Math.sin(t) * radius);
    ref.current.rotation.x += delta * 0.7;
    ref.current.rotation.y += delta * 0.5;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[size, size * 0.34, 20, 48]} />
      <meshStandardMaterial color="#0f111a" metalness={0.9} roughness={0.22} emissive={color} emissiveIntensity={0.75} />
    </mesh>
  );
}

function Particles({ count = 700 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 22;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.03;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.12;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial transparent color="#7de9c8" size={0.045} sizeAttenuation depthWrite={false} opacity={0.7} />
    </Points>
  );
}

function Rig() {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const x = state.pointer.x * 0.6;
    const y = state.pointer.y * 0.35;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, x, 3.2, 0.1);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, -y, 3.2, 0.1);
  });
  return (
    <group ref={ref}>
      <Dumbbell position={[0, 0.1, 0]} scale={0.92} />
      <OrbitPlate radius={3.6} offset={0} color="#00E5A0" y={0.4} speed={0.36} />
      <OrbitPlate radius={4.4} offset={2.1} color="#7B61FF" y={-0.6} speed={0.28} size={0.34} />
      <OrbitPlate radius={3.1} offset={4.2} color="#FF4D6D" y={1.1} speed={0.44} size={0.26} />
      <Float speed={1.4} rotationIntensity={0.8} floatIntensity={1.2}>
        <mesh position={[3.2, 1.5, -1.4]}>
          <icosahedronGeometry args={[0.44, 0]} />
          <MeshDistortMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={0.55} roughness={0.15} metalness={0.6} distort={0.35} speed={2.4} />
        </mesh>
      </Float>
      <Float speed={1.1} rotationIntensity={1} floatIntensity={0.9}>
        <mesh position={[-3.4, -1.3, -1]}>
          <octahedronGeometry args={[0.42, 0]} />
          <MeshDistortMaterial color="#FBBF24" emissive="#FBBF24" emissiveIntensity={0.5} roughness={0.2} metalness={0.7} distort={0.4} speed={2} />
        </mesh>
      </Float>
    </group>
  );
}

function GridFloor() {
  return (
    <group position={[0, -2.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <gridHelper args={[46, 46, '#00E5A0', '#1b1f2e']} />
      <mesh position={[0, -0.02, 0]}>
        <planeGeometry args={[46, 46]} />
        <meshStandardMaterial color="#05050a" metalness={0.4} roughness={0.85} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

export default function HeroScene({ className = '' }) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.4, 7.4], fov: 46 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <fog attach="fog" args={['#05050a', 9, 22]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 8, 6]} intensity={1.4} color="#ffffff" />
        <pointLight position={[-6, 3, -4]} intensity={40} color="#7B61FF" />
        <pointLight position={[6, -3, -4]} intensity={40} color="#00E5A0" />
        <pointLight position={[0, 5, -8]} intensity={30} color="#FF4D6D" />
        <Rig />
        <Particles />
        <GridFloor />
      </Canvas>
    </div>
  );
}
