import { createProxyMiddleware } from 'http-proxy-middleware'

export function createCaldavProxy() {
  const radicaleUrl = process.env.RADICALE_URL || 'http://localhost:5232'
  const radicaleUser = process.env.RADICALE_USER || ''
  const radicalePass = process.env.RADICALE_PASS || ''
  const caldavUser = radicaleUser || process.env.VITE_CALDAV_USERNAME || 'user'

  const authHeader =
    radicaleUser && radicalePass
      ? 'Basic ' + Buffer.from(`${radicaleUser}:${radicalePass}`).toString('base64')
      : undefined

  return createProxyMiddleware({
    target: radicaleUrl,
    pathFilter: (path) => path.startsWith(`/${caldavUser}`) || path.startsWith('/.well-known/caldav'),
    changeOrigin: true,
    secure: false,
    on: {
      proxyReq(proxyReq) {
        if (authHeader) {
          proxyReq.setHeader('Authorization', authHeader)
        }
      },
    },
  })
}
