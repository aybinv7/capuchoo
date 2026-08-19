<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl'

// Props interface
interface GradientMeshProps {
  colors?: string[]
  distortion?: number
  swirl?: number
  speed?: number
  scale?: number
  offsetX?: number
  offsetY?: number
  rotation?: number
  waveAmp?: number
  waveFreq?: number
  waveSpeed?: number
  grain?: number
}

// Default props
const props = withDefaults(defineProps<GradientMeshProps>(), {
  colors: () => ['#ff0000', '#cc0000', '#990000'], // Red gradient as default
  distortion: 5,
  swirl: 0.5,
  speed: 1.0,
  scale: 1,
  offsetX: 0.0,
  offsetY: 0.0,
  rotation: 90,
  waveAmp: 0.1,
  waveFreq: 10.0,
  waveSpeed: 0.2,
  grain: 0.06,
})

// Vertex shader
const vert = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`

// Fragment shader
const frag = (distortion: number) => `
precision highp float;
uniform float uTime;
uniform float uSwirl;
uniform float uSpeed;
uniform float uScale;
uniform float uOffsetX;
uniform float uOffsetY;
uniform float uRotation;
uniform float uWaveAmp;
uniform float uWaveFreq;
uniform float uWaveSpeed;
uniform float uGrain;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uResolution;
varying vec2 vUv;
float wave(vec2 uv, float freq, float speed, float time) {
  return sin(uv.x * freq + time * speed) * cos(uv.y * freq + time * speed);
}
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
vec3 colorDodge(vec3 base, vec3 blend) {
  return min(base / (1.0 - blend + 0.0001), 1.0);
}
void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;
  uv = uv * uScale + vec2(uOffsetX, uOffsetY);
  float cosR = cos(uRotation);
  float sinR = sin(uRotation);
  uv = vec2(uv.x * cosR - uv.y * sinR, uv.x * sinR + uv.y * cosR);
  uv.x += wave(uv, uWaveFreq, uWaveSpeed, uTime) * uWaveAmp;
  uv.y += wave(uv + 10.0, uWaveFreq * 1.5, uWaveSpeed * 0.8, uTime) * uWaveAmp * 0.5;
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  angle += uSwirl * radius;
  uv = vec2(cos(angle), sin(angle)) * radius;
  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < ${distortion.toFixed(1)}; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  float mix1 = (sin(d) + 1.0) * 0.5;
  float mix2 = (cos(a) + 1.0) * 0.5;
  vec3 col = mix(uColorA, uColorB, mix1);
  col = mix(col, uColorC, mix2);
  float grain = (random(gl_FragCoord.xy + uTime) - 0.5) * uGrain;
  vec3 grainCol = vec3(0.5 + grain);
  col = colorDodge(col, grainCol);
  gl_FragColor = vec4(col, 1.0);
}
`

// Reactive references
const container = ref<HTMLDivElement | null>(null)
let renderer: any = null
let gl: any = null
let program: any = null
let mesh: any = null
let animId: number | null = null

const init = () => {
  const ctn = container.value
  if (!ctn) return

  renderer = new Renderer()
  gl = renderer.gl
  gl.clearColor(0, 0, 0, 1)

  const resize = () => renderer.setSize(ctn.offsetWidth, ctn.offsetHeight)
  window.addEventListener('resize', resize)
  resize()

  const geometry = new Triangle(gl)

  // Initialize uniforms with fixed red gradient colors
  const uniforms: Record<string, any> = {
    uTime: { value: 0 },
    uSwirl: { value: props.swirl },
    uSpeed: { value: props.speed },
    uScale: { value: props.scale },
    uOffsetX: { value: props.offsetX },
    uOffsetY: { value: props.offsetY },
    uRotation: { value: props.rotation },
    uWaveAmp: { value: props.waveAmp },
    uWaveFreq: { value: props.waveFreq },
    uWaveSpeed: { value: props.waveSpeed },
    uResolution: {
      value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height),
    },
    uGrain: { value: props.grain },
    uColorA: { value: new Float32Array([0.788, 0.34, 0.0]) }, // #BC6C25
    uColorB: { value: new Float32Array([0.682, 0.347, 0.0]) }, // #DDA15E
    uColorC: { value: new Float32Array([0.396, 0.263, 0.129]) }, // #606C38
  }

  program = new Program(gl, {
    vertex: vert,
    fragment: frag(props.distortion),
    uniforms,
  })

  mesh = new Mesh(gl, { geometry, program })

  const update = (t: number) => {
    if (animId !== null) {
      animId = requestAnimationFrame(update)
      program.uniforms.uTime.value = t * 0.001
      renderer.render({ scene: mesh })
    }
  }

  animId = requestAnimationFrame(update)
  ctn.appendChild(gl.canvas)

  return { resize }
}

onMounted(() => {
  const { resize } = init() || {}

  onBeforeUnmount(() => {
    if (animId !== null) {
      cancelAnimationFrame(animId)
    }
    if (resize) {
      window.removeEventListener('resize', resize)
    }
    if (container.value && gl.canvas.parentNode) {
      ;(gl.canvas.parentNode as HTMLElement).removeChild(gl.canvas)
    }
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  })
})
</script>

<template>
  <div ref="container" style="width: 100%; height: 100%; position: absolute; overflow: hidden" />
</template>
