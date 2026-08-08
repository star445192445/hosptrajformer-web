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
  intervalBucket: number
  primary: Diagnosis | null
  secondary: Diagnosis[]
}

export interface ProbabilityItem {
  id: number
  probability: number
}

export interface GeneratedStep {
  step: number
  age: number
  interval: TimeBucket
  intervalProbabilities: ProbabilityItem[]
  primary: Diagnosis
  primaryProbability: number
  primaryTop5: Array<{ diagnosis: Diagnosis; probability: number }>
  secondary: Array<{ diagnosis: Diagnosis; probability: number }>
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'
