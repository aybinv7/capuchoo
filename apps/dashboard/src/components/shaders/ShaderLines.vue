<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const containerRef = ref<HTMLDivElement | null>(null)

let scene: any, camera: any, renderer: any, uniforms: any
let animationId: number | null = null

const initThreeJS = (THREE: any) => {
  if (!containerRef.value) return
  const container = containerRef.value
  container.innerHTML = ''

  // Camera
  camera = new THREE.Camera()
  camera.position.z = 1

  // Scene
  scene = new THREE.Scene()

  // Geometry
  const geometry = new THREE.PlaneBufferGeometry(2, 2)

  // Uniforms
  uniforms = {
    time: { type: 'f', value: 1.0 },
    resolution: { type: 'v2', value: new THREE.Vector2() },
  }

  // Shaders
  const vertexShader = `
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  `
  const fragmentShader = `
    #define TWO_PI 6.2831853072
    #define PI 3.14159265359

    precision highp float;
    uniform vec2 resolution;
    uniform float time;

    float random (in float x) {
        return fract(sin(x)*1e4);
    }
    float random (vec2 st) {
        return fract(sin(dot(st.xy,
                             vec2(12.9898,78.233)))*
            43758.5453123);
    }

    varying vec2 vUv;

    void main(void) {
      vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

      vec2 fMosaicScal = vec2(4.0, 2.0);
      vec2 vScreenSize = vec2(256,256);
      uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
      uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

      float t = time*0.06+random(uv.x)*0.4;
      float lineWidth = 0.0008;

      vec3 color = vec3(0.0);
      for(int j = 0; j < 3; j++){
        for(int i=0; i < 5; i++){
          color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*1.0 - length(uv));
        }
      }

      gl_FragColor = vec4(color[2],color[1],color[0],1.0);
    }
  `

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
  })

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  // Renderer
  renderer = new THREE.WebGLRenderer()
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  // Resize
  const onWindowResize = () => {
    const rect = container.getBoundingClientRect()
    renderer.setSize(rect.width, rect.height)
    uniforms.resolution.value.x = renderer.domElement.width
    uniforms.resolution.value.y = renderer.domElement.height
  }

  window.addEventListener('resize', onWindowResize)
  onWindowResize()

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    uniforms.time.value += 0.05
    renderer.render(scene, camera)
  }
  animate()
}

onMounted(async () => {
  // Option 1: Load from CDN dynamically
  const script = document.createElement('script')
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/89/three.min.js'
  script.onload = () => initThreeJS((window as any).THREE)
  document.head.appendChild(script)
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) renderer.dispose()
})
</script>

<template>
  <div ref="containerRef" class="absolute w-full h-full"></div>
</template>

<style scoped>
div {
  overflow: hidden;
}
</style>
