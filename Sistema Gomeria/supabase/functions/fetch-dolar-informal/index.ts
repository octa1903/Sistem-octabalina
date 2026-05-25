// =====================================================================
// fetch-dolar-informal — Edge Function (Deno) que obtiene la cotización
// del Dólar Informal desde ámbito.com y la devuelve normalizada.
//
// El navegador no puede llamar directo al endpoint por CORS. Esta función
// actúa de proxy: corre del lado server, llama al endpoint público de
// ámbito y devuelve { buy, sell, source, fetchedAt }.
//
// Deploy:
//   supabase functions deploy fetch-dolar-informal
//
// Invocación desde el cliente:
//   const { data, error } = await supabase.functions.invoke('fetch-dolar-informal')
//
// Endpoint upstream:
//   https://mercados.ambito.com//dolarrava/informal/variacion
// Respuesta esperada (formato "AR" con coma decimal y punto miles):
//   { "compra": "1.405,00", "venta": "1.425,00", "variacion": "0,00", ... }
// =====================================================================

// @ts-expect-error Deno runtime serves these in production; ignore in TS check.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const UPSTREAM_URL = 'https://mercados.ambito.com//dolarrava/informal/variacion';
const UPSTREAM_FALLBACK = 'https://mercados.ambito.com//dolar/informal/variacion';
const REQUEST_TIMEOUT_MS = 8000;

interface AmbitoResponse {
  compra?: string;
  venta?: string;
  variacion?: string;
}

interface NormalizedResponse {
  buy: number;
  sell: number;
  source: 'ambito-informal';
  fetchedAt: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
} as const;

/**
 * Convierte un número en formato AR ("1.405,00") a Number JS (1405).
 * Tolerante a strings vacíos o ya numéricos.
 */
function parseArNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return NaN;
  const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'accept': 'application/json', 'user-agent': 'fetch-dolar-informal/1.0' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAmbito(): Promise<NormalizedResponse> {
  let lastErr: unknown = null;
  for (const url of [UPSTREAM_URL, UPSTREAM_FALLBACK]) {
    try {
      const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      if (!res.ok) {
        lastErr = new Error(`upstream ${res.status} ${res.statusText}`);
        continue;
      }
      const json = (await res.json()) as AmbitoResponse;
      const buy = parseArNumber(json.compra);
      const sell = parseArNumber(json.venta);
      if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) {
        lastErr = new Error(`upstream returned invalid numbers: ${JSON.stringify(json)}`);
        continue;
      }
      return {
        buy,
        sell,
        source: 'ambito-informal',
        fetchedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('unknown upstream error');
}

// @ts-expect-error Deno serve handler typing.
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  try {
    const data = await fetchAmbito();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' },
    });
  }
});
