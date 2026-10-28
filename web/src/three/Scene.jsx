import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sparkles, Stars } from '@react-three/drei'
import * as THREE from 'three'

// Orb colour follows the user's energy: cool and soft when low, warm and bright when high.
export const ENERGY_COLORS = {
  1: ['#a78bfa', '#6d28d9'],
  2: ['#60a5fa', '#4338ca'],
  3: ['#2dd4bf', '#0e7490'],
  4: ['#fbbf24', '#ea580c'],
  5: ['#fb7185', '#db2777'],
  rest: ['#818cf8', '#312e81'],
}

// Soft radial halo drawn once on a canvas; avoids the hard edge a back-face sphere gives.
const glowTexture = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.35)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.08)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
})()

function Orb({ palette, breath, calm }) {
  const mesh = useRef()
  const glow = useRef()
  const mat = useRef()
  const target = useMemo(() => ({ c: new THREE.Color(), e: new THREE.Color() }), [])

  useFrame((state, dt) => {
    target.c.set(palette[0])
    target.e.set(palette[1])
    if (mat.current) {
      mat.current.color.lerp(target.c, Math.min(1, dt * 2.5))
      mat.current.emissive.lerp(target.e, Math.min(1, dt * 2.5))
    }
    const t = state.clock.elapsedTime
    const base = breath == null ? 1 + Math.sin(t * 1.2) * 0.03 : 0.8 + breath * 0.45
    const s = THREE.MathUtils.lerp(mesh.current.scale.x, base, Math.min(1, dt * 3))
    mesh.current.scale.setScalar(s)
    glow.current.scale.setScalar(s * 5.2)
    glow.current.material.color.lerp(target.c, Math.min(1, dt * 2.5))
    if (!calm) mesh.current.rotation.y += dt * 0.15
  })

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[1.15, 128, 128]} />
        <MeshDistortMaterial
          ref={mat}
          color={palette[0]}
          emissive={palette[1]}
          emissiveIntensity={0.55}
          roughness={0.15}
          metalness={0.2}
          distort={calm ? 0.15 : 0.38}
          speed={calm ? 0.6 : 1.8}
        />
      </mesh>
      <sprite ref={glow}>
        <spriteMaterial map={glowTexture} color={palette[0]} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  )
}

function Rings({ palette, calm }) {
  const a = useRef()
  const b = useRef()
  useFrame((_, dt) => {
    const k = calm ? 0.2 : 1
    a.current.rotation.z += dt * 0.25 * k
    a.current.rotation.x += dt * 0.1 * k
    b.current.rotation.z -= dt * 0.18 * k
    b.current.rotation.y += dt * 0.12 * k
  })
  return (
    <>
      <mesh ref={a} rotation={[1.2, 0.3, 0]}>
        <torusGeometry args={[1.85, 0.012, 16, 200]} />
        <meshBasicMaterial color={palette[0]} transparent opacity={0.55} />
      </mesh>
      <mesh ref={b} rotation={[0.4, 1.1, 0.5]}>
        <torusGeometry args={[2.25, 0.008, 16, 200]} />
        <meshBasicMaterial color="#f9a8d4" transparent opacity={0.35} />
      </mesh>
    </>
  )
}

// A soft burst of sparks when the user starts a step. Re-triggers whenever `burst` changes.
function Burst({ burst, color }) {
  const COUNT = 140
  const points = useRef()
  const data = useMemo(() => {
    const dirs = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.6 + Math.random() * 1.6)
      dirs.set([v.x, v.y, v.z], i * 3)
    }
    return { dirs, pos: new Float32Array(COUNT * 3) }
  }, [])
  const start = useRef({ key: burst, t: -10 })

  useFrame((state) => {
    if (start.current.key !== burst) start.current = { key: burst, t: state.clock.elapsedTime }
    const age = state.clock.elapsedTime - start.current.t
    const p = Math.min(age / 1.6, 1)
    const ease = 1 - Math.pow(1 - p, 3)
    for (let i = 0; i < COUNT * 3; i++) data.pos[i] = data.dirs[i] * (1.2 + ease * 2.2)
    points.current.geometry.attributes.position.needsUpdate = true
    points.current.material.opacity = age < 1.6 ? 1 - p : 0
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={data.pos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.07} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function Parallax() {
  useFrame((state) => {
    const { camera, pointer } = state
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.6, 0.04)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.3 + pointer.y * 0.4, 0.04)
    camera.lookAt(0, 0, 0)
  })
  return null
}

export default function Scene({ mood = 3, breath = null, burst = 0, reducedMotion = false, offsetY = 1.75 }) {
  const palette = ENERGY_COLORS[mood] || ENERGY_COLORS[3]
  const calm = mood === 'rest' || reducedMotion
  return (
    <Canvas
      className="!fixed inset-0 -z-0"
      camera={{ position: [0, 0.3, 6.2], fov: 45 }}
      dpr={[1, 2]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={['#07061a']} />
      <fog attach="fog" args={['#07061a', 7, 16]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 4, 4]} intensity={60} color="#fde68a" />
      <pointLight position={[-4, -2, 2]} intensity={40} color="#c084fc" />
      <pointLight position={[0, -3, 3]} intensity={25} color={palette[0]} />
      <Stars radius={60} depth={40} count={reducedMotion ? 800 : 2500} factor={3} fade speed={calm ? 0.2 : 0.8} />
      <group position={[0, offsetY, 0]} scale={0.62}>
        <Float speed={calm ? 0.5 : 1.6} rotationIntensity={calm ? 0.1 : 0.4} floatIntensity={calm ? 0.3 : 0.9}>
          <Orb palette={palette} breath={breath} calm={calm} />
          <Rings palette={palette} calm={calm} />
        </Float>
        <Sparkles count={calm ? 40 : 90} scale={[7, 5, 5]} size={2.5} speed={calm ? 0.15 : 0.45} color={palette[0]} />
        <Burst burst={burst} color="#fde68a" />
      </group>
      {!reducedMotion && <Parallax />}
    </Canvas>
  )
}
