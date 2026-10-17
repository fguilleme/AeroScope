import http from 'node:http'
import https from 'node:https'

const port = 8787
const cache = new Map()
const cacheLifetime = 5_000

function fetchUpstream(target) {
  return new Promise((resolve, reject) => {
    const upstream = https.get(target, {
      headers: { Accept: 'application/json', 'User-Agent': 'AeroScope/1.0' },
    }, upstreamResponse => {
      const chunks = []
      upstreamResponse.on('data', chunk => chunks.push(chunk))
      upstreamResponse.on('end', () => resolve({
        status: upstreamResponse.statusCode || 502,
        contentType: upstreamResponse.headers['content-type'],
        body: Buffer.concat(chunks),
      }))
    })
    upstream.setTimeout(15_000, () => upstream.destroy(new Error('Upstream timeout')))
    upstream.on('error', reject)
  })
}

function upstreamUrl(requestUrl) {
  const requested = new URL(requestUrl || '/', `http://127.0.0.1:${port}`)
  if (requested.pathname.startsWith('/v2/')) {
    return new URL(`${requested.pathname}${requested.search}`, 'https://api.adsb.lol')
  }
  if (requested.pathname === '/opensky') {
    return new URL(`/api/states/all${requested.search}`, 'https://opensky-network.org')
  }
  return null
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET') {
    response.writeHead(405).end('Method not allowed')
    return
  }
  const target = upstreamUrl(request.url)
  if (!target) {
    response.writeHead(404).end('Not found')
    return
  }

  const cacheKey = target.href
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.storedAt < cacheLifetime) {
    response.writeHead(cached.status, cached.headers).end(cached.body)
    return
  }

  try {
    const upstream = await fetchUpstream(target)
    const body = upstream.body
    const headers = {
      'content-type': upstream.contentType || 'application/json',
      'cache-control': 'no-store',
    }
    if (upstream.status >= 200 && upstream.status < 300) cache.set(cacheKey, { status: upstream.status, headers, body, storedAt: Date.now() })
    response.writeHead(upstream.status, headers).end(body)
  } catch {
    response.writeHead(502, { 'content-type': 'application/json' }).end('{"error":"ADS-B source unavailable"}')
  }
})

server.listen(port, '127.0.0.1')
