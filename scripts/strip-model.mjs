import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'

const model = new URL('../dist/model/hosptrajformer_v7.onnx', import.meta.url)

if (existsSync(model)) {
  await rm(model)
  console.log('Removed local ONNX model from dist; Pages loads model chunks from /model/chunks/.')
} else {
  console.log('No local ONNX model in dist; using /model/chunks/.')
}
