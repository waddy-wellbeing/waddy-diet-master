import { NextResponse } from 'next/server'

/** Standard CORS headers for the mobile API */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/** Return a preflight OPTIONS response with CORS headers */
export function corsOptionsResponse() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/** Wrap a JSON payload with CORS headers */
export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders })
}

/** Return a JSON error with CORS headers */
export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders })
}
