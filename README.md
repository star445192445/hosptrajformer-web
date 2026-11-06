# HospTrajFormer Web

HospTrajFormer 多步住院轨迹生成研究演示。前端使用 React + TypeScript，通过 ONNX Runtime Web 在浏览器本地运行 V7 模型；无后端、无上传、无持久化。

## 公开版（Cloudflare Pages + R2）

- 首次进入显示研究演示与隐私确认页；无账号、无保存、无 LocalStorage；
- 前端部署到 Cloudflare Pages；ONNX 模型放在 Cloudflare R2 公共桶（Pages 单文件上限 25 MiB，模型约 29.9 MiB）；
- 模型地址通过构建环境变量 `VITE_MODEL_URL` 注入；本地开发留空时回退到 `public/model/hosptrajformer_v7.onnx`；
- 生产构建使用 `pnpm build:pages`，会从 `dist/` 删除本地 ONNX 文件，避免超过 Pages 限制。

部署步骤见 [`README_DEPLOY.md`](README_DEPLOY.md)，CORS 模板见 [`deploy/r2-cors.json`](deploy/r2-cors.json)。

## 当前版本（v2 重做）

- 时间轴式住院历史编辑：连续年龄、实际住院间隔天数、主要诊断检索、次要诊断集合；
- 历史间隔按实际天数编码，与离线推理脚本 `visit.dt_days` 口径一致（旧版用时间桶中位数，已修正）；
- 两种解码：逐步贪心（一条确定性轨迹）与 Monte Carlo 概率抽样（多条候选轨迹，固定种子可复现）；
- 结果展示：三步轨迹扇形图、候选路径频次表、各步骤时间桶/主要诊断/次要诊断分布、平均预测熵；
- 研究演示边界：隐私确认、模型卡、阅读指南、结果免责声明、技术验证面板。

## 本地运行

```bash
pnpm install
pnpm run dev
```

构建与预览：

```bash
pnpm run build
pnpm run preview
```

生产（Pages）构建：

```bash
pnpm run build:pages
```

演示快捷参数：

- `?demo=sample&samples=20`：自动生成 20 条候选轨迹；
- `?demo=greedy`：自动生成一条逐步贪心轨迹。

## 模型文件

- `public/model/hosptrajformer_v7.onnx`：本地开发用模型（不提交 Git，不进入 Pages 构建）；
- `public/model/config.json`：词表规模、标准化参数、时间桶与次要诊断阈值；
- `public/model/diagnoses.json`：5,404 个 ICD-3 诊断编码与训练频次；
- `public/model/validation.json`：PyTorch 与 ONNX Runtime 的一致性记录。

## 已知差异与待办

1. 历史侧连续时间已按实际间隔天数编码；候选轨迹递归时仍使用所抽时间桶的中位天数，未使用离线分析中的经验间隔池，因此连续天数与离线概率抽样存在差异，离散时间桶与主要诊断序列口径一致。
2. 现有 `validation.json` 只覆盖 8 组合成张量的 PyTorch 与桌面 ONNX 输出，尚未覆盖网页预处理、抽样与逐例在线—离线一致性；正式写入论文前需补逐例比对脚本。
3. 未开展临床可用性或效用评价；技术验证不等同于临床验证。

## 使用边界

本项目仅用于科研与教学演示，不用于临床诊断、治疗决策或个体预后判断。请勿输入姓名、身份证号、住院号等可识别信息；所有推理在浏览器内完成，输入不离开本机。
