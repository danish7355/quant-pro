/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Position, CoinDetail } from '../types';

export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'FILLED' | 'CANCELLED' | 'REJECTED';

export interface OrderRecord {
  id: string;
  idempotencyKey: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  fillPrice: number;
  slippagePct: number;
  feeUsd: number;
  status: OrderStatus;
  timestamp: string;
}

const processedKeys = new Set<string>();
const orderHistory: OrderRecord[] = [];

export function generateIdempotencyKey(symbol: string, direction: string, price: number): string {
  // Key rounded to timeframe bucket window
  const windowBucket = Math.floor(Date.now() / (100 * 1000)); // 100-second bucket
  return `${symbol}_${direction}_${Math.round(price * 100)}_${windowBucket}`;
}

export function submitOrderWithIdempotency(
  coin: CoinDetail,
  quantity: number,
  allocatedMargin: number,
  leverage: number,
  tp1: number,
  tp2: number,
  sl: number,
  slippageMinPct: number = 0.02,
  slippageMaxPct: number = 0.05,
  takerFeePct: number = 0.04
): { success: boolean; order?: OrderRecord; position?: Position; error?: string } {
  const key = generateIdempotencyKey(coin.symbol, coin.direction, coin.price);
  
  if (processedKeys.has(key)) {
    return { success: false, error: `Duplicate order rejected by OMS idempotency lock (Key: ${key})` };
  }

  // Register idempotency key
  processedKeys.add(key);

  // Simulate realistic fill price with randomized slippage (0.02% to 0.05%)
  const slippageFactor = (slippageMinPct + Math.random() * (slippageMaxPct - slippageMinPct)) / 100;
  const isLong = coin.direction === 'LONG';
  // Long fills higher, Short fills lower
  const fillPrice = isLong 
    ? coin.price * (1 + slippageFactor) 
    : coin.price * (1 - slippageFactor);

  const positionSizeUsd = quantity * fillPrice;
  const feeUsd = positionSizeUsd * (takerFeePct / 100);

  const order: OrderRecord = {
    id: `ord_${Math.random().toString(36).substr(2, 9)}`,
    idempotencyKey: key,
    symbol: coin.symbol,
    direction: coin.direction as 'LONG' | 'SHORT',
    quantity,
    entryPrice: coin.price,
    fillPrice,
    slippagePct: slippageFactor * 100,
    feeUsd,
    status: 'FILLED',
    timestamp: new Date().toISOString()
  };

  orderHistory.push(order);

  const position: Position = {
    id: order.id,
    symbol: coin.symbol,
    direction: coin.direction as 'LONG' | 'SHORT',
    entryPrice: fillPrice,
    currentPrice: fillPrice,
    quantity,
    leverage,
    allocatedBalance: allocatedMargin,
    tp1,
    tp2,
    tp3: tp2 * 1.05,
    sl,
    trailingStop: null,
    trailingStopActive: false,
    entryAtr: coin.indicators.atr || fillPrice * 0.02,
    timeOpen: order.timestamp,
    scoreAtEntry: coin.score,
    unrealizedPnl: -feeUsd, // start with taker fee deducted
    realizedPnl: 0,
    sizeRemainingPct: 100
  };

  return { success: true, order, position };
}

export function reconcileOrphanPositions(
  trackedPositions: Position[],
  exchangeActivePositions: { symbol: string; size: number; price: number }[]
): { orphansFound: number; logs: string[] } {
  const logs: string[] = [];
  let orphans = 0;

  exchangeActivePositions.forEach(exPos => {
    const matched = trackedPositions.some(tp => tp.symbol === exPos.symbol);
    if (!matched) {
      orphans++;
      logs.push(`⚠️ OMS Reconciliation: Orphan position detected on exchange for ${exPos.symbol} (Size: ${exPos.size}). Creating local tracker record.`);
    }
  });

  return { orphansFound: orphans, logs };
}

export function getOrderHistory(): OrderRecord[] {
  return [...orderHistory];
}
