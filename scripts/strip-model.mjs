import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'

const model = new URL('../dist/model/hosptrajformer_v7.onnx', import.meta.url)

if (existsSync(model)) {
  await rm(model)
  console.log('Removed local ONNX model from dist; production loads it from VITE_MODEL_URL (R2).')
} else {
  console.log('No local ONNX model in dist; expecting VITE_MODEL_URL (R2).')
}
