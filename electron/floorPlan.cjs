// Where creatures can stand on a printed battle map (a book's map converted from a PDF: its battles say only roughly
// where a room's creatures are). Each grid square's inside is measured: a floor square is lighter than the rock
// round the rooms and is drawn inside its grid lines. A battle's creatures then go on the nearest free floor squares
// of the room their spots point at, spreading out from it, never onto rock or walls.

const cache = new Map();

// The floor squares of a picture (bytes) on its grid ({ size, offsetX, offsetY } in the picture's pixels), as a Set of
// "col,row"; null when the picture cannot be read. Kept for the same picture and grid.
async function floorSquares(key, bytes, grid) {
  const cacheKey = `${key}|${grid.size}|${grid.offsetX}|${grid.offsetY}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  let found = null;
  try {
    const sharp = require("sharp");
    const { data, info } = await sharp(bytes, { limitInputPixels: 200_000_000 }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const size = Number(grid.size);
    const ox = ((Number(grid.offsetX) || 0) % size + size) % size;
    const oy = ((Number(grid.offsetY) || 0) % size + size) % size;
    const at = (x, y) => data[Math.min(info.height - 1, Math.max(0, y)) * info.width + Math.min(info.width - 1, Math.max(0, x))];
    const mean = (x0, x1, y0, y1) => {
      let sum = 0;
      let n = 0;
      for (let y = Math.round(y0); y < Math.round(y1); y += 1) for (let x = Math.round(x0); x < Math.round(x1); x += 1) (sum += at(x, y)), (n += 1);
      return n ? sum / n : 0;
    };
    const cols = Math.floor((info.width - ox) / size);
    const rows = Math.floor((info.height - oy) / size);
    const squares = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const left = ox + col * size;
        const top = oy + row * size;
        const inside = mean(left + size * 0.25, left + size * 0.75, top + size * 0.25, top + size * 0.75);
        // Its grid lines: a floor square is drawn inside darker lines on at least two sides.
        const w = Math.max(2, size * 0.06);
        const edges = [mean(left - w, left + w, top + 2 * w, top + size - 2 * w), mean(left + size - w, left + size + w, top + 2 * w, top + size - 2 * w), mean(left + 2 * w, left + size - 2 * w, top - w, top + w), mean(left + 2 * w, left + size - 2 * w, top + size - w, top + size + w)];
        squares.push({ col, row, inside, lines: edges.filter((edge) => inside - edge > 18).length });
      }
    }
    // Light and dark squares split where they part best (Otsu): the floor is the light side.
    const hist = new Array(256).fill(0);
    for (const square of squares) hist[Math.round(square.inside)] += 1;
    let total = 0;
    for (let i = 0; i < 256; i += 1) total += i * hist[i];
    let best = 0;
    let threshold = 128;
    let weight = 0;
    let sumBelow = 0;
    for (let i = 0; i < 256; i += 1) {
      weight += hist[i];
      if (!weight) continue;
      const rest = squares.length - weight;
      if (!rest) break;
      sumBelow += i * hist[i];
      const between = weight * rest * (sumBelow / weight - (total - sumBelow) / rest) ** 2;
      if (between > best) (best = between), (threshold = i);
    }
    // Not the map's outer row and column (its frame and title banners).
    found = new Set(squares.filter((square) => square.inside > threshold && square.lines >= 2 && square.row > 0 && square.col > 0 && square.row < rows - 1 && square.col < cols - 1).map((square) => `${square.col},${square.row}`));
    if (found.size < 4) found = null;
  } catch {
    found = null;
  }
  cache.set(cacheKey, found);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return found;
}

// Each wanted spot ({ x, y } in the picture's pixels) moved onto a free floor square: the room is the floor joined to
// the square nearest the spots' middle; each creature takes the free square of it nearest its own spot. taken:
// squares already held ("col,row"). Spots stay where they are when there is no floor near.
function placeOnFloor(spots, floor, grid, taken = new Set()) {
  if (!floor || !spots.length) return spots;
  const size = Number(grid.size);
  const ox = ((Number(grid.offsetX) || 0) % size + size) % size;
  const oy = ((Number(grid.offsetY) || 0) % size + size) % size;
  const squareOf = (spot) => ({ col: Math.floor((spot.x - ox) / size), row: Math.floor((spot.y - oy) / size) });
  const centre = (col, row) => ({ x: ox + (col + 0.5) * size, y: oy + (row + 0.5) * size });
  const cells = [...floor].map((key) => key.split(",").map(Number));
  const middle = squareOf({ x: spots.reduce((sum, spot) => sum + spot.x, 0) / spots.length, y: spots.reduce((sum, spot) => sum + spot.y, 0) / spots.length });
  // The floor square nearest the middle (within four squares), and every floor square joined to it.
  const near = cells.map(([col, row]) => ({ col, row, d: Math.hypot(col - middle.col, row - middle.row) })).filter((cell) => cell.d <= 4).sort((a, b) => a.d - b.d)[0];
  if (!near) return spots;
  const room = new Set();
  const queue = [[near.col, near.row]];
  room.add(`${near.col},${near.row}`);
  while (queue.length && room.size < 400) {
    const [col, row] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${col + dc},${row + dr}`;
      if (floor.has(key) && !room.has(key)) room.add(key), queue.push([col + dc, row + dr]);
    }
  }
  const free = [...room].filter((key) => !taken.has(key)).map((key) => key.split(",").map(Number));
  return spots.map((spot) => {
    const want = squareOf(spot);
    if (!free.length) return spot;
    free.sort((a, b) => Math.hypot(a[0] - want.col, a[1] - want.row) - Math.hypot(b[0] - want.col, b[1] - want.row));
    const [col, row] = free.shift();
    taken.add(`${col},${row}`);
    return { ...spot, ...centre(col, row) };
  });
}

module.exports = { floorSquares, placeOnFloor };
