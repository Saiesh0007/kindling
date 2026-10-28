// Copies the MediaPipe WASM runtime into public/ so the webcam lens works fully offline.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const src = 'node_modules/@mediapipe/tasks-vision/wasm'
const out = 'public/mediapipe/wasm'
mkdirSync(out, { recursive: true })
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  if (!existsSync(join(out, f))) copyFileSync(join(src, f), join(out, f))
}
