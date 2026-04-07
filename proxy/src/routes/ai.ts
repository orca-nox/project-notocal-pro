import { Router, type Request, type Response } from 'express'

export function createAIRouter() {
  const router = Router()

  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  const ollamaModel = process.env.OLLAMA_MODEL || 'gemma3:4b'

  router.post('/chat', async (req: Request, res: Response) => {
    const { messages } = req.body

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'messages array is required' })
      return
    }

    try {
      const ollamaRes = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, messages, stream: true }),
      })

      if (!ollamaRes.ok) {
        res.status(ollamaRes.status).json({
          error: `Ollama returned ${ollamaRes.status}`,
          detail: await ollamaRes.text(),
        })
        return
      }

      res.setHeader('Content-Type', 'application/x-ndjson')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Transfer-Encoding', 'chunked')

      const reader = ollamaRes.body?.getReader()
      if (!reader) {
        res.status(502).json({ error: 'No response body from Ollama' })
        return
      }

      const onClose = () => reader.cancel()
      req.on('close', onClose)

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
      } finally {
        req.off('close', onClose)
        res.end()
      }
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Failed to connect to Ollama',
          detail: err instanceof Error ? err.message : String(err),
        })
      }
    }
  })

  return router
}
