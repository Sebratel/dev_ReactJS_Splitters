import fs from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, 'dist')
const port = Number(process.env.PORT || 3177)

// Proxy reverso do BFF: o SPA chama `/api/...` no mesmo origin (sem CORS) e este servidor
// encaminha ao backend. Configure BACKEND_ORIGIN (ex.: http://backend:3001 na rede do compose).
// Opcional: AUTOISP_ORIGIN para `/__autoisp/...` (paridade com o proxy do Vite/nginx).
const backendOrigin = String(process.env.BACKEND_ORIGIN || '').replace(/\/$/, '')
// Gateway ERP/Elleven (n8n / api-gateway-bff) que atende as rotas `/api/v1/...` (massivas,
// afetados). É um destino DIFERENTE do backend Node — por isso o roteamento por prefixo.
const gatewayOrigin = String(process.env.GATEWAY_ORIGIN || '').replace(/\/$/, '')
const autoIspOrigin = String(process.env.AUTOISP_ORIGIN || '').replace(/\/$/, '')
const gatewayBasicAuthUser = String(process.env.GATEWAY_BASIC_AUTH_USER || '').trim()
const gatewayBasicAuthPassword = String(process.env.GATEWAY_BASIC_AUTH_PASSWORD || '').trim()
const gatewayBasicAuthEnabled =
  gatewayBasicAuthUser !== '' && gatewayBasicAuthPassword !== ''

/** Remove `WWW-Authenticate` para o browser não abrir o popup nativo de Basic Auth. */
function filterProxyResponseHeaders(upstreamHeaders) {
  const filtered = { ...upstreamHeaders }
  for (const key of Object.keys(filtered)) {
    if (key.toLowerCase() === 'www-authenticate') {
      delete filtered[key]
    }
  }
  return filtered
}

/**
 * Basic Auth do gateway fica no proxy (server-side). O JWT Google do usuário segue em
 * `X-Forwarded-Authorization` para o BFF validar o Bearer sem popup no browser.
 */
function buildGatewayProxyHeaders(reqHeaders) {
  const headers = { ...reqHeaders }
  const incomingAuth =
    typeof headers.authorization === 'string' ? headers.authorization.trim() : ''

  if (gatewayBasicAuthEnabled) {
    const token = Buffer.from(`${gatewayBasicAuthUser}:${gatewayBasicAuthPassword}`).toString(
      'base64',
    )
    headers.authorization = `Basic ${token}`
    if (/^Bearer /i.test(incomingAuth)) {
      headers['x-forwarded-authorization'] = incomingAuth
    }
  }

  return headers
}

/** Encaminha a requisição atual para `originBase`, opcionalmente reescrevendo o path. */
const proxyRequest = (req, res, originBase, rewrite, options = {}) => {
  let target
  try {
    const rawPath = rewrite ? rewrite(req.url || '/') : req.url || '/'
    target = new URL(rawPath, originBase)
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'bad_gateway', message: 'Destino de proxy inválido.' }))
    return
  }
  const isHttps = target.protocol === 'https:'
  const client = isHttps ? https : http
  const baseHeaders = options.gatewayAuth ? buildGatewayProxyHeaders(req.headers) : req.headers
  const headers = { ...baseHeaders, host: target.host }
  const stripWwwAuthenticate = options.stripWwwAuthenticate === true
  const proxyReq = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
      servername: isHttps ? target.hostname : undefined,
    },
    (proxyRes) => {
      const responseHeaders = stripWwwAuthenticate
        ? filterProxyResponseHeaders(proxyRes.headers)
        : proxyRes.headers
      res.writeHead(proxyRes.statusCode || 502, responseHeaders)
      proxyRes.pipe(res)
    },
  )
  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    }
    res.end(JSON.stringify({ error: 'bad_gateway', message: String(err?.message || err) }))
  })
  req.pipe(proxyReq)
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/octet-stream',
}

const getContentType = (filePath) => mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'

const resolvePath = (urlPath) => {
  const normalizedPath = path.normalize(decodeURIComponent(urlPath))
  const filePath = path.join(root, normalizedPath)
  return filePath.startsWith(root) ? filePath : null
}

const serveFile = async (filePath, response) => {
  try {
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) {
      return serveFile(path.join(filePath, 'index.html'), response)
    }
    const data = await fs.readFile(filePath)
    response.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': filePath.endsWith('/index.html') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable',
    })
    response.end(data)
  } catch {
    return null
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  // Rotas do gateway ERP (massivas/afetados) → GATEWAY_ORIGIN. Precede o /api genérico.
  if (url.pathname.startsWith('/api/v1/')) {
    if (gatewayOrigin) {
      proxyRequest(req, res, gatewayOrigin, undefined, {
        gatewayAuth: true,
        stripWwwAuthenticate: true,
      })
    } else {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'bad_gateway', message: 'GATEWAY_ORIGIN não configurado no frontend.' }))
    }
    return
  }
  // Demais rotas do BFF Node (mesmo origin → sem CORS). Precede o serviço estático.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    if (backendOrigin) {
      proxyRequest(req, res, backendOrigin)
    } else {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'bad_gateway', message: 'BACKEND_ORIGIN não configurado no frontend.' }))
    }
    return
  }
  if (url.pathname.startsWith('/__autoisp/') && autoIspOrigin) {
    proxyRequest(req, res, autoIspOrigin, (u) => u.replace(/^\/__autoisp/, ''))
    return
  }

  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname
  const filePath = resolvePath(requestedPath)

  if (!filePath) {
    res.writeHead(400).end('Bad request')
    return
  }

  const served = await serveFile(filePath, res)
  if (served !== null) {
    return
  }

  // SPA fallback
  const fallbackPath = path.join(root, 'index.html')
  try {
    const fallbackData = await fs.readFile(fallbackPath)
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    })
    res.end(fallbackData)
  } catch (error) {
    res.writeHead(500).end('Internal Server Error')
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Frontend static server listening on http://0.0.0.0:${port}`)
})
