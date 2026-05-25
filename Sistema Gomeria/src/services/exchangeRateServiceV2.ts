// ═══════════════════════════════════════════════════
// exchangeRateServiceV2 — cotización USD/ARS (Dólar Informal de ámbito).
// Tabla: exchange_rates (definida en 0032_supplier_price_lists.sql).
//
// Concepto clave:
//   El "rate" usado para convertir USD→ARS es el precio de equilibrio:
//     rate = (rate_buy + rate_sell) / 2
//   En la DB es una generated column. Acá lo recalculamos del lado
//   cliente solo por conveniencia (los tests no van a la DB).
//
// ═══════════════════════════════════════════════════

import { supabase } from './supabaseClient';
import { ensureNoError } from './supabaseHelpers';
import type { ExchangeRate, ExchangeRateSource } from '@/types';

interface AmbitoFetchResult {
  buy: number;
  sell: number;
  source: 'ambito-informal';
  fetchedAt: string;
}

// ─── Lógica pura (testeable sin DB) ──────────────────────────────────

/**
 * Precio de equilibrio = (compra + venta) / 2.
 * Es el valor usado para convertir USD → ARS en todo el sistema.
 */
export function equilibriumRate(buy: number, sell: number): number {
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) {
    throw new Error('equilibriumRate: buy y sell deben ser positivos');
  }
  return (buy + sell) / 2;
}

/**
 * Convierte un monto USD a ARS aplicando la cotización de equilibrio.
 * Redondea a 2 decimales (centavos).
 */
export function convertUsdToArs(amountUsd: number, rate: number): number {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    throw new Error('convertUsdToArs: amountUsd debe ser >= 0');
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('convertUsdToArs: rate debe ser > 0');
  }
  return Math.round(amountUsd * rate * 100) / 100;
}

/** Convierte ARS a USD. Útil para mostrar costos históricos en USD constante. */
export function convertArsToUsd(amountArs: number, rate: number): number {
  if (!Number.isFinite(amountArs) || amountArs < 0) {
    throw new Error('convertArsToUsd: amountArs debe ser >= 0');
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('convertArsToUsd: rate debe ser > 0');
  }
  return Math.round((amountArs / rate) * 100) / 100;
}

/** Fecha YYYY-MM-DD en zona local (para `effective_date`). */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ExchangeRateRow {
  id: string;
  from_currency: string;
  to_currency: string;
  rate_buy: number | string;
  rate_sell: number | string;
  rate: number | string;
  effective_date: string;
  source: string;
  fetched_at: string;
  created_by: string | null;
  created_at: string;
}

export function rowToExchangeRate(row: ExchangeRateRow): ExchangeRate {
  return {
    id: row.id,
    fromCurrency: 'USD',
    toCurrency: 'ARS',
    rateBuy: Number(row.rate_buy),
    rateSell: Number(row.rate_sell),
    rate: Number(row.rate),
    effectiveDate: row.effective_date,
    source: row.source as ExchangeRateSource,
    fetchedAt: row.fetched_at,
  };
}

// ─── Service ─────────────────────────────────────────────────────────

export interface SetRateInput {
  source: ExchangeRateSource;
  buy: number;
  sell: number;
  date?: string;
}

export const exchangeRateService = {
  /**
   * Devuelve la cotización más reciente para USD/ARS junto a flag `stale`
   * (true si su effective_date no es hoy). null si no hay ninguna.
   */
  async getTodayRate(): Promise<(ExchangeRate & { stale: boolean }) | null> {
    const today = todayIso();
    const { data, error } = await supabase.from('exchange_rates')
      .select('*')
      .eq('from_currency', 'USD')
      .eq('to_currency', 'ARS')
      .order('effective_date', { ascending: false })
      .limit(1);
    if (error) {
      console.error('[supabase] exchangeRateService.getTodayRate:', error.code, error.message);
      throw new Error(`exchangeRateService.getTodayRate: ${error.message}`);
    }
    const row = (data ?? [])[0] as ExchangeRateRow | undefined;
    if (!row) return null;
    const rate = rowToExchangeRate(row);
    return { ...rate, stale: rate.effectiveDate !== today };
  },

  /**
   * Invoca la Edge Function `fetch-dolar-informal` para traer la cotización
   * desde ámbito.com. No la persiste — el caller decide si llama a setRate().
   */
  async fetchFromAmbito(): Promise<AmbitoFetchResult> {
    const { data, error } = await supabase.functions.invoke<AmbitoFetchResult>(
      'fetch-dolar-informal',
    );
    if (error) {
      throw new Error(`fetchFromAmbito: ${error.message}`);
    }
    if (!data || typeof data.buy !== 'number' || typeof data.sell !== 'number') {
      throw new Error('fetchFromAmbito: respuesta inválida del edge function');
    }
    return data;
  },

  /** Upsert por (from_currency, to_currency, effective_date). */
  async setRate(input: SetRateInput): Promise<ExchangeRate> {
    if (input.buy <= 0 || input.sell <= 0) {
      throw new Error('setRate: buy y sell deben ser positivos');
    }
    const payload = {
      from_currency: 'USD',
      to_currency: 'ARS',
      rate_buy: input.buy,
      rate_sell: input.sell,
      effective_date: input.date ?? todayIso(),
      source: input.source,
      fetched_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('exchange_rates')
      .upsert(payload, { onConflict: 'from_currency,to_currency,effective_date' })
      .select()
      .single();
    return rowToExchangeRate(
      ensureNoError(data, error, 'exchangeRateService.setRate') as ExchangeRateRow,
    );
  },

  /** Lista cotizaciones recientes ordenadas por fecha desc. */
  async listRecent(limit = 30): Promise<ExchangeRate[]> {
    const { data, error } = await supabase.from('exchange_rates')
      .select('*')
      .eq('from_currency', 'USD')
      .eq('to_currency', 'ARS')
      .order('effective_date', { ascending: false })
      .limit(limit);
    const rows = ensureNoError(data, error, 'exchangeRateService.listRecent') as ExchangeRateRow[];
    return rows.map(rowToExchangeRate);
  },

  /** Cotización por id (para histórico de costos que referencian su rate). */
  async getById(id: string): Promise<ExchangeRate | null> {
    const { data, error } = await supabase.from('exchange_rates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`exchangeRateService.getById: ${error.message}`);
    }
    return data ? rowToExchangeRate(data as ExchangeRateRow) : null;
  },
};
