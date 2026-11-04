import * as ort from 'onnxruntime-web'
import type {
  Diagnosis,
  GeneratedStep,
  ModelConfig,
  MonteCarloResult,
  PathSummary,
  PrimaryCandidate,
  SecondaryCandidate,
  TimeBucket,
  Trajectory,
  Visit,
} from './types'

const DAYS_PER_YEAR = 365.2425
const BUCKET_UPPER_BOUNDS = [7, 30, 90, 180, 365, 730]

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

function tensorSlice(data: ort.Tensor['data'], offset: number, length: number): number[] {
  const output: number[] = []
  for (let index = offset; index < offset + length; index += 1) output.push(Number(data[index]))
  return output
}

export function bucketIdForDays(days: number): number {
  const value = Math.max(0, days)
  for (let index = 0; index < BUCKET_UPPER_BOUNDS.length; index += 1) {
    if (value <= BUCKET_UPPER_BOUNDS[index]) return index + 1
  }
  return 7
}

function bucketById(config: ModelConfig, id: number): TimeBucket {
  return config.time_buckets.find((bucket) => bucket.id === id) ?? config.time_buckets[0]
}

function ageZ(age: number, config: ModelConfig): number {
  return (age - config.normalization.age_mean) / config.normalization.age_std
}

function intervalZ(days: number, config: ModelConfig): number {
  return (Math.log1p(Math.max(days, 0)) - config.normalization.dt_log_mean) / config.normalization.dt_log_std
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

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function categorical(random: () => number, probabilities: number[]): number {
  const total = probabilities.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return 0
  let threshold = random() * total
  for (let index = 0; index < probabilities.length; index += 1) {
    threshold -= probabilities[index]
    if (threshold <= 0) return index
  }
  return probabilities.length - 1
}

function entropy(probabilities: number[]): number {
  return probabilities.reduce((sum, value) => (value > 0 ? sum - value * Math.log(value) : sum), 0)
}

interface FutureEvent {
  intervalBucket: number
  intervalDays: number
  primary: Diagnosis
  secondary: SecondaryCandidate[]
  age: number
}

function buildFeeds(
  visits: Visit[],
  gender: number,
  config: ModelConfig,
  prefix: FutureEvent[],
) {
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
    const days = visitIndex === 0 ? 0 : Math.max(1, visit.intervalDays)
    const bucketId = visitIndex === 0 ? 0 : bucketIdForDays(days)
    histDt[visitIndex] = bucketId
    histDtCont[visitIndex] = visitIndex === 0 ? 0 : intervalZ(days, config)
    histPrimary[visitIndex] = visit.primary?.id ?? config.special_tokens.unknown
    histAge[visitIndex] = ageZ(visit.age, config)
    histVisitMask[visitIndex] = true
    visit.secondary.slice(0, maxSecondary).forEach((diagnosis, secondaryIndex) => {
      const position = visitIndex * maxSecondary + secondaryIndex
      histSecondary[position] = diagnosis.id
      histSecondaryMask[position] = true
    })
  })

  const futDt = Array(maxFuture).fill(0)
  const futDtCont = Array(maxFuture).fill(0)
  const futPrimary = Array(maxFuture).fill(config.special_tokens.padding)
  const futSecondary = Array(maxFuture * maxSecondary).fill(config.special_tokens.padding)
  const futSecondaryMask = Array(maxFuture * maxSecondary).fill(false)
  const futAge = Array(maxFuture).fill(0)
  const futVisitMask = Array(maxFuture).fill(false)

  // Match the offline decoder: the current (dummy) target position is marked valid.
  if (prefix.length < maxFuture) futVisitMask[prefix.length] = true

  prefix.forEach((event, index) => {
    futDt[index] = event.intervalBucket
    futDtCont[index] = intervalZ(event.intervalDays, config)
    futPrimary[index] = event.primary.id
    futAge[index] = ageZ(event.age, config)
    futVisitMask[index] = true
    event.secondary.slice(0, maxSecondary).forEach((candidate, secondaryIndex) => {
      const position = index * maxSecondary + secondaryIndex
      futSecondary[position] = candidate.diagnosis.id
      futSecondaryMask[position] = true
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
    fut_dt: int64(futDt, [1, maxFuture]),
    fut_dt_cont: float32(futDtCont, [1, maxFuture]),
    fut_primary: int64(futPrimary, [1, maxFuture]),
    fut_secondary: int64(futSecondary, [1, maxFuture, maxSecondary]),
    fut_secondary_mask: boolTensor(futSecondaryMask, [1, maxFuture, maxSecondary]),
    fut_age_z: float32(futAge, [1, maxFuture]),
    fut_visit_mask: boolTensor(futVisitMask, [1, maxFuture]),
  }
}

interface StepDistribution {
  intervalProbabilities: number[]
  primaryProbabilities: number[]
  secondaryProbabilities: number[]
}

async function stepDistribution(
  session: ort.InferenceSession,
  visits: Visit[],
  gender: number,
  config: ModelConfig,
  prefix: FutureEvent[],
  step: number,
): Promise<StepDistribution> {
  const output = await session.run(buildFeeds(visits, gender, config, prefix))
  const vocabularySize = config.model_dimensions.diagnosis_vocabulary
  const timeLogits = tensorSlice(output.time_logits.data, step * 8, 8)
  timeLogits[0] = Number.NEGATIVE_INFINITY
  const primaryLogits = tensorSlice(output.primary_logits.data, step * vocabularySize, vocabularySize)
  primaryLogits[0] = Number.NEGATIVE_INFINITY
  primaryLogits[1] = Number.NEGATIVE_INFINITY
  const secondaryLogits = tensorSlice(output.secondary_logits.data, step * vocabularySize, vocabularySize)
  return {
    intervalProbabilities: softmax(timeLogits),
    primaryProbabilities: softmax(primaryLogits),
    secondaryProbabilities: secondaryLogits.map((value) => sigmoid(value)),
  }
}

function topPrimary(
  probabilities: number[],
  diagnoses: Diagnosis[],
  count = 5,
): PrimaryCandidate[] {
  const diagnosisById = new Map(diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]))
  return probabilities
    .map((probability, id) => ({ probability, id }))
    .filter(({ id }) => id >= 2)
    .sort((left, right) => right.probability - left.probability)
    .slice(0, count)
    .flatMap(({ id, probability }) => {
      const diagnosis = diagnosisById.get(id)
      return diagnosis ? [{ diagnosis, probability }] : []
    })
}

function secondaryFromThreshold(
  probabilities: number[],
  diagnoses: Diagnosis[],
  threshold: number,
  maximum: number,
): SecondaryCandidate[] {
  const diagnosisById = new Map(diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]))
  return probabilities
    .map((probability, id) => ({ probability, id }))
    .filter(({ id, probability }) => id >= 2 && probability >= threshold)
    .sort((left, right) => right.probability - left.probability)
    .slice(0, maximum)
    .flatMap(({ id, probability }) => {
      const diagnosis = diagnosisById.get(id)
      return diagnosis ? [{ diagnosis, probability }] : []
    })
}

function makeStep(
  step: number,
  age: number,
  bucket: TimeBucket,
  intervalProbabilities: number[],
  primary: Diagnosis,
  primaryProbability: number,
  primaryTop5: PrimaryCandidate[],
  secondary: SecondaryCandidate[],
  entropyValue: number,
): GeneratedStep {
  return {
    step,
    age,
    intervalDays: bucket.median_days,
    interval: bucket,
    intervalProbabilities: intervalProbabilities
      .map((probability, id) => ({ id, probability }))
      .filter(({ id }) => id >= 1),
    primary,
    primaryProbability,
    primaryTop5,
    secondary,
    entropy: entropyValue,
  }
}

export async function runGreedy(
  visits: Visit[],
  gender: number,
  config: ModelConfig,
  diagnoses: Diagnosis[],
): Promise<Trajectory> {
  if (!visits.length || !visits.every((visit) => visit.primary)) {
    throw new Error('请完整填写每次住院的主要诊断。')
  }
  const session = await loadModel(`/model/${config.model_file}`)
  const prefix: FutureEvent[] = []
  const steps: GeneratedStep[] = []
  let currentAge = visits[visits.length - 1].age

  for (let step = 0; step < config.model_dimensions.max_future; step += 1) {
    const distribution = await stepDistribution(session, visits, gender, config, prefix, step)
    const bucketId = distribution.intervalProbabilities
      .map((probability, id) => ({ probability, id }))
      .filter(({ id }) => id >= 1)
      .sort((left, right) => right.probability - left.probability)[0].id
    const bucket = bucketById(config, bucketId)
    const primaryCandidates = topPrimary(distribution.primaryProbabilities, diagnoses)
    if (!primaryCandidates.length) throw new Error('模型未返回可识别的主要诊断。')
    const primary = primaryCandidates[0].diagnosis
    const secondary = secondaryFromThreshold(
      distribution.secondaryProbabilities,
      diagnoses,
      config.secondary_threshold,
      config.model_dimensions.max_secondary,
    )
    const primaryDistribution = distribution.primaryProbabilities.filter((_, id) => id >= 2)
    currentAge += bucket.median_days / DAYS_PER_YEAR
    steps.push(
      makeStep(
        step + 1,
        currentAge,
        bucket,
        distribution.intervalProbabilities,
        primary,
        primaryCandidates[0].probability,
        primaryCandidates,
        secondary,
        entropy(primaryDistribution),
      ),
    )
    prefix.push({
      intervalBucket: bucketId,
      intervalDays: bucket.median_days,
      primary,
      secondary,
      age: currentAge,
    })
  }
  return { id: 0, steps }
}

function sampleStep(
  distribution: StepDistribution,
  ages: number,
  config: ModelConfig,
  diagnoses: Diagnosis[],
  random: () => number,
  step: number,
): { step: GeneratedStep; event: FutureEvent } {
  const intervalIds = distribution.intervalProbabilities
    .map((probability, id) => ({ probability, id }))
    .filter(({ id }) => id >= 1)
  const bucketId = intervalIds[categorical(random, intervalIds.map(({ probability }) => probability))].id
  const bucket = bucketById(config, bucketId)
  const primaryIds = distribution.primaryProbabilities
    .map((probability, id) => ({ probability, id }))
    .filter(({ id }) => id >= 2)
  const primaryId = primaryIds[categorical(random, primaryIds.map(({ probability }) => probability))].id
  const diagnosisById = new Map(diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]))
  const primary = diagnosisById.get(primaryId)
  if (!primary) throw new Error('抽样得到无法识别的主要诊断。')
  const secondary = distribution.secondaryProbabilities
    .map((probability, id) => ({ probability, id }))
    .filter(({ id, probability }) => id >= 2 && random() < probability)
    .sort((left, right) => right.probability - left.probability)
    .slice(0, config.model_dimensions.max_secondary)
    .flatMap(({ id, probability }) => {
      const diagnosis = diagnosisById.get(id)
      return diagnosis ? [{ diagnosis, probability }] : []
    })
  const primaryTop5 = topPrimary(distribution.primaryProbabilities, diagnoses)
  const primaryDistribution = distribution.primaryProbabilities.filter((_, id) => id >= 2)
  const age = ages + bucket.median_days / DAYS_PER_YEAR
  const stepResult = makeStep(
    step + 1,
    age,
    bucket,
    distribution.intervalProbabilities,
    primary,
    distribution.primaryProbabilities[primaryId],
    primaryTop5,
    secondary,
    entropy(primaryDistribution),
  )
  return {
    step: stepResult,
    event: {
      intervalBucket: bucketId,
      intervalDays: bucket.median_days,
      primary,
      secondary,
      age,
    },
  }
}

export async function runMonteCarlo(
  visits: Visit[],
  gender: number,
  config: ModelConfig,
  diagnoses: Diagnosis[],
  samples: number,
  seed: number,
  onProgress?: (completed: number, total: number) => void,
): Promise<MonteCarloResult> {
  if (!visits.length || !visits.every((visit) => visit.primary)) {
    throw new Error('请完整填写每次住院的主要诊断。')
  }
  const session = await loadModel(`/model/${config.model_file}`)
  const random = mulberry32(seed)
  const firstDistribution = await stepDistribution(session, visits, gender, config, [], 0)
  const trajectories: Trajectory[] = []

  for (let sample = 0; sample < samples; sample += 1) {
    const steps: GeneratedStep[] = []
    const prefix: FutureEvent[] = []
    let currentAge = visits[visits.length - 1].age
    for (let step = 0; step < config.model_dimensions.max_future; step += 1) {
      const distribution =
        step === 0
          ? firstDistribution
          : await stepDistribution(session, visits, gender, config, prefix, step)
      const { step: generated, event } = sampleStep(
        distribution,
        currentAge,
        config,
        diagnoses,
        random,
        step,
      )
      currentAge = generated.age
      steps.push(generated)
      prefix.push(event)
    }
    trajectories.push({ id: sample, steps })
    onProgress?.(sample + 1, samples)
  }

  const pathMap = new Map<string, { count: number; steps: GeneratedStep[] }>()
  trajectories.forEach((trajectory) => {
    const key = trajectory.steps.map((step) => step.primary.code).join(' → ')
    const existing = pathMap.get(key)
    if (existing) existing.count += 1
    else pathMap.set(key, { count: 1, steps: trajectory.steps })
  })
  const paths: PathSummary[] = Array.from(pathMap.entries())
    .map(([key, value]) => ({
      key,
      label: key,
      count: value.count,
      share: value.count / trajectories.length,
      steps: value.steps,
    }))
    .sort((left, right) => right.count - left.count)

  return { trajectories, paths, stepCount: config.model_dimensions.max_future, samples }
}
