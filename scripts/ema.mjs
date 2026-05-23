// EMA calculation with proper SMA seeding
// Returns array of EMA values aligned with input prices (null for warm-up period)

export function calculateEMA(prices, period) {
  if (prices.length < period) return new Array(prices.length).fill(null);

  const result = new Array(prices.length).fill(null);
  const k = 2 / (period + 1);

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  result[period - 1] = sum / period;

  // Compute EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    result[i] = prices[i] * k + result[i - 1] * (1 - k);
  }

  return result;
}

// Current (latest) EMA value
export function currentEMA(prices, period) {
  const series = calculateEMA(prices, period);
  return series[series.length - 1];
}

// SMA at a point
export function sma(values, period, endIdx) {
  if (endIdx < period - 1) return null;
  let sum = 0;
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    sum += values[i];
  }
  return sum / period;
}

// Compute percentile rank of a value within an array (0-1)
export function percentileRank(value, array) {
  if (array.length === 0) return 0;
  const sorted = [...array].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v < value) count++;
    else break;
  }
  return count / sorted.length;
}
