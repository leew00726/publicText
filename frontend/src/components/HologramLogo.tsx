import { useEffect, useRef } from 'react'

const HOLOGRAM_TEXT = '中国华能'
const SAMPLE_STEP = 5
const MIN_PARTICLE_COUNT = 5000
const PARTICLE_LAYERS = [-14, -7, 0, 7, 14] as const
const POINT_SIZE_MIN = 0.02
const POINT_SIZE_MAX = 0.1
const REPULSION_RADIUS = 54
const CANVAS_WIDTH = 1800
const CANVAS_HEIGHT = 560

type ParticleSeed = {
  normalizedX: number
  normalizedY: number
  row: number
  column: number
  depth: number
  size: number
  twinkle: number
  phase: number
}

type ParticleField = {
  seeds: ParticleSeed[]
  width: number
  height: number
  rowCount: number
  columnCount: number
}

function seededNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function approach(current: number, target: number, speed: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-speed * delta))
}

function createTextParticleField(label: string): ParticleField | null {
  if (typeof document === 'undefined') {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return null
  }

  const fontFamily = '"Microsoft YaHei UI", "PingFang SC", "Source Han Sans SC", "Noto Sans SC", sans-serif'
  let fontSize = 286

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `700 ${fontSize}px ${fontFamily}`
  const measuredWidth = context.measureText(label).width
  const targetWidth = CANVAS_WIDTH * 0.8
  if (measuredWidth > 0) {
    fontSize *= Math.min(targetWidth / measuredWidth, 1)
  }

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.font = `700 ${fontSize}px ${fontFamily}`
  context.fillStyle = '#ffffff'
  context.fillText(label, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)

  const imageData = context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  const rawParticles: Array<{
    x: number
    y: number
    row: number
    column: number
    depth: number
    size: number
    twinkle: number
    phase: number
  }> = []

  for (let y = 0; y < CANVAS_HEIGHT; y += SAMPLE_STEP) {
    for (let x = 0; x < CANVAS_WIDTH; x += SAMPLE_STEP) {
      const alpha = imageData.data[(y * CANVAS_WIDTH + x) * 4 + 3]
      if (alpha < 68) {
        continue
      }

      const row = Math.floor(y / SAMPLE_STEP)
      const column = Math.floor(x / SAMPLE_STEP)

      PARTICLE_LAYERS.forEach((depth, layerIndex) => {
        const seed = row * 7919 + column * 2971 + layerIndex * 911
        const latticeDirection = (row + column + layerIndex) % 2 === 0 ? -1 : 1
        const structuredOffsetX =
          latticeDirection * SAMPLE_STEP * 0.08 + (layerIndex - (PARTICLE_LAYERS.length - 1) * 0.5) * 0.22
        const structuredOffsetY =
          ((row + layerIndex) % 2 === 0 ? 1 : -1) * SAMPLE_STEP * 0.04 +
          (column % 3 === 0 ? 0.18 : -0.12) * layerIndex

        rawParticles.push({
          x: x + structuredOffsetX,
          y: y + structuredOffsetY,
          row,
          column,
          depth,
          size: POINT_SIZE_MIN + seededNoise(seed + 5) * (POINT_SIZE_MAX - POINT_SIZE_MIN),
          twinkle: seededNoise(seed + 7),
          phase: seededNoise(seed + 11) * Math.PI * 2,
        })
      })
    }
  }

  if (rawParticles.length === 0) {
    return null
  }

  const baseParticleCount = rawParticles.length
  while (rawParticles.length < MIN_PARTICLE_COUNT) {
    const source = rawParticles[rawParticles.length % baseParticleCount]
    const cloneIndex = rawParticles.length + 1
    const cloneSeed = cloneIndex * 613
    rawParticles.push({
      x: source.x + ((cloneIndex % 3) - 1) * 0.42,
      y: source.y + (((cloneIndex + 1) % 3) - 1) * 0.42,
      row: source.row,
      column: source.column,
      depth: source.depth + (seededNoise(cloneSeed) - 0.5) * 2.4,
      size: Math.min(
        POINT_SIZE_MAX,
        Math.max(POINT_SIZE_MIN, source.size + (seededNoise(cloneSeed + 1) - 0.5) * 0.01),
      ),
      twinkle: seededNoise(cloneSeed + 2),
      phase: seededNoise(cloneSeed + 3) * Math.PI * 2,
    })
  }

  if (rawParticles.length < MIN_PARTICLE_COUNT) {
    return null
  }

  const minX = Math.min(...rawParticles.map((particle) => particle.x))
  const maxX = Math.max(...rawParticles.map((particle) => particle.x))
  const minY = Math.min(...rawParticles.map((particle) => particle.y))
  const maxY = Math.max(...rawParticles.map((particle) => particle.y))
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  const centerX = minX + width / 2
  const centerY = minY + height / 2
  const rowCount = Math.max(Math.ceil(CANVAS_HEIGHT / SAMPLE_STEP), 1)
  const columnCount = Math.max(Math.ceil(CANVAS_WIDTH / SAMPLE_STEP), 1)

  const seeds = rawParticles.map((particle) => ({
    normalizedX: (particle.x - centerX) / width,
    normalizedY: (centerY - particle.y) / height,
    row: Math.max(0, Math.min(rowCount - 1, particle.row)),
    column: Math.max(0, Math.min(columnCount - 1, particle.column)),
    depth: particle.depth,
    size: particle.size,
    twinkle: particle.twinkle,
    phase: particle.phase,
  }))

  return {
    seeds,
    width,
    height,
    rowCount,
    columnCount,
  }
}

const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uLogoHeight;
  uniform float uPointScale;
  uniform float uWaveCenter;
  uniform float uWaveWidth;

  attribute float aSeed;
  attribute float aSize;
  attribute float aPhase;

  varying float vGradientMix;
  varying float vTwinkle;
  varying float vWave;

  void main() {
    float gradientMix = clamp((position.y + uLogoHeight * 0.5) / uLogoHeight, 0.0, 1.0);
    float twinkle = 0.82 + 0.18 * sin(uTime * (2.2 + fract(aSeed * 19.0) * 2.6) + aPhase * 3.2);
    float waveDistance = abs(position.y - uWaveCenter);
    float wave = exp(-pow(waveDistance / uWaveWidth, 2.0));
    float shimmer = 0.76 + 0.24 * sin(uTime * 4.4 + aPhase * 1.6 + position.x * 0.01);
    float sizeBoost = 1.0 + wave * 0.55;

    gl_PointSize = aSize * uPointScale * sizeBoost * twinkle * shimmer;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    vGradientMix = gradientMix;
    vTwinkle = twinkle;
    vWave = wave;
  }
`

const FRAGMENT_SHADER = `
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uWaveColor;
  uniform float uOpacity;

  varying float vGradientMix;
  varying float vTwinkle;
  varying float vWave;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float distanceToCenter = length(centered);
    float squareMask = 1.0 - step(0.48, max(abs(centered.x), abs(centered.y)));
    float circleMask = 1.0 - smoothstep(0.34, 0.48, distanceToCenter);
    float crispCore = mix(squareMask, circleMask, 0.68);
    float halo = smoothstep(0.52, 0.1, distanceToCenter) * 0.18;
    float sparkle = smoothstep(0.2, 0.0, distanceToCenter) * 0.16 * vTwinkle;
    float alpha = (crispCore + halo + sparkle) * uOpacity * (0.82 + vTwinkle * 0.24);

    if (alpha < 0.01) {
      discard;
    }

    vec3 baseColor = mix(uBaseColor, uHighlightColor, clamp(vGradientMix * 0.76 + vTwinkle * 0.08, 0.0, 1.0));
    vec3 waveColor = mix(uHighlightColor, uWaveColor, clamp(vWave * 1.25, 0.0, 1.0));
    vec3 finalColor = mix(baseColor, waveColor, clamp(vWave * 0.96, 0.0, 1.0));
    finalColor *= 1.0 + halo * 0.7 + sparkle * 1.8;
    gl_FragColor = vec4(finalColor, alpha);
  }
`

type HologramLogoProps = {
  className?: string
}

export function HologramLogo({ className = '' }: HologramLogoProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const canvasHostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvasHost = canvasHostRef.current

    if (!root || !canvasHost) {
      return
    }

    const hostElement = canvasHost
    const particleField = createTextParticleField(HOLOGRAM_TEXT)
    if (!particleField) {
      hostElement.dataset.renderMode = 'fallback'
      return
    }

    const activeField = particleField
    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false

    let disposed = false
    let animationFrame = 0
    let resizeObserver: ResizeObserver | null = null
    let cleanupPointerHandlers: (() => void) | null = null
    let cleanupThreeScene: (() => void) | null = null

    void Promise.all([
      import('three'),
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
    ])
      .then(([THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }]) => {
        if (disposed) {
          return
        }

        const renderer = new THREE.WebGLRenderer({
          alpha: false,
          antialias: true,
          powerPreference: 'high-performance',
        })
        renderer.setClearColor(0x000814, 1)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.02
        renderer.domElement.className = 'module-h-canvas'
        renderer.domElement.setAttribute('aria-hidden', 'true')
        hostElement.replaceChildren(renderer.domElement)
        hostElement.dataset.renderMode = 'webgl-bloom'
        hostElement.dataset.particleCount = String(activeField.seeds.length)

        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#000814')

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
        camera.position.z = 220

        const composer = new EffectComposer(renderer)
        const renderPass = new RenderPass(scene, camera)
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.54, 0.14)
        composer.addPass(renderPass)
        composer.addPass(bloomPass)

        const particleCount = activeField.seeds.length
        const mainPositions = new Float32Array(particleCount * 3)
        const basePositions = new Float32Array(particleCount * 3)
        const currentPositions = new Float32Array(particleCount * 3)
        const seeds = new Float32Array(particleCount)
        const sizes = new Float32Array(particleCount)
        const phases = new Float32Array(particleCount)

        activeField.seeds.forEach((particle, index) => {
          seeds[index] = particle.twinkle
          sizes[index] = particle.size
          phases[index] = particle.phase
        })

        function createGeometry(positions: Float32Array) {
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
          geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
          geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
          geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
          return geometry
        }

        function createUniformSet() {
          return {
            uTime: { value: 0 },
            uLogoHeight: { value: 320 },
            uPointScale: { value: 58 },
            uWaveCenter: { value: 0 },
            uWaveWidth: { value: 38 },
            uBaseColor: { value: new THREE.Color('#0055A2') },
            uHighlightColor: { value: new THREE.Color('#00F2FF') },
            uWaveColor: { value: new THREE.Color('#f4ffff') },
            uOpacity: { value: 0.9 },
          }
        }

        const mainGeometry = createGeometry(mainPositions)
        const mainUniforms = createUniformSet()

        const mainMaterial = new THREE.ShaderMaterial({
          uniforms: mainUniforms,
          vertexShader: VERTEX_SHADER,
          fragmentShader: FRAGMENT_SHADER,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })

        const mainPoints = new THREE.Points(mainGeometry, mainMaterial)
        const hologramGroup = new THREE.Group()
        hologramGroup.rotation.x = -0.1
        hologramGroup.rotation.y = 0.04
        hologramGroup.add(mainPoints)
        scene.add(hologramGroup)

        const pointer = { x: 0, y: 0, active: false }

        function layout(forceReset: boolean) {
          const width = Math.max(hostElement.clientWidth, 320)
          const height = Math.max(hostElement.clientHeight, 240)
          const maxRenderableWidth = width * 0.84
          const maxRenderableHeight = height * 0.5
          const scale = Math.min(
            maxRenderableWidth / activeField.width,
            maxRenderableHeight / activeField.height,
          )
          const logoWidth = activeField.width * scale
          const logoHeight = activeField.height * scale

          camera.left = -width / 2
          camera.right = width / 2
          camera.top = height / 2
          camera.bottom = -height / 2
          camera.updateProjectionMatrix()

          renderer.setSize(width, height, false)
          composer.setSize(width, height)
          bloomPass.setSize(width, height)

          mainUniforms.uLogoHeight.value = logoHeight
          mainUniforms.uWaveWidth.value = Math.max(logoHeight * 0.11, 26)
          mainUniforms.uPointScale.value = Math.min(Math.max(height * 0.108, 48), 74)

          activeField.seeds.forEach((particle, index) => {
            const positionIndex = index * 3
            const x = particle.normalizedX * logoWidth
            const y = particle.normalizedY * logoHeight
            const z = particle.depth

            basePositions[positionIndex] = x
            basePositions[positionIndex + 1] = y
            basePositions[positionIndex + 2] = z

            if (forceReset) {
              currentPositions[positionIndex] = x
              currentPositions[positionIndex + 1] = y
              currentPositions[positionIndex + 2] = z
              mainPositions[positionIndex] = x
              mainPositions[positionIndex + 1] = y
              mainPositions[positionIndex + 2] = z
            }
          })

          mainGeometry.attributes.position.needsUpdate = true
        }

        layout(true)

        const handlePointerMove = (event: PointerEvent) => {
          const rect = hostElement.getBoundingClientRect()
          pointer.x = event.clientX - rect.left - rect.width / 2
          pointer.y = rect.height / 2 - (event.clientY - rect.top)
          pointer.active = true
        }

        const handlePointerLeave = () => {
          pointer.active = false
        }

        root.addEventListener('pointermove', handlePointerMove)
        root.addEventListener('pointerleave', handlePointerLeave)
        cleanupPointerHandlers = () => {
          root.removeEventListener('pointermove', handlePointerMove)
          root.removeEventListener('pointerleave', handlePointerLeave)
        }

        resizeObserver = new ResizeObserver(() => layout(true))
        resizeObserver.observe(hostElement)

        const renderFrame = (time: number, delta: number) => {
          const seconds = time * 0.001
          mainUniforms.uTime.value = seconds
          mainUniforms.uWaveCenter.value =
            ((seconds * 28) % (mainUniforms.uLogoHeight.value + mainUniforms.uWaveWidth.value * 2)) -
            mainUniforms.uLogoHeight.value * 0.5 -
            mainUniforms.uWaveWidth.value

          activeField.seeds.forEach((particle, index) => {
            const positionIndex = index * 3
            const currentX = currentPositions[positionIndex]
            const currentY = currentPositions[positionIndex + 1]
            const baseX = basePositions[positionIndex]
            const baseY = basePositions[positionIndex + 1]
            const baseZ = basePositions[positionIndex + 2]
            const phase = phases[index]

            const brownianX =
              Math.sin(seconds * (0.76 + particle.twinkle * 0.34) + phase) * 0.48 +
              Math.cos(seconds * (0.52 + particle.twinkle * 0.24) + phase * 0.6) * 0.22
            const brownianY =
              Math.cos(seconds * (0.74 + particle.twinkle * 0.26) + phase * 1.2) * 0.52 +
              Math.sin(seconds * (0.48 + particle.twinkle * 0.22) + phase * 0.4) * 0.18

            let targetX = baseX + brownianX
            let targetY = baseY + brownianY

            if (pointer.active) {
              const offsetX = currentX - pointer.x
              const offsetY = currentY - pointer.y
              const distanceSquared = offsetX * offsetX + offsetY * offsetY

              if (distanceSquared < REPULSION_RADIUS * REPULSION_RADIUS && distanceSquared > 0.0001) {
                const distance = Math.sqrt(distanceSquared)
                const force = (1 - distance / REPULSION_RADIUS) * 22
                targetX += (offsetX / distance) * force
                targetY += (offsetY / distance) * force
              }
            }

            const nextX = approach(currentX, targetX, 10.5, delta)
            const nextY = approach(currentY, targetY, 10.5, delta)

            currentPositions[positionIndex] = nextX
            currentPositions[positionIndex + 1] = nextY
            currentPositions[positionIndex + 2] = baseZ

            mainPositions[positionIndex] = nextX
            mainPositions[positionIndex + 1] = nextY
            mainPositions[positionIndex + 2] = baseZ
          })

          mainGeometry.attributes.position.needsUpdate = true
          composer.render()
        }

        if (reducedMotion) {
          renderFrame(performance.now(), 0.016)
        } else {
          let previousTime = performance.now()
          const animate = (now: number) => {
            const delta = Math.min((now - previousTime) / 1000, 0.033)
            previousTime = now
            renderFrame(now, delta)
            animationFrame = window.requestAnimationFrame(animate)
          }
          animationFrame = window.requestAnimationFrame(animate)
        }

        cleanupThreeScene = () => {
          if (animationFrame) {
            window.cancelAnimationFrame(animationFrame)
          }
          mainGeometry.dispose()
          mainMaterial.dispose()
          composer.dispose()
          renderPass.dispose()
          renderer.dispose()
          hostElement.replaceChildren()
        }
      })
      .catch(() => {
        hostElement.dataset.renderMode = 'fallback'
      })

    return () => {
      disposed = true
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }
      cleanupPointerHandlers?.()
      resizeObserver?.disconnect()
      cleanupThreeScene?.()
    }
  }, [])

  return (
    <section
      className={`glass-card module-h-hero ${className}`.trim()}
      data-testid="module-h-hero"
      role="img"
      aria-label="中国华能全息投影主视觉"
      ref={rootRef}
    >
      <div className="module-h-hologram-shell">
        <div
          className="module-h-canvas-host"
          data-testid="module-h-canvas"
          data-particle-shape={HOLOGRAM_TEXT}
          data-particle-style="tech-blue-cyan"
          data-particle-count-min={MIN_PARTICLE_COUNT}
          data-background-style="deep-navy"
          data-effect-style="digital-stream"
          data-glow-mode="per-particle"
          data-wave-mode="energy-scanline"
          data-node-layout="structured-grid"
          ref={canvasHostRef}
        >
          <div className="module-h-fallback-mark" aria-hidden="true">
            {HOLOGRAM_TEXT}
          </div>
        </div>
        <div className="module-h-scanlines" aria-hidden="true" />
      </div>
    </section>
  )
}
