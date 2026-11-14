// Bumps for painted textures, as pure maths (node:test): a colour picture is read as a height field (bright =
// proud, dark = recessed: grout lines, cracks, the gaps between tiles), smoothed, and turned into a tangent-space
// normal map and a roughness map. Everything wraps round the edges, so the result tiles like the picture did.

/** Heights 0..1 from RGBA bytes (the picture's luminance). */
export function heightsFrom(rgba, w, h) {
  const out = new Float32Array(w * h);
  for (let k = 0; k < w * h; k += 1) out[k] = (0.2126 * rgba[k * 4] + 0.7152 * rgba[k * 4 + 1] + 0.0722 * rgba[k * 4 + 2]) / 255;
  return out;
}

/** A 3x3 box blur that wraps (returns a new array): paint speckle should not become gravel. */
export function soften(heights, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const [ya, yb] = [(y + h - 1) % h, (y + 1) % h];
    for (let x = 0; x < w; x += 1) {
      const [xa, xb] = [(x + w - 1) % w, (x + 1) % w];
      out[y * w + x] = (heights[ya * w + xa] + heights[ya * w + x] + heights[ya * w + xb] + heights[y * w + xa] + heights[y * w + x] + heights[y * w + xb]
        + heights[yb * w + xa] + heights[yb * w + x] + heights[yb * w + xb]) / 9;
    }
  }
  return out;
}

/**
 * RGBA bytes of a normal map from heights (Sobel, wrapping). `strength` scales the slopes; a flat field gives
 * (128, 128, 255). Canvas rows run down while v runs up, so the green channel is flipped to match.
 */
export function normalsFrom(heights, w, h, strength = 1) {
  const out = new Uint8ClampedArray(w * h * 4);
  const at = (x, y) => heights[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const nx = -dx * strength;
      const ny = dy * strength;
      const l = Math.hypot(nx, ny, 1);
      const k = (y * w + x) * 4;
      out[k] = (nx / l * 0.5 + 0.5) * 255;
      out[k + 1] = (ny / l * 0.5 + 0.5) * 255;
      out[k + 2] = (1 / l * 0.5 + 0.5) * 255;
      out[k + 3] = 255;
    }
  }
  return out;
}

/**
 * RGBA bytes of a roughness map (three.js reads green): recessed, dirty parts are rougher (`hi`), the proud,
 * clean ones smoother (`lo`). The material's own roughness multiplies it.
 */
export function roughnessFrom(heights, w, h, lo = 0.72, hi = 1) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let k = 0; k < w * h; k += 1) {
    const v = (hi - (hi - lo) * Math.max(0, Math.min(1, heights[k]))) * 255;
    out[k * 4] = v;
    out[k * 4 + 1] = v;
    out[k * 4 + 2] = 0;
    out[k * 4 + 3] = 255;
  }
  return out;
}
