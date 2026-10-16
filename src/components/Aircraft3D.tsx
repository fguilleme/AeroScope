import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { Box3, CanvasTexture, Group, Mesh, MeshStandardMaterial, RepeatWrapping, Vector3 } from 'three'
import { Layers3, Maximize2, MousePointer2, Rotate3D, Sparkles } from 'lucide-react'
import { resolveAircraftModel, type AircraftModel } from '../aircraftModels'
import type { Aircraft } from '../types'
import { clean } from '../utils'
import { useI18n } from '../i18n'

class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode; resetKey: string }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) this.setState({ hasError: false })
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

function createMicroSurface() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(256, 256)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const grain = 124 + Math.floor(Math.random() * 9)
    pixels.data[index] = grain
    pixels.data[index + 1] = grain
    pixels.data[index + 2] = grain
    pixels.data[index + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  context.strokeStyle = 'rgb(105,105,105)'
  context.lineWidth = 1
  for (let step = 0; step <= 256; step += 64) {
    context.beginPath(); context.moveTo(step, 0); context.lineTo(step, 256); context.stroke()
    context.beginPath(); context.moveTo(0, step); context.lineTo(256, step); context.stroke()
  }
  context.fillStyle = 'rgb(150,150,150)'
  for (let y = 8; y < 256; y += 16) for (let x = 8; x < 256; x += 16) context.fillRect(x, y, 1, 1)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(7, 7)
  return texture
}

function JetModel({ autoRotate, descriptor }: { autoRotate: boolean; descriptor: AircraftModel }) {
  const { scene } = useGLTF(descriptor.path)
  const model = useMemo(() => scene.clone(true), [scene])
  const group = useRef<Group>(null)
  const microSurface = useMemo(createMicroSurface, [])
  const { scale, center } = useMemo(() => {
    const box = new Box3().setFromObject(model)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    return { scale: 5.2 / Math.max(size.x, size.y, size.z), center }
  }, [model])

  useEffect(() => {
    const ownedMaterials: MeshStandardMaterial[] = []
    model.traverse(child => {
      child.castShadow = true
      child.receiveShadow = true
      if (!(child instanceof Mesh)) return
      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
      const materials = sourceMaterials.map(source => {
        const material = source.clone() as MeshStandardMaterial
        const name = material.name.toLowerCase()
        const glass = /glass|window|transparent|canopy/.test(name)
        const rubber = /rubber|tire|tyre/.test(name)
        if ('roughness' in material) material.roughness = glass ? 0.08 : rubber ? 0.82 : 0.3
        if ('metalness' in material) material.metalness = glass ? 0.04 : rubber ? 0.02 : 0.16
        if ('envMapIntensity' in material) material.envMapIntensity = glass ? 2.6 : 1.45
        if (!glass && !rubber && child.geometry.attributes.uv && !material.bumpMap) {
          material.bumpMap = microSurface
          material.bumpScale = 0.012
        }
        material.needsUpdate = true
        ownedMaterials.push(material)
        return material
      })
      child.material = Array.isArray(child.material) ? materials : materials[0]
    })
    return () => ownedMaterials.forEach(material => material.dispose())
  }, [microSurface, model])

  useEffect(() => () => microSurface.dispose(), [microSurface])

  useFrame((_, delta) => {
    if (autoRotate && group.current) group.current.rotation.y += delta * 0.16
  })

  return <group ref={group} rotation={descriptor.rotation}>
    <primitive object={model} scale={scale} position={[-center.x * scale, -center.y * scale + 0.35, -center.z * scale]} />
  </group>
}

function ResetCamera({ token }: { token: number }) {
  const { camera, size } = useThree()
  useEffect(() => {
    const portrait = size.width / size.height < 0.78
    camera.position.set(portrait ? 10.5 : 9.5, portrait ? 5 : 4.2, portrait ? 13.5 : 11.5)
    camera.lookAt(0, 0.35, 0)
  }, [camera, size.width, size.height, token])
  return null
}

export default function Aircraft3D({ aircraft }: { aircraft: Aircraft }) {
  const { language, t } = useI18n()
  const { active: modelLoading, progress: modelProgress } = useProgress()
  const [autoRotate, setAutoRotate] = useState(true)
  const [reset, setReset] = useState(0)
  const descriptor = useMemo(() => resolveAircraftModel(aircraft), [aircraft])
  const displayModelLabel = language === 'en' ? ({
    'widebody-2eng': 'Twin-engine widebody', 'widebody-4eng': 'Four-engine widebody', bizjet: 'Business jet',
    'light-prop': 'Light propeller aircraft', helicopter: 'Helicopter', fighter: 'High-performance aircraft',
    glider: 'Glider', 'regional-jet-aircraft': 'Generic regional jet',
  } as Record<string, string>)[descriptor.key] || descriptor.label : descriptor.label
  return <div className="viewer-layout">
    <section className="viewer-3d panel">
      <div className="viewer-topline"><div><span>{t('modelDetection')}</span><strong>{displayModelLabel} · {clean(aircraft.r)}</strong></div><small className={`match-badge ${descriptor.match}`}>{descriptor.match === 'fallback' ? t('fallbackModel') : descriptor.match === 'exact' ? t('exactMatch') : t('familyMatch')}</small></div>
      {modelLoading && <div className="model-loader"><span />{t('loading')} {modelProgress.toFixed(0)}%</div>}
      <ModelErrorBoundary resetKey={descriptor.path} fallback={<div className="model-error"><strong>{t('modelUnavailable')}</strong><span>{t('dataAccessible')}</span></div>}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [6.5, 3.2, 7.5], fov: 34 }} gl={{ antialias: true }}>
        <color attach="background" args={['#09131b']} />
        <fog attach="fog" args={['#09131b', 11, 21]} />
        <ambientLight intensity={1.25} />
        <directionalLight castShadow position={[5, 8, 4]} intensity={4.5} color="#f4fbff" shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-6, 3, -4]} intensity={2.4} color="#6dc1ff" />
        <pointLight position={[0, -1, 5]} intensity={2} color="#caff55" />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={3.2} color="#e8f6ff" position={[0, 6, -5]} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={2.2} color="#78c8ff" position={[-7, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[5, 2, 1]} />
          <Lightformer form="rect" intensity={1.8} color="#caff55" position={[7, -1, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[3, 1, 1]} />
        </Environment>
        <Suspense fallback={null}><JetModel autoRotate={autoRotate} descriptor={descriptor} /></Suspense>
        <ContactShadows position={[0, -1.28, 0]} opacity={0.42} scale={13} blur={2.4} far={6} />
        <Grid position={[0, -1.3, 0]} args={[18, 18]} cellSize={0.5} cellThickness={0.35} cellColor="#466072" sectionSize={2} sectionThickness={0.7} sectionColor="#58798b" fadeDistance={15} fadeStrength={1} infiniteGrid />
        <OrbitControls makeDefault target={[0, 0.35, 0]} minDistance={4} maxDistance={14} enableDamping dampingFactor={0.06} autoRotate={false} />
        <ResetCamera token={reset} />
      </Canvas>
      </ModelErrorBoundary>
      <div className="viewer-actions">
        <button className={autoRotate ? 'active' : ''} onClick={() => setAutoRotate(value => !value)}><Rotate3D size={15} /> {t('autoRotation')}</button>
        <button onClick={() => setReset(value => value + 1)}><Maximize2 size={15} /> {t('recenter')}</button>
      </div>
      <div className="viewer-hint"><MousePointer2 size={14} /> {t('orbitHint')}</div>
    </section>
    <aside className="viewer-details panel">
      <div className="eyebrow">{t('trackedAircraft')}</div>
      <h2>{aircraft.desc || clean(aircraft.t)}</h2>
      <p>{descriptor.match === 'fallback' ? t('fallbackDescription') : t('modelDescription', { type: clean(aircraft.t), model: displayModelLabel })}</p>
      <div className="texture-features"><span><Layers3 size={12}/> {t('colorTexture')}</span><span><Sparkles size={12}/> {t('pbrFinish')}</span><span>{t('aluminumRelief')}</span></div>
      <div className="spec-grid">
        <div><span>{t('registration')}</span><strong>{clean(aircraft.r)}</strong></div>
        <div><span>Type ICAO</span><strong>{clean(aircraft.t)}</strong></div>
        <div><span>Transpondeur</span><strong>{aircraft.hex.toUpperCase()}</strong></div>
        <div><span>{t('category')}</span><strong>{clean(aircraft.category)}</strong></div>
      </div>
      <div className="model-match"><span>{t('detectedType')}</span><strong>{clean(aircraft.t)}</strong><i>→</i><span>{t('loadedModel')}</span><strong>{displayModelLabel}</strong></div>
      <a className="model-credit" href={descriptor.sourceUrl} target="_blank" rel="noreferrer"><span>{t('modelSource')}</span><strong>{descriptor.source}</strong><small>{descriptor.license} · {t('loadedOnDemand')} ↗</small></a>
    </aside>
  </div>
}
