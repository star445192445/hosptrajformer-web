# HospTrajFormer Web — Cloudflare Pages 部署说明

本应用是**纯静态前端 + 浏览器内 ONNX 推理**：没有后端、没有数据库、没有用户账号，
用户输入只在当前浏览器内处理，不上传、不保存。

## 模型分片方案（无需 R2）

Cloudflare Pages 免费版单文件上限为 **25 MiB**（[官方 Limits](https://developers.cloudflare.com/pages/platform/limits/)）。
当前 ONNX 模型约 **29.9 MiB**，因此构建时把它拆成两个小于 25 MiB 的分片：

```text
public/model/chunks/
  manifest.json
  part-000.bin   （20,000,000 bytes）
  part-001.bin   （11,330,098 bytes）
```

页面启动时：

1. 读取 `manifest.json`；
2. 并行下载两个分片；
3. 在浏览器内存中拼接成完整 ONNX 字节流；
4. 交给 ONNX Runtime Web 创建推理会话。

模型仍从同一个 Pages 域名加载，**不需要 R2、不需要额外对象存储、没有 CORS 问题**。

## 1. 构建

```bash
cd Deployment/HospTrajFormer-Web/app
pnpm install
pnpm run build:pages
```

`build:pages` 会：

- 构建前端；
- 从 `dist/` 删除本地完整 ONNX 文件（避免 25 MiB 限制）；
- 保留 `dist/model/chunks/` 分片。

`dist/` 中应包含：

```text
index.html
assets/
model/config.json
model/diagnoses.json
model/validation.json
model/chunks/manifest.json
model/chunks/part-000.bin
model/chunks/part-001.bin
_headers
_redirects
```

## 2. GitHub 仓库

只把 `Deployment/HospTrajFormer-Web/app` 作为仓库，不要把整个论文项目上传。

```bash
cd Deployment/HospTrajFormer-Web/app
git status
git remote -v
```

如果没有 remote：

```bash
git remote add origin https://github.com/star445192445/hosptrajformer-web.git
git branch -M main
git push -u origin main
```

注意：

- `node_modules/`、`dist/` 不提交；
- `public/model/*.onnx` 已加入 `.gitignore`，完整模型不进 GitHub；
- `public/model/chunks/` 需要提交（两个分片均小于 GitHub 100 MB 单文件限制）；
- `config.json`、`diagnoses.json`、`validation.json` 随前端部署。

## 3. Cloudflare Pages

1. Workers & Pages → Create → Pages（旧版 Pages 工作流）→ Connect to Git；
2. GitHub 账号选 `star445192445`，仓库选 `hosptrajformer-web`；
3. 构建配置：
   - Framework preset：无 / None
   - Root directory：`/`
   - Build command：`pnpm build:pages`
   - Build output directory：`dist`
   - 环境变量：`NODE_VERSION=22`
4. 保存并部署；
5. 打开 `https://hosptrajformer-web.pages.dev`。

**不需要设置 `VITE_MODEL_URL`**。如果以后改用 R2 或外部模型地址，再设置该变量为完整 `.onnx` URL，应用会优先加载外部模型。

## 4. 本地开发

本地完整模型仍在：

```text
public/model/hosptrajformer_v7.onnx
```

不设置 `VITE_MODEL_URL` 时，默认加载分片：

```bash
pnpm run dev
```

分片位于 `public/model/chunks/`，本地 Vite 会直接提供。

如果只想本地快速测试完整模型，可以临时设置：

```bash
VITE_MODEL_URL=/model/hosptrajformer_v7.onnx pnpm run dev
```

Windows PowerShell：

```powershell
$env:VITE_MODEL_URL="/model/hosptrajformer_v7.onnx"
pnpm run dev
```

## 5. 公开前的隐私检查

- 首次进入显示研究演示说明，用户确认后才能使用；
- 不接入统计、广告、用户行为分析脚本；
- 不使用 Cookie、LocalStorage、IndexedDB 保存病史；
- 输入只存在于当前页面内存，刷新即清空；
- 模型加载后不再发起额外网络请求；
- 不要输入姓名、身份证号、住院号等可识别信息；
- 页面与模型卡均明确“非医疗器械、不构成诊断/治疗/预后建议”。

## 6. 常见问题

**Cloudflare Pages 构建报文件过大**
- 确认使用 `pnpm build:pages`，不是 `pnpm build`；
- 确认 `public/model/hosptrajformer_v7.onnx` 没有被提交到 Git；
- 确认 `dist/model/` 中只有 JSON 与 `chunks/`，没有 `.onnx`。

**页面模型加载失败**
- DevTools → Network 检查 `manifest.json`、两个 `.bin` 是否均返回 200；
- 检查 `manifest.json` 中的文件名是否与分片一致；
- 检查浏览器控制台是否有 ONNX Runtime 初始化错误。

**首次加载慢**
- 模型约 30 MB，分为两个分片并行下载；
- 分片设置了长缓存，首次加载后再次打开会走浏览器缓存。

## 7. 注意事项

- 模型文件公开可下载，不能作为知识产权保护手段；
- 当前为回顾性研究模型，未做前瞻性验证与临床效用评价；
- 如需账号、保存历史、审计或多用户管理，必须增加后端与合规评估，不能沿用本静态方案。
