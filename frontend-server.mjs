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
const autoIspOrigin = String(process.env.AUTOISP_ORIGIN || '').replace(/\/$/, '')

/** Encaminha a requisição atual para `originBase`, opcionalmente reescrevendo o path. */
const proxyRequest = (req, res, originBase, rewrite) => {
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
  const headers = { ...req.headers, host: target.host }
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
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
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

  // Proxy do BFF (mesmo origin → sem CORS). Precede o serviço estático.
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
