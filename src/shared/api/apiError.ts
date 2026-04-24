export class ApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, message: string, body: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** Falha antes da resposta HTTP (rede, CORS, DNS, etc.). */
export class NetworkError extends Error {
  override readonly name = 'NetworkError'
  readonly underlying?: unknown

  constructor(message: string, underlying?: unknown) {
    super(message)
    this.underlying = underlying
  }
}
