import * as THREE from 'three'
import type { City } from './cities'
import { createGlobeTextureCanvas } from './globeTexture'

/* ---------------------------------------------------------------------------
   GlobeScene — imperative Three.js engine behind the <GlobeHub /> component.

   Owns: renderer, scene graph, touch-drag spin with inertia damping,
   pin raycasting (tap vs. drag discrimination), camera zoom tweens, and
   DOM label positioning. React never re-renders during the RAF loop —
   all hot-path work happens here, which is how we hold 60fps on iOS.
   ------------------------------------------------------------------------ */

export interface GlobeSceneCallbacks {
  /** Fired the moment a pin is tapped (before any zoom animation). */
  onCityTap: (city: City) => void
  /** Fired when the zoom-in tween lands on a city. */
  onCityFocused: (city: City) => void
}

interface PinEntry {
  city: City
  group: THREE.Group
  head: THREE.Mesh
  ring: THREE.Mesh | null
  hit: THREE.Mesh
  basePos: THREE.Vector3 // unit vector on the globe surface
}

const GLOBE_RADIUS = 1
const CAM_FAR_Z = 3.4 // resting orbit distance
const CAM_NEAR_Z = 2.05 // zoomed-into-city distance
const MAX_DPR = 2 // cap DPR: retina crispness without melting older iPads
const DRAG_SPEED = 0.0052 // radians per CSS pixel
const INERTIA_DAMPING = 0.94 // per-frame velocity decay after release
const MIN_VELOCITY = 0.00004
const TAP_MAX_MS = 400
const TAP_MAX_MOVE_PX = 10
const IDLE_SPIN_SPEED = 0.06 // rad/s gentle auto-spin when untouched
const IDLE_DELAY_MS = 2500
const FOCUS_DURATION_MS = 1150

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)

/** Where a focused city lands on screen: slightly above center so the
 *  city hub sheet can slide over the lower half without covering it. */
const FOCUS_DIRECTION = new THREE.Vector3(0, 0.32, 1).normalize()

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

export class GlobeScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private globeGroup = new THREE.Group()
  private pins: PinEntry[] = []
  private raycaster = new THREE.Raycaster()
  private clock = new THREE.Clock()
  private rafId = 0
  private disposed = false

  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private callbacks: GlobeSceneCallbacks
  private labelEls = new Map<string, HTMLElement>()
  private resizeObserver: ResizeObserver

  /* interaction state */
  private pointerDown = false
  private downAt = 0
  private downX = 0
  private downY = 0
  private lastX = 0
  private lastY = 0
  private velX = 0 // yaw velocity (rad/frame)
  private velY = 0 // pitch velocity (rad/frame)
  private lastInteraction = 0
  private focusTween: {
    fromQ: THREE.Quaternion
    toQ: THREE.Quaternion
    fromZ: number
    toZ: number
    start: number
    city: City | null // null = reset tween
  } | null = null
  private focusedCity: City | null = null

  constructor(container: HTMLElement, canvas: HTMLCanvasElement, callbacks: GlobeSceneCallbacks) {
    this.container = container
    this.canvas = canvas
    this.callbacks = callbacks

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camera.position.set(0, 0, CAM_FAR_Z)

    this.buildScene()
    this.bindEvents()

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
    this.handleResize()

    this.clock.start()
    this.rafId = requestAnimationFrame(this.tick)
  }

  /* -- scene construction ------------------------------------------------ */

  private buildScene(): void {
    // Lighting: bright & even — no scary dark side of the planet for kids.
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15))
    const sun = new THREE.DirectionalLight(0xfff7e0, 1.6)
    sun.position.set(3, 2, 4)
    this.scene.add(sun)
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.5)
    fill.position.set(-3, -1, -2)
    this.scene.add(fill)

    // Earth
    const texture = new THREE.CanvasTexture(createGlobeTextureCanvas())
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy())
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48),
      new THREE.MeshPhongMaterial({ map: texture, shininess: 8 }),
    )
    this.globeGroup.add(earth)

    // Soft atmosphere glow (inverted-hull trick — cheap and 60fps-safe)
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.13, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    )
    this.scene.add(glow) // NOT in globeGroup — glow shouldn't spin

    // Starfield (deterministic spherical scatter)
    const starCount = 420
    const positions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      // low-discrepancy scatter — stable between loads, no Math.random
      const u = ((i * 0.618033988749) % 1) * 2 - 1 // golden-ratio sequence
      const theta = i * 2.399963229728653 // golden angle
      const r = Math.sqrt(1 - u * u) * 28
      positions[i * 3] = r * Math.cos(theta)
      positions[i * 3 + 1] = u * 28
      positions[i * 3 + 2] = r * Math.sin(theta)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xfffbeb, size: 0.09, sizeAttenuation: true }),
      ),
    )

    this.scene.add(this.globeGroup)

    // Start with Europe (Rome!) facing the player.
    this.globeGroup.quaternion.copy(
      this.computeFocusQuaternion(latLonToVector3(41.9, 12.5, 1).normalize(), new THREE.Vector3(0, 0.1, 1).normalize()),
    )
  }

  addCityPins(cities: City[]): void {
    for (const city of cities) {
      const basePos = latLonToVector3(city.lat, city.lon, GLOBE_RADIUS).normalize()
      const group = new THREE.Group()
      group.position.copy(basePos).multiplyScalar(GLOBE_RADIUS)
      // Orient the pin so its +Y axis points away from the globe center.
      group.quaternion.setFromUnitVectors(Y_AXIS, basePos)

      const open = city.status === 'open'
      const headColor = open ? 0xf59e0b : 0xfffbeb
      const stemColor = open ? 0xef4444 : 0x94a3b8

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.016, 0.07, 10),
        new THREE.MeshPhongMaterial({ color: stemColor }),
      )
      stem.position.y = 0.035
      group.add(stem)

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(open ? 0.042 : 0.03, 20, 16),
        new THREE.MeshPhongMaterial({
          color: headColor,
          emissive: open ? 0xb45309 : 0x334155,
          emissiveIntensity: open ? 0.35 : 0.15,
          shininess: 60,
        }),
      )
      head.position.y = 0.095
      group.add(head)

      // Pulsing base ring — only for playable cities (visual "tap me!")
      let ring: THREE.Mesh | null = null
      if (open) {
        ring = new THREE.Mesh(
          new THREE.RingGeometry(0.05, 0.075, 32),
          new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.004
        group.add(ring)
      }

      // Invisible oversized hit sphere — the 3D equivalent of the 48px
      // tap-target rule. Raycasts hit this, not the tiny visible head.
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 6),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      )
      hit.position.y = 0.07
      hit.userData.cityId = city.id
      group.add(hit)

      this.globeGroup.add(group)
      this.pins.push({ city, group, head, ring, hit, basePos })
    }
  }

  registerLabel(cityId: string, el: HTMLElement | null): void {
    if (el) this.labelEls.set(cityId, el)
    else this.labelEls.delete(cityId)
  }

  /* -- interaction ------------------------------------------------------- */

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerCancel)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  private onPointerDown = (e: PointerEvent): void => {
    // Ignore drags while a zoom tween is flying — prevents fighting the camera.
    if (this.focusTween) return
    this.canvas.setPointerCapture(e.pointerId)
    this.pointerDown = true
    this.downAt = performance.now()
    this.downX = this.lastX = e.clientX
    this.downY = this.lastY = e.clientY
    this.velX = 0
    this.velY = 0
    this.lastInteraction = performance.now()
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown) return
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.applySpin(dx * DRAG_SPEED, dy * DRAG_SPEED)
    // Track velocity for inertia (light smoothing keeps flicks lively).
    this.velX = this.velX * 0.4 + dx * DRAG_SPEED * 0.6
    this.velY = this.velY * 0.4 + dy * DRAG_SPEED * 0.6
    this.lastInteraction = performance.now()
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointerDown) return
    this.pointerDown = false
    this.lastInteraction = performance.now()

    const elapsed = performance.now() - this.downAt
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY)
    if (elapsed < TAP_MAX_MS && moved < TAP_MAX_MOVE_PX) {
      this.velX = 0
      this.velY = 0
      this.handleTap(e.clientX, e.clientY)
    }
    // else: velX/velY carry into inertia in tick()
  }

  private onPointerCancel = (): void => {
    this.pointerDown = false
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.rafId)
      this.clock.stop()
    } else if (!this.disposed) {
      this.clock.start()
      this.rafId = requestAnimationFrame(this.tick)
    }
  }

  private applySpin(yaw: number, pitch: number): void {
    // World-axis rotations = the globe follows the finger like a real ball.
    this.globeGroup.rotateOnWorldAxis(Y_AXIS, yaw)
    this.globeGroup.rotateOnWorldAxis(X_AXIS, pitch)
  }

  private handleTap(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObjects(
      this.pins.map((p) => p.hit),
      false,
    )
    if (hits.length === 0) return

    const cityId = hits[0].object.userData.cityId as string
    const pin = this.pins.find((p) => p.city.id === cityId)
    if (!pin) return

    // Only front-facing pins are tappable (back-side hits feel like bugs).
    const worldDir = pin.basePos.clone().applyQuaternion(this.globeGroup.quaternion)
    if (worldDir.z < 0.05) return

    this.callbacks.onCityTap(pin.city)
  }

  /* -- focus / zoom tweens ------------------------------------------------ */

  /**
   * Rotation that brings `surfaceDir` (unit, globe-local) to `frontDir`
   * while keeping the north pole pointing up — so the zoom never leaves
   * the globe at a disorienting tilt.
   */
  private computeFocusQuaternion(
    surfaceDir: THREE.Vector3,
    frontDir: THREE.Vector3,
  ): THREE.Quaternion {
    const q1 = new THREE.Quaternion().setFromUnitVectors(surfaceDir, frontDir)

    // Roll correction: keep "up" up after the shortest-arc rotation.
    const north = new THREE.Vector3(0, 1, 0).applyQuaternion(q1)
    const northProj = north.clone().addScaledVector(frontDir, -north.dot(frontDir))
    const up = new THREE.Vector3(0, 1, 0)
    const upProj = up.clone().addScaledVector(frontDir, -up.dot(frontDir))
    if (northProj.lengthSq() > 1e-8 && upProj.lengthSq() > 1e-8) {
      northProj.normalize()
      upProj.normalize()
      const angle = Math.atan2(
        new THREE.Vector3().crossVectors(northProj, upProj).dot(frontDir),
        northProj.dot(upProj),
      )
      const q2 = new THREE.Quaternion().setFromAxisAngle(frontDir, angle)
      q1.premultiply(q2)
    }
    return q1
  }

  focusCity(city: City): void {
    const pin = this.pins.find((p) => p.city.id === city.id)
    if (!pin || this.focusTween) return
    this.velX = 0
    this.velY = 0
    this.focusTween = {
      fromQ: this.globeGroup.quaternion.clone(),
      toQ: this.computeFocusQuaternion(pin.basePos, FOCUS_DIRECTION),
      fromZ: this.camera.position.z,
      toZ: CAM_NEAR_Z,
      start: performance.now(),
      city,
    }
  }

  resetView(): void {
    if (this.focusTween) return
    this.focusedCity = null
    this.focusTween = {
      fromQ: this.globeGroup.quaternion.clone(),
      toQ: this.globeGroup.quaternion.clone(), // keep rotation, just dolly out
      fromZ: this.camera.position.z,
      toZ: CAM_FAR_Z,
      start: performance.now(),
      city: null,
    }
  }

  /* -- frame loop --------------------------------------------------------- */

  private tick = (): void => {
    if (this.disposed) return
    const dt = Math.min(this.clock.getDelta(), 1 / 20) // clamp tab-switch jumps
    const now = performance.now()

    // 1) Focus tween
    if (this.focusTween) {
      const t = Math.min((now - this.focusTween.start) / FOCUS_DURATION_MS, 1)
      const k = easeInOutCubic(t)
      this.globeGroup.quaternion.slerpQuaternions(this.focusTween.fromQ, this.focusTween.toQ, k)
      this.camera.position.z =
        this.focusTween.fromZ + (this.focusTween.toZ - this.focusTween.fromZ) * k
      if (t >= 1) {
        const done = this.focusTween
        this.focusTween = null
        if (done.city) {
          this.focusedCity = done.city
          this.callbacks.onCityFocused(done.city)
        }
      }
    } else if (!this.pointerDown) {
      // 2) Inertia after a flick
      if (Math.abs(this.velX) > MIN_VELOCITY || Math.abs(this.velY) > MIN_VELOCITY) {
        this.applySpin(this.velX, this.velY)
        this.velX *= INERTIA_DAMPING
        this.velY *= INERTIA_DAMPING
      } else if (!this.focusedCity && now - this.lastInteraction > IDLE_DELAY_MS) {
        // 3) Gentle idle spin invites the next spin
        this.globeGroup.rotateOnWorldAxis(Y_AXIS, IDLE_SPIN_SPEED * dt)
      }
    }

    // 4) Pin pulse animation
    const pulse = 1 + 0.18 * Math.sin(this.clock.elapsedTime * 3.2)
    for (const pin of this.pins) {
      if (pin.ring) {
        pin.ring.scale.setScalar(pulse)
        ;(pin.ring.material as THREE.MeshBasicMaterial).opacity =
          0.45 + 0.35 * Math.sin(this.clock.elapsedTime * 3.2)
      }
      if (pin.city.status === 'open') {
        pin.head.scale.setScalar(1 + 0.08 * Math.sin(this.clock.elapsedTime * 3.2))
      }
    }

    // 5) DOM labels follow their pins
    this.updateLabels()

    this.renderer.render(this.scene, this.camera)
    this.rafId = requestAnimationFrame(this.tick)
  }

  private labelWorldPos = new THREE.Vector3()

  private updateLabels(): void {
    const rect = this.container.getBoundingClientRect()
    for (const pin of this.pins) {
      const el = this.labelEls.get(pin.city.id)
      if (!el) continue

      this.labelWorldPos
        .copy(pin.basePos)
        .multiplyScalar(GLOBE_RADIUS + 0.11)
        .applyQuaternion(this.globeGroup.quaternion)

      const facing = this.labelWorldPos.clone().normalize().z
      if (facing < 0.18) {
        el.style.opacity = '0'
        el.style.pointerEvents = 'none'
        continue
      }

      const projected = this.labelWorldPos.clone().project(this.camera)
      const x = ((projected.x + 1) / 2) * rect.width
      const y = ((1 - projected.y) / 2) * rect.height
      const opacity = Math.min((facing - 0.18) / 0.3, 1)
      el.style.opacity = opacity.toFixed(2)
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`
    }
  }

  private handleResize(): void {
    const { clientWidth, clientHeight } = this.container
    if (clientWidth === 0 || clientHeight === 0) return
    this.renderer.setSize(clientWidth, clientHeight, false)
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
  }

  /* -- teardown ----------------------------------------------------------- */

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel)
    document.removeEventListener('visibilitychange', this.onVisibility)

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of mats) {
          if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose()
          m.dispose()
        }
      }
    })
    this.renderer.dispose()
  }
}
