import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import express from 'express'

// Load .env from project root (parent of proxy/)
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env') })
import { createCaldavProxy } from './routes/caldav.js'
import { createAIRouter } from './routes/ai.js'
import { createHealthRouter } from './routes/health.js'

const app = express()
const port = parseInt(process.env.PORT || '3001', 10)

// CalDAV proxy must be mounted before body parsers — it forwards raw request bodies.
// Uses pathFilter internally to match /<username>/* and /.well-known/caldav.
app.use(createCaldavProxy())

app.use(express.json())
app.use('/health', createHealthRouter())
app.use('/api/ai', createAIRouter())

app.listen(port, () => {
  console.log(`Proxy listening on port ${port}`)
})
