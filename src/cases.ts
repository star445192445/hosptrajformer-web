import type { CaseDefinition } from './types'

export const CASES: CaseDefinition[] = [
  {
    id: 'child-respiratory',
    title: '儿童反复呼吸道感染',
    subtitle: '低年龄 · 呼吸系统 · 较短间隔',
    gender: 1,
    note: '用于展示低年龄、呼吸系统为主的轨迹；诊断与间隔均为合成示例。',
    visits: [
      { age: 2.4, intervalDays: 0, primary: 'J18.9', secondary: ['J96.9', 'J45.9'] },
      { age: 3.0, intervalDays: 182, primary: 'J44.9', secondary: ['J45.9', 'J18.9'] },
      { age: 3.6, intervalDays: 156, primary: 'J45.9', secondary: ['J44.9', 'J96.9'] },
    ],
  },
  {
    id: 'pregnancy',
    title: '妊娠分娩',
    subtitle: '育龄女性 · 产科 · 规范医疗过程',
    gender: 2,
    note: '产科住院的延续率较低，主要反映规范医疗过程而非疾病进展。',
    visits: [
      { age: 28.6, intervalDays: 0, primary: 'O80.0', secondary: ['Z37.0'] },
      { age: 30.1, intervalDays: 425, primary: 'O80.0', secondary: ['Z37.0', 'O70.0'] },
    ],
  },
  {
    id: 'tumor-followup',
    title: '肿瘤治疗与随访',
    subtitle: '高频复诊 · 治疗相关编码 · 高延续',
    gender: 1,
    note: '第 XXI 章治疗与随访编码占比高，住院间隔短；合成示例。',
    visits: [
      { age: 60.8, intervalDays: 0, primary: 'C34.9', secondary: ['Z51.0', 'Z08.0'] },
      { age: 61.2, intervalDays: 28, primary: 'C34.9', secondary: ['Z51.0', 'Z08.0'] },
      { age: 61.6, intervalDays: 31, primary: 'C34.9', secondary: ['Z51.0', 'Z08.0'] },
      { age: 62.0, intervalDays: 26, primary: 'C34.9', secondary: ['Z51.0'] },
    ],
  },
  {
    id: 'cardio-metabolic',
    title: '心脑血管-代谢共病',
    subtitle: '老年 · 循环与内分泌 · 多系统',
    gender: 1,
    note: '循环系统与内分泌代谢诊断并存，适合观察跨系统候选轨迹。',
    visits: [
      { age: 63.2, intervalDays: 0, primary: 'I63.9', secondary: ['I10.X', 'E11.9'] },
      { age: 64.0, intervalDays: 240, primary: 'I25.9', secondary: ['I10.X', 'E11.9', 'E78.5'] },
      { age: 64.7, intervalDays: 195, primary: 'I50.9', secondary: ['I10.X', 'N18.9'] },
    ],
  },
  {
    id: 'multimorbidity',
    title: '高频多系统共病',
    subtitle: '多次住院 · 诊断负担高 · 多系统',
    gender: 2,
    note: '住院频次与诊断复杂度较高，用于展示候选路径的分散程度。',
    visits: [
      { age: 72.1, intervalDays: 0, primary: 'E11.9', secondary: ['I10.X', 'N18.9'] },
      { age: 72.6, intervalDays: 96, primary: 'I50.9', secondary: ['E11.9', 'I10.X', 'N18.9'] },
      { age: 73.0, intervalDays: 118, primary: 'J44.9', secondary: ['I50.9', 'E11.9'] },
      { age: 73.5, intervalDays: 142, primary: 'N18.9', secondary: ['E11.9', 'I10.X', 'I50.9'] },
    ],
  },
  {
    id: 'injury',
    title: '损伤与骨折',
    subtitle: '中年 · 损伤中毒章节 · 事件驱动',
    gender: 1,
    note: '损伤相关住院多为事件驱动，延续率与慢性病轨迹不同。',
    visits: [
      { age: 45.3, intervalDays: 0, primary: 'S72.0', secondary: ['T14.9'] },
      { age: 45.5, intervalDays: 84, primary: 'S72.0', secondary: ['T14.9', 'M17.9'] },
    ],
  },
]
