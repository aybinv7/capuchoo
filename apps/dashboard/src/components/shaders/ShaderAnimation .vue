<template>
  <div ref="containerRef" class="w-full h-screen" style="background: #000; overflow: hidden"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'

const containerRef = ref<HTMLDivElement | null>(null)

let animationId = 0
let camera: THREE.Camera
let scene: THREE.Scene
let renderer: THREE.WebGLRenderer
let uniforms: { time: { value: number }; resolution: { value: THREE.Vector2 } }
let geometry: THREE.PlaneGeometry
let material: THREE.ShaderMaterial

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  // Vertex Shader
  const vertexShader = `
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  `

  // Fragment Shader
  const fragmentShader = `
    #define TWO_PI 6.2831853072
    #define PI 3.14159265359

    precision highp float;
    uniform vec2 resolution;
    uniform float time;

    void main(void) {
      vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
      float t = time * 0.05;
      float lineWidth = 0.002;

      vec3 color = vec3(0.0);
      for (int j = 0; j < 3; j++) {
        for (int i = 0; i < 5; i++) {
          color[j] += lineWidth * float(i * i) /
            abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
        }
      }

      gl_FragColor = vec4(color[0], color[1], color[2], 1.0);
    }
  `

  // Setup scene
  camera = new THREE.Camera()
  camera.position.z = 1

  scene = new THREE.Scene()
  geometry = new THREE.PlaneGeometry(2, 2)

  uniforms = {
    time: { value: 1.0 },
    resolution: { value: new THREE.Vector2() },
  }

  material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  })

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  // Resize handler
  const onWindowResize = () => {
    const width = container.clientWidth
    const height = container.clientHeight
    renderer.setSize(width, height)
    uniforms.resolution.value.x = renderer.domElement.width
    uniforms.resolution.value.y = renderer.domElement.height
  }

  // Initial resize
  onWindowResize()
  window.addEventListener('resize', onWindowResize)

  // Animation loop
  const animate = () => {
    animationId = requestAnimationFrame(animate)
    uniforms.time.value += 0.05
    renderer.render(scene, camera)
  }

  animate()

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize)
    cancelAnimationFrame(animationId)

    if (container && renderer.domElement) {
      container.removeChild(renderer.domElement)
    }

    renderer.dispose()
    geometry.dispose()
    material.dispose()
  })
})
</script>

<style scoped>
/* Optional: You can use Tailwind or custom styles */
</style>
