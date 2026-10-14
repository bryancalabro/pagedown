// vercel function: GET /api/fetch?url=<link>. the work lives in server/handle.ts.
import { handle } from '../server/handle.js'

export function GET(request: Request): Promise<Response> {
  return handle(request)
}
