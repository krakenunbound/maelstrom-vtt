// FG's currency values (the GM's, each coin's value in the first coin): what coins are worth, in that coin. null when
// no coin counted has a value.
/** @param {{ name: string; amount: number }[]} coins @param {Record<string, { value?: number }>} [info] */
export function coinWorth(coins, info = {}) {
  const values = Object.fromEntries(Object.entries(info ?? {}).filter(([, item]) => Number(item?.value) > 0).map(([name, item]) => [name.toLowerCase(), Number(item.value)]));
  let worth = 0;
  let counted = false;
  for (const coin of coins) {
    const value = values[String(coin.name ?? "").toLowerCase()];
    if (value === undefined || !(Number(coin.amount) > 0)) continue;
    worth += Number(coin.amount) * value;
    counted = true;
  }
  return counted ? Math.round(worth * 100) / 100 : null;
}
