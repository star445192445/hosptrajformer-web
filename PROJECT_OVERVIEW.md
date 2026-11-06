# HospTrajFormer Web 项目说明

> 用途：交给 Codex 做代码审核、架构优化和部署复核。  
> 文档版本：2026-11-07  
> 代码版本：`ffc1ba9 Load split ONNX chunks from Pages`

---

## 1. 项目定位

HospTrajFormer Web 是博士课题“基于 Transformer 的患者疾病轨迹生成模型构建、解释与迁移应用研究”的**研究演示页面**，不是医疗器械，也不是面向患者的临床产品。

核心目标：

- 让用户输入或选择一段历史住院轨迹；
- 在浏览器内运行 HospTrajFormer V7 ONNX 模型；
- 生成未来 1～3 次住院的时间间隔、主要诊断和次要诊断候选；
- 用轨迹图、路径频次表和逐步分布展示不确定性；
- 全程不上传、不保存用户输入。

明确边界：

- 不提供诊断、治疗、预后或临床决策建议；
- 输出是统计候选轨迹，不是个体化预测结论；
- 不宣称模型可用于真实临床场景；
- 公开演示只建议使用合成或脱敏病例。

---

## 2. 仓库与线上地址

GitHub：

```text
https://github.com/star445192445/hosptrajformer-web
```

线上地址：

```text
https://<实际 Pages 域名>
```

本地开发：

```text
http://127.0.0.1:4173 / 4177（vite preview）
```

> 线上域名请在实际部署后补填；当前代码按 Cloudflare Pages 静态站点设计。

---

## 3. 用户流程

```text
首次进入
  → 研究演示与隐私确认页
  → 勾选确认
  → 选择合成病例，或手动编辑住院轨迹
  → 选择解码方式：概率抽样 / 逐步贪心
  → 生成未来三步候选
  → 查看轨迹扇形图、候选路径表、逐步分布
  → 阅读“如何阅读这些结果”和免责声明
```

输入内容：

- 性别；
- 每次住院的入院年龄；
- 距前次住院的间隔天数；
- 主要诊断（ICD 编码）；
- 次要诊断集合（最多 5 个）。

---

## 4. 系统架构

```text
浏览器
  ├─ React 19 + TypeScript + Vite 8
  ├─ 静态页面（Cloudflare Pages）
  ├─ ONNX Runtime Web 1.22（wasm）
  └─ 模型分片
       ├─ /model/chunks/manifest.json
       ├─ /model/chunks/part-000.bin  （20,000,000 bytes）
       └─ /model/chunks/part-001.bin  （11,330,098 bytes）
```

没有后端、数据库、账号体系、Cookie、LocalStorage、IndexedDB 或统计脚本。

模型加载流程：

1. 页面读取 `manifest.json`；
2. 并行下载两个分片；
3. 在浏览器内存中拼成完整 `Uint8Array`；
4. 调用 `ort.InferenceSession.create(bytes.buffer)`；
5. 后续推理全部在浏览器内完成。

模型分片总大小约 29.9 MiB，拆成两个文件是因为 Cloudflare Pages 免费版单文件上限为 25 MiB。完整模型文件：

```text
public/model/hosptrajformer_v7.onnx
```

只用于本地开发，已被 `.gitignore` 排除，不进入 GitHub / Pages 构建。

---

## 5. 模型与任务定义

HospTrajFormer V7 关键参数：

| 项目 | 值 |
|---|---|
| 诊断词表 | 5,406 个 token |
| 诊断编码映射 | 5,404 个 ICD-3 编码 |
| 事件嵌入维度 | 256 |
| 最大历史长度 | 10 次住院 |
| 最大未来步数 | 3 |
| 每次住院最多次要诊断 | 5 |
| 时间间隔 | 分桶多分类 |
| 年龄 | 连续变量，按训练集均值/标准差标准化 |

单步输出：

1. 下一次住院的时间间隔桶；
2. 主要诊断 Top-k；
3. 次要诊断多标签集合。

多步生成：

- **概率抽样**：Monte Carlo 采样多条轨迹，展示路径频次与分布；
- **逐步贪心**：每步取概率最高的候选，只给出一条确定性轨迹。

---

## 6. 关键代码文件

| 文件 | 作用 |
|---|---|
| `src/App.tsx` | 页面状态、模型加载、生成流程、结果编排 |
| `src/inference.ts` | 预处理、ONNX 会话、单步/多步生成、Monte Carlo |
| `src/config.ts` | `VITE_MODEL_URL` 与默认分片清单地址 |
| `src/ConsentGate.tsx` | 首次进入的隐私与研究边界确认 |
| `src/ModelCard.tsx` | 模型卡：训练数据、参考性能、限制 |
| `src/ReadingGuide.tsx` | 结果阅读指南 |
| `src/CasePicker.tsx` | 合成病例选择 |
| `src/TimelineEditor.tsx` | 住院时间轴编辑 |
| `src/DiagnosisPicker.tsx` | 诊断检索与选择 |
| `src/TrajectoryFan.tsx` | 三步轨迹扇形图 |
| `src/PathTable.tsx` | 候选路径频次表 |
| `src/StepInspector.tsx` | 各步骤时间/主要/次要诊断分布 |
| `src/TechnicalPanel.tsx` | 模型版本、体积、时延、验证信息 |
| `scripts/strip-model.mjs` | `build:pages` 时删除完整 ONNX |
| `public/_headers` | 缓存与基础安全响应头 |
| `public/_redirects` | SPA 回退 |

---

## 7. 构建与部署

### 本地开发

```bash
pnpm install
pnpm run dev
```

不设置 `VITE_MODEL_URL` 时，默认加载：

```text
/model/chunks/manifest.json
```

### 生产构建

```bash
pnpm run build:pages
```

行为：

1. `tsc -b`；
2. `vite build`；
3. `node scripts/strip-model.mjs` 删除 `dist/model/hosptrajformer_v7.onnx`；
4. 保留 `dist/model/chunks/`。

### Cloudflare Pages

| 配置 | 值 |
|---|---|
| 项目类型 | Pages（不是 Worker） |
| Build command | `pnpm build:pages` |
| Build output | `dist` |
| Root directory | `/` |
| Node | 22 |
| 环境变量 | `NODE_VERSION=22` |
| `VITE_MODEL_URL` | 不设置 |

如以后改用 R2 或其他外部模型地址，可设置：

```text
VITE_MODEL_URL=https://.../hosptrajformer_v7.onnx
```

此时应用优先加载完整外部模型，不再走分片。

---

## 8. 隐私与合规设计

- 首次进入必须完成研究演示与隐私确认；
- 输入只存在于当前页面内存；
- 刷新页面即清空；
- 不使用账号，不写入任何持久化存储；
- 不接入统计、广告、用户行为分析；
- 模型加载后除静态资源外不再发起网络请求；
- 页面固定展示“非医疗器械、不构成诊断/治疗/预后建议”；
- 提醒不要输入姓名、身份证号、住院号等可识别信息；
- 模型文件本身公开可下载，不能作为知识产权保护手段。

注意：公开部署仍会经过托管平台的访问日志；如面向真实患者或医院使用，应改为内网/私有部署，并完成伦理、数据安全与备案评估。

---

## 9. 当前验证状态

已完成：

- `pnpm build:pages` 构建通过；
- 本地“仅分片、无完整 ONNX”构建可正常加载模型并生成结果；
- 概率抽样 20 条轨迹正常；
- 分片 HTTP 拼接后与完整模型逐字节一致；
- 8 组合成张量的 PyTorch / ONNX Runtime 一致性记录（`validation.json`）；
- 隐私确认页、模型卡、阅读指南、免责声明、技术验证面板可用；
- Cloudflare Pages 线上已正常运行。

尚未完成：

- 没有自动化单元测试 / E2E 测试；
- 没有逐例网页预处理—离线推理一致性比对；
- 没有 Web Worker，模型加载和推理可能在主线程阻塞 UI；
- 没有运行时分片 SHA-256 校验；
- 没有无障碍、移动端和弱网专项验收；
- 没有 CI 工作流。

---

## 10. 已知问题与技术债

### 10.1 pnpm 配置警告

本地 pnpm 11 会提示：

```text
The "pnpm" field in package.json is no longer read by pnpm.
ERR_PNPM_IGNORED_BUILDS: protobufjs
```

Cloudflare Pages 使用 pnpm 9.10，当前构建可以通过。建议：

- 固定 `packageManager` 版本；
- 按 pnpm 版本把 `onlyBuiltDependencies` 放到正确配置位置；
- 在 CI 中显式执行 `pnpm install --frozen-lockfile` 并验证无警告。

### 10.2 模型加载与推理在主线程

当前 `loadModel()` 和 `InferenceSession.create()` 都在主线程；31 MB 模型拼接和 wasm 初始化可能造成短暂卡顿。建议迁移到 Web Worker，或至少增加明确的加载进度。

### 10.3 分片缺少完整性校验

当前只校验总字节数，不校验 SHA-256。建议在 `manifest.json` 中增加：

```json
{
  "bytes": 31330098,
  "sha256": "FBD31996514CC99FADC4590E7F6189F8B5D529EF2A2A9BDBEBD4E39E2AD599EF"
}
```

并在浏览器拼接后校验，失败时给出明确提示。

### 10.4 SPA 回退可能掩盖 404

`public/_redirects` 的 `/* /index.html 200` 会让缺失的模型分片返回 HTML 而不是 404，导致 ONNX 报“protobuf parsing failed”。建议：

- 为 `/model/*` 增加显式 404 规则；或
- 在加载器中校验 `Content-Type` 与字节数，避免把 HTML 当模型。

### 10.5 构建体积警告

Vite 提示 JS chunk 超过 500 kB。可接受，但可通过动态 import、拆分 UI 依赖或配置 `chunkSizeWarningLimit` 降低噪音。

### 10.6 其他

- `MODEL_SOURCE` 目前未被使用，可删除或展示在技术面板；
- `wrangler.toml` 已移除，当前只走 Pages；
- 未使用 `Workers` 静态资源方案；
- 没有模型版本切换/回滚机制。

---

## 11. 建议 Codex 重点审核的内容

### P0：正确性与隐私

1. 分片拼接、`manifest.json` 解析、ONNX 会话创建是否在所有目标浏览器稳定；
2. 是否可能在任意路径把用户输入写入网络、日志或持久化存储；
3. 隐私确认与免责声明是否足够清晰，是否存在过度临床承诺；
4. 模型分片缺失/损坏时，错误提示是否可诊断。

### P1：部署可复现性

1. `build:pages`、pnpm 版本、lockfile 是否可重复构建；
2. Cloudflare Pages 配置是否与 README 一致；
3. 是否存在 Worker/Pages 混用导致的部署失败风险；
4. 是否应补充 GitHub Actions 构建检查。

### P1：性能与体验

1. 是否应将模型加载/推理迁移到 Web Worker；
2. 首次加载 30 MB 的进度、缓存与失败重试；
3. 移动端布局、触摸操作、弱网表现；
4. 模型加载失败时按钮禁用状态是否清楚。

### P2：代码质量

1. `App.tsx` 状态是否过多，是否应拆成 hooks/context；
2. `inference.ts` 是否应拆分模型加载、预处理、解码、采样；
3. 类型定义与错误处理是否完整；
4. 是否补充单元测试（分片拼接、bucket 映射、采样可复现性）和 E2E 测试。

### P2：模型与展示

1. 概率抽样与贪心模式的结果解释是否一致；
2. 路径频次、时间桶、次要诊断分布是否存在误导性展示；
3. 是否需要增加模型版本、校验和、生成参数的可追溯展示；
4. 是否需要 int8 量化或懒加载以降低首屏体积。

---

## 12. 不要做的改动

- 不要把完整 31 MB ONNX 直接放进 Cloudflare Pages；
- 不要重新引入 R2 作为必需依赖；
- 不要加入用户账号、病史保存、云端同步；
- 不要加入统计/埋点/第三方字体或 CDN（会破坏“无上传、无外部请求”的承诺）；
- 不要把研究演示改写成临床决策工具；
- 不要在没有论文口径确认的情况下改变模型输入/输出定义。

---

## 13. 建议给 Codex 的审核指令

```text
请审核这个 HospTrajFormer Web 项目，重点检查：
1. 浏览器内 ONNX 分片加载与拼接的正确性、错误处理和浏览器兼容性；
2. 是否存在用户输入被上传、持久化或写入日志的路径；
3. Cloudflare Pages 构建与部署配置是否可复现；
4. 隐私确认、模型卡和结果解读是否存在过度临床承诺；
5. 性能与可维护性改进建议。

请按 P0/P1/P2 输出问题清单，每条给出：
- 问题位置（文件/行）；
- 风险；
- 最小修复方案；
- 是否需要改模型或只改前端。
不要直接大改架构；先给审核报告和补丁建议。
```

---

## 14. 关键命令

```bash
# 安装
pnpm install

# 本地开发
pnpm run dev

# 本地构建
pnpm run build

# Pages 构建（会移除完整 ONNX）
pnpm run build:pages

# 预览
pnpm run preview

# 检查 Git 状态
git status
git log --oneline -5
```
