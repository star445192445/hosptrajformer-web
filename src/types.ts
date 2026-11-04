export interface Diagnosis {
  id: number
  code: string
  chapter: string
  frequency: number
}

export interface TimeBucket {
  id: number
  label: string
  median_days: number
}

export interface ModelConfig {
  display_name: string
  model_version: string
  model_file: string
  model_dimensions: {
    diagnosis_vocabulary: number
    embedding: number
    max_history: number
    max_future: number
    max_secondary: number
  }
  normalization: {
    age_mean: number
    age_std: number
    dt_log_mean: number
    dt_log_std: number
  }
  special_tokens: {
    unknown: number
    padding: number
    time_padding: number
  }
  secondary_threshold: number
  time_buckets: TimeBucket[]
}

export interface Visit {
  uid: string
  age: number
  intervalDays: number
  primary: Diagnosis | null
  secondary: Diagnosis[]
}

export interface ProbabilityItem {
  id: number
  probability: number
}

export interface PrimaryCandidate {
  diagnosis: Diagnosis
  probability: number
}

export interface SecondaryCandidate {
  diagnosis: Diagnosis
  probability: number
}

export interface GeneratedStep {
  step: number
  age: number
  intervalDays: number
  interval: TimeBucket
  intervalProbabilities: ProbabilityItem[]
  primary: Diagnosis
  primaryProbability: number
  primaryTop5: PrimaryCandidate[]
  secondary: SecondaryCandidate[]
  entropy: number
}

export interface Trajectory {
  id: number
  steps: GeneratedStep[]
}

export interface PathSummary {
  key: string
  label: string
  count: number
  share: number
  steps: GeneratedStep[]
}

export interface MonteCarloResult {
  trajectories: Trajectory[]
  paths: PathSummary[]
  stepCount: number
  samples: number
}

export interface CaseDefinition {
  id: string
  title: string
  subtitle: string
  gender: number
  note: string
  visits: Array<{
    age: number
    intervalDays: number
    primary: string
    secondary: string[]
  }>
}

export type ModelStatus = 'loading' | 'ready' | 'running' | 'error'
export type DecodingMode = 'greedy' | 'sample'
