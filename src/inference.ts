import * as ort from 'onnxruntime-web'
import type { Diagnosis, GeneratedStep, ModelConfig, Visit } from './types'

let sessionPromise: Promise<ort.InferenceSession> | null = null

function int64(values: number[], dims: readonly number[]): ort.Tensor {
  return new ort.Tensor('int64', BigInt64Array.from(values, BigInt), dims)
}

function float32(values: number[], dims: readonly number[]): ort.Tensor {
  return new ort.Tensor('float32', Float32Array.from(values), dims)
}

function boolTensor(values: boolean[], dims: readonly number[]): ort.Tensor {
  return new ort.Tensor('bool', Uint8Array.from(values, (value) => (value ? 1 : 0)), dims)
}

function softmax(values: number[]): number[] {
  const maximum = Math.max(...values)
  const exponents = values.map((value) => Math.exp(value - maximum))
  const total = exponents.reduce((sum, value) => sum + value, 0)
  return exponents.map((value) => value / total)
}

function sigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value))
  const exp = Math.exp(value)
  return exp / (1 + exp)
}

function topIndices(values: number[], count: number, minimumId = 0): number[] {
  return values
    .map((value, index) => ({ value, index }))
    .filter(({ index }) => index >= minimumId)
    .sort((left, right) => right.value - left.value)
    .slice(0, count)
    .map(({ index }) => index)
}

function ageZ(age: number, config: ModelConfig): number {
  return (age - config.normalization.age_mean) / config.normalization.age_std
}

function intervalZ(days: number, config: ModelConfig): number {
  return (Math.log1p(days) - config.normalization.dt_log_mean) / config.normalization.dt_log_std
}

function tensorSlice(data: ort.Tensor['data'], offset: number, length: number): number[] {
  const output: number[] = []
  for (let index = offset; index < offset + length; index += 1) output.push(Number(data[index]))
  return output
}

async function createSession(modelUrl: string): Promise<ort.InferenceSession> {
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = true
  return ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
}

export function loadModel(modelUrl: string): Promise<ort.InferenceSession> {
  if (!sessionPromise) sessionPromise = createSession(modelUrl)
  return sessionPromise
}

interface FutureState {
  dt: number[]
  dtCont: number[]
  primary: number[]
  secondary: number[]
  secondaryMask: boolean[]
  ages: number[]
  visitMask: boolean[]
}

function buildFeeds(visits: Visit[], gender: number, config: ModelConfig, future: FutureState) {
  const maxHistory = config.model_dimensions.max_history
  const maxFuture = config.model_dimensions.max_future
  const maxSecondary = config.model_dimensions.max_secondary
  const history = visits.slice(-maxHistory)

  const histDt = Array(maxHistory).fill(config.special_tokens.time_padding)
  const histDtCont = Array(maxHistory).fill(0)
  const histPrimary = Array(maxHistory).fill(config.special_tokens.padding)
  const histSecondary = Array(maxHistory * maxSecondary).fill(config.special_tokens.padding)
  const histSecondaryMask = Array(maxHistory * maxSecondary).fill(false)
  const histAge = Array(maxHistory).fill(0)
  const histVisitMask = Array(maxHistory).fill(false)

  history.forEach((visit, visitIndex) => {
    const bucket = config.time_buckets.find((item) => item.id === visit.intervalBucket) ?? config.time_buckets[0]
    histDt[visitIndex] = visit.intervalBucket
    histDtCont[visitIndex] = intervalZ(bucket.median_days, config)
    histPrimary[visitIndex] = visit.primary?.id ?? config.special_tokens.unknown
    histAge[visitIndex] = ageZ(visit.age, config)
    histVisitMask[visitIndex] = true
    visit.secondary.slice(0, maxSecondary).forEach((diagnosis, secondaryIndex) => {
      const position = visitIndex * maxSecondary + secondaryIndex
      histSecondary[position] = diagnosis.id
      histSecondaryMask[position] = true
    })
  })

  return {
    info_age_z: float32([ageZ(history[0].age, config)], [1]),
    info_gender: int64([gender], [1]),
    hist_dt: int64(histDt, [1, maxHistory]),
    hist_dt_cont: float32(histDtCont, [1, maxHistory]),
    hist_primary: int64(histPrimary, [1, maxHistory]),
    hist_secondary: int64(histSecondary, [1, maxHistory, maxSecondary]),
    hist_secondary_mask: boolTensor(histSecondaryMask, [1, maxHistory, maxSecondary]),
    hist_age_z: float32(histAge, [1, maxHistory]),
    hist_visit_mask: boolTensor(histVisitMask, [1, maxHistory]),
    fut_dt: int64(future.dt, [1, maxFuture]),
    fut_dt_cont: float32(future.dtCont, [1, maxFuture]),
    fut_primary: int64(future.primary, [1, maxFuture]),
    fut_secondary: int64(future.secondary, [1, maxFuture, maxSecondary]),
    fut_secondary_mask: boolTensor(future.secondaryMask, [1, maxFuture, maxSecondary]),
    fut_age_z: float32(future.ages, [1, maxFuture]),
    fut_visit_mask: boolTensor(future.visitMask, [1, maxFuture]),
  }
}

export async function generateTrajectory(
  visits: Visit[],
  gender: number,
  config: ModelConfig,
  diagnoses: Diagnosis[],
): Promise<GeneratedStep[]> {
  if (!visits.length || !visits.every((visit) => visit.primary)) {
    throw new Error('请完整填写每次住院的主要诊断。')
  }

  const session = await loadModel(`/model/${config.model_file}`)
  const diagnosisById = new Map(diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]))
  const futureLength = config.model_dimensions.max_future
  const secondaryLength = config.model_dimensions.max_secondary
  const future: FutureState = {
    dt: Array(futureLength).fill(0),
    dtCont: Array(futureLength).fill(0),
    primary: Array(futureLength).fill(config.special_tokens.padding),
    secondary: Array(futureLength * secondaryLength).fill(config.special_tokens.padding),
    secondaryMask: Array(futureLength * secondaryLength).fill(false),
    ages: Array(futureLength).fill(0),
    visitMask: Array(futureLength).fill(false),
  }

  const results: GeneratedStep[] = []
  let currentAge = visits[visits.length - 1].age

  for (let step = 0; step < futureLength; step += 1) {
    const output = await session.run(buildFeeds(visits, gender, config, future))
    const timeLogits = tensorSlice(output.time_logits.data, step * 8, 8)
    timeLogits[0] = Number.NEGATIVE_INFINITY
    const timeProbabilities = softmax(timeLogits)
    const intervalId = topIndices(timeProbabilities, 1, 1)[0]
    const interval = config.time_buckets.find((item) => item.id === intervalId)!

    const vocabularySize = config.model_dimensions.diagnosis_vocabulary
    const primaryLogits = tensorSlice(output.primary_logits.data, step * vocabularySize, vocabularySize)
    primaryLogits[0] = Number.NEGATIVE_INFINITY
    primaryLogits[1] = Number.NEGATIVE_INFINITY
    const primaryProbabilities = softmax(primaryLogits)
    const primaryIds = topIndices(primaryProbabilities, 5, 2)
    const primary = diagnosisById.get(primaryIds[0])
    if (!primary) throw new Error('模型返回了无法识别的主要诊断。')

    const secondaryLogits = tensorSlice(output.secondary_logits.data, step * vocabularySize, vocabularySize)
    const secondaryCandidates = secondaryLogits
      .map((value, id) => ({ id, probability: sigmoid(value) }))
      .filter(({ id, probability }) => id >= 2 && probability >= config.secondary_threshold)
      .sort((left, right) => right.probability - left.probability)
      .slice(0, secondaryLength)
      .flatMap(({ id, probability }) => {
        const diagnosis = diagnosisById.get(id)
        return diagnosis ? [{ diagnosis, probability }] : []
      })

    currentAge += interval.median_days / 365.2425
    const primaryTop5 = primaryIds.flatMap((id) => {
      const diagnosis = diagnosisById.get(id)
      return diagnosis ? [{ diagnosis, probability: primaryProbabilities[id] }] : []
    })

    results.push({
      step: step + 1,
      age: currentAge,
      interval,
      intervalProbabilities: timeProbabilities.slice(1).map((probability, index) => ({
        id: index + 1,
        probability,
      })),
      primary,
      primaryProbability: primaryProbabilities[primary.id],
      primaryTop5,
      secondary: secondaryCandidates,
    })

    future.dt[step] = interval.id
    future.dtCont[step] = intervalZ(interval.median_days, config)
    future.primary[step] = primary.id
    future.ages[step] = ageZ(currentAge, config)
    future.visitMask[step] = true
    secondaryCandidates.forEach(({ diagnosis }, secondaryIndex) => {
      const position = step * secondaryLength + secondaryIndex
      future.secondary[position] = diagnosis.id
      future.secondaryMask[position] = true
    })
  }

  return results
}
