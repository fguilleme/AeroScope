import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function flightApi(): Plugin {
  const middleware = async (request: any, response: any, next: () => void) => {
    const aircraftRequest = request.url?.startsWith('/api/aircraft/')
    const routeRequest = request.url?.startsWith('/api/route/')
    if (!aircraftRequest && !routeRequest) return next()
    const upstreamPath = aircraftRequest
      ? request.url.replace(/^\/api\/aircraft/, '/v2')
      : request.url.replace(/^\/api\/route/, '/v0/callsign')
    const upstreamHost = aircraftRequest ? 'api.adsb.lol' : 'api.adsbdb.com'
    try {
      const upstream = await fetch(`https://${upstreamHost}${upstreamPath}`, {
        headers: { accept: 'application/json', 'user-agent': 'AeroScope/1.0' },
        signal: AbortSignal.timeout(12_000),
      })
      response.statusCode = upstream.status
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.setHeader('cache-control', 'no-store')
      response.end(await upstream.text())
    } catch (error) {
      response.statusCode = 502
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Upstream unavailable' }))
    }
  }
  return {
    name: 'aeroscope-flight-api',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}

export default defineConfig({
  plugins: [react(), flightApi()],
})
