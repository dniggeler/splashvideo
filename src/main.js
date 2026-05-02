import './style.css'
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  FogExp2,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'

const DEFAULT_DISPLAY_TEXT = 'Bubuzinha'
const MAX_DISPLAY_TEXT_LENGTH = 24
const TITLE_SUFFIX = 'Heart Particles'

const app = document.querySelector('#app')

if (!app) {
  throw new Error('App root element was not found.')
}

const displayText = getDisplayText()

app.innerHTML = `
  <div class="scene-shell">
    <canvas class="scene-canvas" aria-hidden="true"></canvas>
    <div class="overlay">
      <h1 data-display-text></h1>
      <p class="description">
        The name forms in space, bursts into particles, then gathers into a heart.
      </p>
      <button class="replay-button" type="button">Replay animation</button>
    </div>
  </div>
`

const canvas = app.querySelector('.scene-canvas')
const heading = app.querySelector('[data-display-text]')
const replayButton = app.querySelector('.replay-button')

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Scene canvas element was not found.')
}

if (!(heading instanceof HTMLHeadingElement)) {
  throw new Error('Display text heading element was not found.')
}

if (!(replayButton instanceof HTMLButtonElement)) {
  throw new Error('Replay button element was not found.')
}

heading.textContent = displayText
document.title = `${displayText} ${TITLE_SUFFIX}`

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
})

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = SRGBColorSpace

const scene = new Scene()
scene.background = new Color(0x09040f)
scene.fog = new FogExp2(0x09040f, 0.022)

const camera = new PerspectiveCamera(40, 1, 0.1, 120)
camera.position.set(0, 0, 34)

const ambientLight = new AmbientLight(0xffffff, 0.8)
const keyLight = new PointLight(0xffb3d9, 25, 80, 2)
keyLight.position.set(14, 8, 22)
const fillLight = new PointLight(0xa370ff, 18, 90, 2)
fillLight.position.set(-12, -8, 18)

scene.add(ambientLight, keyLight, fillLight)

const particleGroup = new Group()
scene.add(particleGroup)

const textPoints = sampleTextPoints(displayText)
const heartPoints = sampleHeartPoints()
const particleCount = Math.max(textPoints.length, heartPoints.length, 3200)

const textTargets = fillTargetArray(textPoints, particleCount, 0.18)
const heartTargets = fillTargetArray(heartPoints, particleCount, 0.12)
const explosionOffsets = createExplosionOffsets(textTargets, particleCount)
const shimmerOffsets = new Float32Array(particleCount)
const positions = new Float32Array(particleCount * 3)
const colors = new Float32Array(particleCount * 3)

const baseParticleColor = new Color()

for (let index = 0; index < particleCount; index += 1) {
  const colorHue = 0.82 + Math.random() * 0.08
  const colorLightness = 0.6 + Math.random() * 0.18
  baseParticleColor.setHSL(colorHue, 0.75, colorLightness)
  shimmerOffsets[index] = Math.random() * Math.PI * 2

  const offset = index * 3
  positions[offset] = textTargets[offset]
  positions[offset + 1] = textTargets[offset + 1]
  positions[offset + 2] = textTargets[offset + 2]
  colors[offset] = baseParticleColor.r
  colors[offset + 1] = baseParticleColor.g
  colors[offset + 2] = baseParticleColor.b
}

const particleGeometry = new BufferGeometry()
particleGeometry.setAttribute('position', new BufferAttribute(positions, 3))
particleGeometry.setAttribute('color', new BufferAttribute(colors, 3))

const particleMaterial = new PointsMaterial({
  color: 0xf9daff,
  size: 0.29,
  vertexColors: true,
  transparent: true,
  opacity: 0.94,
  depthWrite: false,
  blending: AdditiveBlending,
  sizeAttenuation: true,
})

const particles = new Points(particleGeometry, particleMaterial)
particleGroup.add(particles)

const halo = new Mesh(
  new PlaneGeometry(34, 34),
  new MeshBasicMaterial({
    color: 0x3e124d,
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false,
  }),
)

halo.position.set(0, 0, -14)
scene.add(halo)

const timings = {
  textHold: 2.2,
  explode: 2.4,
  morph: 3.2,
  heartHold: 2.4,
}

const totalDuration =
  timings.textHold + timings.explode + timings.morph + timings.heartHold

const phaseColors = {
  text: new Color(0xf3d1ff),
  explode: new Color(0xffd5c0),
  heart: new Color(0xff7caf),
}

let loopStartTime = performance.now() * 0.001

replayButton.addEventListener('click', () => {
  loopStartTime = performance.now() * 0.001
})

window.addEventListener('resize', resizeScene)
resizeScene()
renderer.setAnimationLoop(renderFrame)

function getDisplayText() {
  const searchParams = new URLSearchParams(window.location.search)
  const textFromQuery = searchParams.get('text') ?? ''
  const normalizedText = normalizeDisplayText(textFromQuery)

  return normalizedText || DEFAULT_DISPLAY_TEXT
}

function normalizeDisplayText(value) {
  const collapsedWhitespace = value.trim().replace(/\s+/g, ' ')
  const characters = Array.from(collapsedWhitespace)

  if (characters.length <= MAX_DISPLAY_TEXT_LENGTH) {
    return collapsedWhitespace
  }

  return characters.slice(0, MAX_DISPLAY_TEXT_LENGTH).join('').trimEnd()
}

function renderFrame() {
  const now = performance.now() * 0.001
  const elapsed = now - loopStartTime
  const loopTime = elapsed % totalDuration
  const positionArray = particleGeometry.attributes.position.array

  updateParticles(positionArray, loopTime, elapsed)

  particleGeometry.attributes.position.needsUpdate = true
  particleGroup.rotation.y = Math.sin(elapsed * 0.32) * 0.22
  particleGroup.rotation.x = Math.sin(elapsed * 0.18) * 0.08
  halo.rotation.z = -elapsed * 0.1

  camera.position.x = Math.sin(elapsed * 0.2) * 1.4
  camera.position.y = Math.cos(elapsed * 0.16) * 0.8
  camera.lookAt(0, 0, 0)

  renderer.render(scene, camera)
}

function updateParticles(positionArray, loopTime, elapsed) {
  if (loopTime < timings.textHold) {
    const progress = loopTime / timings.textHold
    particleMaterial.color.copy(phaseColors.text)

    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * 3
      const drift = Math.sin(elapsed * 2.2 + shimmerOffsets[index]) * 0.12
      const sway = Math.cos(elapsed * 1.5 + shimmerOffsets[index] * 1.7) * 0.08
      const settle = 1 - Math.pow(1 - progress, 3)

      positionArray[offset] = textTargets[offset] + sway * settle
      positionArray[offset + 1] = textTargets[offset + 1] + drift * settle
      positionArray[offset + 2] = textTargets[offset + 2] + sway * 0.4
    }

    return
  }

  if (loopTime < timings.textHold + timings.explode) {
    const progress = easeOutCubic((loopTime - timings.textHold) / timings.explode)
    particleMaterial.color.copy(phaseColors.explode)

    for (let index = 0; index < particleCount; index += 1) {
      applyExplosionPosition(positionArray, index, progress, elapsed)
    }

    return
  }

  if (loopTime < timings.textHold + timings.explode + timings.morph) {
    const morphTime = loopTime - timings.textHold - timings.explode
    const progress = easeInOutCubic(morphTime / timings.morph)
    particleMaterial.color.copy(phaseColors.heart)

    for (let index = 0; index < particleCount; index += 1) {
      const offset = index * 3
      const explosionPosition = getExplosionPosition(index, 1, elapsed)
      const heartPulse = 1 + Math.sin(elapsed * 3.4 + shimmerOffsets[index]) * 0.02

      positionArray[offset] = MathUtils.lerp(
        explosionPosition.x,
        heartTargets[offset] * heartPulse,
        progress,
      )
      positionArray[offset + 1] = MathUtils.lerp(
        explosionPosition.y,
        heartTargets[offset + 1] * heartPulse,
        progress,
      )
      positionArray[offset + 2] = MathUtils.lerp(
        explosionPosition.z,
        heartTargets[offset + 2],
        progress,
      )
    }

    return
  }

  particleMaterial.color.copy(phaseColors.heart)

  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * 3
    const pulse = 1 + Math.sin(elapsed * 4 + shimmerOffsets[index]) * 0.03
    const depthFloat = Math.cos(elapsed * 2 + shimmerOffsets[index] * 2) * 0.08

    positionArray[offset] = heartTargets[offset] * pulse
    positionArray[offset + 1] = heartTargets[offset + 1] * pulse
    positionArray[offset + 2] = heartTargets[offset + 2] + depthFloat
  }
}

function applyExplosionPosition(positionArray, index, progress, elapsed) {
  const offset = index * 3
  const explosionPosition = getExplosionPosition(index, progress, elapsed)

  positionArray[offset] = explosionPosition.x
  positionArray[offset + 1] = explosionPosition.y
  positionArray[offset + 2] = explosionPosition.z
}

function getExplosionPosition(index, progress, elapsed) {
  const offset = index * 3
  const wave = (1 - progress) * 0.7
  const spin = shimmerOffsets[index] + elapsed * 1.4

  return {
    x:
      textTargets[offset] +
      explosionOffsets[offset] * progress +
      Math.cos(spin) * wave,
    y:
      textTargets[offset + 1] +
      explosionOffsets[offset + 1] * progress +
      Math.sin(spin * 1.3) * wave,
    z:
      textTargets[offset + 2] +
      explosionOffsets[offset + 2] * progress +
      Math.sin(spin * 0.7) * wave * 1.6,
  }
}

function resizeScene() {
  const width = window.innerWidth
  const height = window.innerHeight

  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function sampleTextPoints(text) {
  const sampleCanvas = document.createElement('canvas')
  sampleCanvas.width = 2200
  sampleCanvas.height = 900

  const context = sampleCanvas.getContext('2d')

  if (!context) {
    throw new Error('2D canvas context for text sampling is not available.')
  }

  let fontSize = 320
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  do {
    context.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height)
    context.font = `700 ${fontSize}px "Segoe UI", Arial, sans-serif`
    fontSize -= 8
  } while (context.measureText(text).width > sampleCanvas.width * 0.84 && fontSize > 120)

  context.fillStyle = '#ffffff'
  context.fillText(text, sampleCanvas.width / 2, sampleCanvas.height / 2)

  const imageData = context.getImageData(
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height,
  )

  const points = []
  const step = 6
  const scale = 0.0175

  for (let y = 0; y < sampleCanvas.height; y += step) {
    for (let x = 0; x < sampleCanvas.width; x += step) {
      const alpha = imageData.data[(y * sampleCanvas.width + x) * 4 + 3]

      if (alpha < 64) {
        continue
      }

      points.push({
        x: (x - sampleCanvas.width / 2) * scale,
        y: (sampleCanvas.height / 2 - y) * scale,
        z: (Math.random() - 0.5) * 1.2,
      })
    }
  }

  shuffle(points)
  return points
}

function sampleHeartPoints() {
  const sampleCanvas = document.createElement('canvas')
  sampleCanvas.width = 1000
  sampleCanvas.height = 1000

  const context = sampleCanvas.getContext('2d')

  if (!context) {
    throw new Error('2D canvas context for heart sampling is not available.')
  }

  const size = 320
  const centerX = sampleCanvas.width / 2
  const centerY = sampleCanvas.height / 2 + 36

  context.translate(centerX, centerY)
  context.beginPath()
  context.moveTo(0, size * 0.34)
  context.bezierCurveTo(size * 0.95, -size * 0.18, size * 0.82, -size, 0, -size * 0.34)
  context.bezierCurveTo(-size * 0.82, -size, -size * 0.95, -size * 0.18, 0, size * 0.34)
  context.closePath()
  context.fillStyle = '#ffffff'
  context.fill()
  context.setTransform(1, 0, 0, 1, 0, 0)

  const imageData = context.getImageData(
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height,
  )

  const points = []
  const step = 6
  const scale = 0.018

  for (let y = 0; y < sampleCanvas.height; y += step) {
    for (let x = 0; x < sampleCanvas.width; x += step) {
      const alpha = imageData.data[(y * sampleCanvas.width + x) * 4 + 3]

      if (alpha < 64) {
        continue
      }

      points.push({
        x: (x - sampleCanvas.width / 2) * scale,
        y: (sampleCanvas.height / 2 - y) * scale,
        z: (Math.random() - 0.5) * 1.6,
      })
    }
  }

  shuffle(points)
  return points
}

function fillTargetArray(points, count, jitter) {
  const targets = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const point = points[index % points.length]
    const offset = index * 3

    targets[offset] = point.x + (Math.random() - 0.5) * jitter
    targets[offset + 1] = point.y + (Math.random() - 0.5) * jitter
    targets[offset + 2] = point.z + (Math.random() - 0.5) * jitter
  }

  return targets
}

function createExplosionOffsets(textTargetArray, count) {
  const offsets = new Float32Array(count * 3)

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    const x = textTargetArray[offset]
    const y = textTargetArray[offset + 1]
    const z = textTargetArray[offset + 2]
    const radius = Math.hypot(x, y, z) || 1
    const magnitude = 8 + Math.random() * 10
    const upwardBoost = Math.random() * 5

    offsets[offset] = (x / radius) * magnitude + (Math.random() - 0.5) * 7
    offsets[offset + 1] =
      (y / radius) * magnitude + upwardBoost + (Math.random() - 0.5) * 6
    offsets[offset + 2] = (z / radius) * magnitude + (Math.random() - 0.5) * 12
  }

  return offsets
}

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const value = array[index]
    array[index] = array[swapIndex]
    array[swapIndex] = value
  }
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3)
}

function easeInOutCubic(value) {
  if (value < 0.5) {
    return 4 * value * value * value
  }

  return 1 - Math.pow(-2 * value + 2, 3) / 2
}
