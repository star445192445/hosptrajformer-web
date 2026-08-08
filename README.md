# HospTrajFormer Web

HospTrajFormer住院疾病轨迹研究演示平台。网页使用React构建，并通过ONNX Runtime Web在访问者浏览器内运行V7模型。

## 功能

- 录入最近1至10次住院事件；
- 生成未来三步住院时间间隔、主要诊断和次要诊断候选；
- 展示时间间隔概率、主要诊断Top5及次要诊断多标签结果；
- 所有推理均在浏览器本地完成，不上传或保存用户输入。

## 本地运行

```bash
pnpm install
pnpm run dev
```

生产构建：

```bash
pnpm run build
```

## 模型文件

浏览器模型位于`public/model/hosptrajformer_v7.onnx`，由正式V7检查点转换得到。`public/model/validation.json`记录PyTorch与ONNX Runtime的数值一致性验证结果。

## 使用边界

本项目仅供科研与教学演示，不用于临床诊断、治疗决策或个体预后判断。网页输出反映模型在既定训练数据、输入定义和解码规则下学习到的统计关联。
