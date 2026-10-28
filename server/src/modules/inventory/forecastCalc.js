/**
 * forecastCalc.js — pure demand forecasting from consumption history (Phase 5).
 *
 * Method (deliberately simple and explainable; no ML):
 *   - Daily usage for the last N days (days with no consumption count as 0).
 *   - With >= 28 days of history and >= 14 days that actually had usage: weekday-seasonal average
 *     (mean usage per weekday, so a busy Saturday is not averaged away). Otherwise a flat daily average.
 *   - The forecast for the next H days is the sum of the expected usage of each coming day.
 *   - Trend (last 7 days vs the 7 before) is reported, NOT applied to the numbers.
 * It knows nothing about reservations, events, holidays, menu changes or weather.
 * Days are bucketed in a fixed UTC offset (default IST, +05:30).
 */
const DAY = 864e5;
const IST = 330;

const dayKey = (t, tzMin = IST) => Math.floor((+t + tzMin * 60000) / DAY);
const dowOf = (key) => (((key + 4) % 7) + 7) % 7; // epoch day 0 (1970-01-01) was a Thursday

/** events: [{ at: Date|number, qtyMilli }] ; returns forecast object (all quantities in milli). */
function forecast({ events, lookbackDays = 28, horizonDays = 7, now = Date.now(), tzMin = IST }) {
  const today = dayKey(now, tzMin);
  const first = today - lookbackDays; // window = [first, today-1]; today is incomplete so it is excluded
  const daily = new Array(lookbackDays).fill(0);
  for (const e of events) {
    const k = dayKey(e.at, tzMin);
    if (k >= first && k < today) daily[k - first] += e.qtyMilli;
  }
  const total = daily.reduce((s, v) => s + v, 0);
  const activeDays = daily.filter((v) => v > 0).length;
  const flat = total / lookbackDays;
  const seasonal = lookbackDays >= 28 && activeDays >= 14;
  const dowAvg = new Array(7).fill(0), dowN = new Array(7).fill(0);
  daily.forEach((v, i) => { const d = dowOf(first + i); dowAvg[d] += v; dowN[d]++; });
  for (let d = 0; d < 7; d++) dowAvg[d] = dowN[d] ? dowAvg[d] / dowN[d] : flat;
  let fc = 0;
  const perDay = [];
  for (let i = 0; i < horizonDays; i++) {
    const v = seasonal ? dowAvg[dowOf(today + i)] : flat;
    perDay.push(Math.round(v));
    fc += v;
  }
  const last7 = daily.slice(-7).reduce((s, v) => s + v, 0), prev7 = daily.slice(-14, -7).reduce((s, v) => s + v, 0);
  const trendPct = lookbackDays >= 14 && prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 1000) / 10 : null;
  return {
    method: seasonal ? "weekday_average" : "flat_average",
    avgDailyMilli: Math.round(flat), forecastMilli: Math.round(fc), perDayMilli: perDay,
    activeDays, trendPct, confidence: activeDays >= 21 ? "high" : activeDays >= 10 ? "medium" : "low",
  };
}

/** days the stock will last at the forecast rate (null = no usage forecast) */
function coverDays(availableMilli, avgDailyMilli) {
  return avgDailyMilli > 0 ? Math.round((availableMilli / avgDailyMilli) * 10) / 10 : null;
}

module.exports = { forecast, coverDays, dayKey, dowOf, IST };
