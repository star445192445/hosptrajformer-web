# HospTrajFormer Web — Cloudflare Pages + R2 部署说明

本应用是**纯静态前端 + 浏览器内 ONNX 推理**：没有后端、没有数据库、没有用户账号，
用户输入只在当前浏览器内处理，不上传、不保存。

## 为什么模型放 R2

Cloudflare Pages 免费版单个文件上限为 **25 MiB**（[官方 Limits](https://developers.cloudflare.com/pages/platform/limits/)）。
当前 ONNX 模型约 **29.9 MiB**，不能直接放进 Pages 的 `dist/`。因此采用：

```text
Cloudflare Pages  → 前端静态文件（HTML/JS/CSS/wasm/config/diagnoses）
Cloudflare R2     → hosptrajformer_v7.onnx（公共桶 + CORS）
```

浏览器从 Pages 加载页面，再从 R2 拉取模型；推理仍在浏览器内完成。

## 1. 上传模型到 R2

1. Cloudflare Dashboard → R2 → Create bucket，例如 `hosptrajformer-model`；
2. 上传 `public/model/hosptrajformer_v7.onnx`（约 29.9 MiB）；
3. 设置公共访问：
   - 使用 R2 公共开发地址 `https://pub-<hash>.r2.dev`，或
   - 绑定自定义域名，例如 `https://static.example.com`；
4. 配置 CORS，允许 Pages 域名读取模型。模板见 `deploy/r2-cors.json`：
   - `AllowedOrigins` 填 `https://<project>.pages.dev` 和自定义域名；
   - `AllowedMethods` 为 `GET, HEAD`；
   - `AllowedHeaders` 为 `*`。

最终模型 URL 形如：

```text
https://pub-xxxxxxxx.r2.dev/hosptrajformer_v7.onnx
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
git remote add origin https://github.com/<user>/hosptrajformer-web.git
git branch -M main
git push -u origin main
```

注意：

- `node_modules/`、`dist/` 不提交；
- `public/model/*.onnx` 已加入 `.gitignore`，模型不放进 GitHub；
- `config.json`、`diagnoses.json`、`validation.json` 仍随前端部署；
- Cloudflare Pages 构建使用 `pnpm build:pages`，它会先构建、再从 `dist/` 删除本地 ONNX 模型，避免超过 25 MiB。

## 3. Cloudflare Pages

1. Workers & Pages → Create → Pages → Connect to Git；
2. 选择仓库；
3. 构建配置：
   - Root directory：`/`（仓库根就是 app）；
   - Build command：`pnpm build:pages`；
   - Build output directory：`dist`；
   - 环境变量：
     - `NODE_VERSION=22`
     - `VITE_MODEL_URL=https://pub-xxxxxxxx.r2.dev/hosptrajformer_v7.onnx`
       （Production 和 Preview 都建议设置；Preview 域名也要加进 R2 CORS）
4. 部署后打开 `*.pages.dev`，检查模型是否成功从 R2 加载；
5. 绑定自定义域名，Cloudflare 自动 HTTPS；
6. 把自定义域名加入 R2 CORS 的 `AllowedOrigins`。

## 4. 本地开发

本地保留 `public/model/hosptrajformer_v7.onnx`，不设置 `VITE_MODEL_URL` 时会回退到本地文件：

```bash
pnpm run dev
```

本地模拟 Pages 构建：

```bash
VITE_MODEL_URL=https://pub-xxxxxxxx.r2.dev/hosptrajformer_v7.onnx pnpm run build:pages
```

Windows PowerShell：

```powershell
$env:VITE_MODEL_URL="https://pub-xxxxxxxx.r2.dev/hosptrajformer_v7.onnx"
pnpm run build:pages
```

构建后 `dist/model/` 中不再包含 ONNX 文件，页面会从 R2 加载。

## 5. 公开前的隐私检查

- 首次进入显示研究演示说明，用户确认后才能使用；
- 不接入统计、广告、用户行为分析脚本；
- 不使用 Cookie、LocalStorage、IndexedDB 保存病史；
- 输入只存在于当前页面内存，刷新即清空；
- 模型与配置加载完成后，除 R2、静态资源外不再发起网络请求；
- 不要输入姓名、身份证号、住院号等可识别信息；
- 页面与模型卡均明确“非医疗器械、不构成诊断/治疗/预后建议”。

## 6. 常见问题

**模型 404 / CORS 报错**
- 检查 `VITE_MODEL_URL` 是否为公开可访问的 R2 URL；
- 检查 R2 CORS 是否包含当前 Pages 域名（含 `*.pages.dev` 与自定义域名）；
- 浏览器 DevTools → Network 查看 `.onnx` 请求的 CORS 响应头。

**Cloudflare Pages 构建报文件过大**
- 确认使用 `pnpm build:pages`，而不是 `pnpm build`；
- 确认仓库中没有提交 `public/model/hosptrajformer_v7.onnx`；
- 检查 `dist/model/` 是否只剩 JSON 文件。

**首次加载慢**
- 模型约 30 MB，建议在页面显示加载进度；
- R2 与 Pages 均走 Cloudflare 网络，首次加载后浏览器会缓存模型（`_headers` 已配置长缓存）。

## 7. 注意事项

- 模型文件公开可下载，不能作为知识产权保护手段；
- 当前为回顾性研究模型，未做前瞻性验证与临床效用评价；
- 如需账号、保存历史、审计或多用户管理，必须增加后端与合规评估，不能沿用本静态方案。
