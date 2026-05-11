import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, 'dist')
const port = Number(process.env.PORT || 3177)

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
