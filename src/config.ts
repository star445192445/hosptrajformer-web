const configured = (import.meta.env as Record<string, string | undefined>).VITE_MODEL_URL

export const MODEL_URL =
  configured && configured.trim()
    ? configured.trim()
    : '/model/chunks/manifest.json'

export const MODEL_SOURCE = MODEL_URL.startsWith('http')
  ? new URL(MODEL_URL).host
  : '本地静态文件'
