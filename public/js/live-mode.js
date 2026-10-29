// "?live=1": the page as a livestream source (OBS Browser Source, YouTube): no buttons, a bigger clock and
// loudspeaker, the address in a corner, and the music on by itself (OBS lets pages play sound without a click).

/** True for `?live`, `?live=1`, `?live=yes`…; false when absent or `0` / `false` / `no`. */
export function isLiveMode(search) {
  const value = new URLSearchParams(search).get('live');
  return value !== null && !['0', 'false', 'no'].includes(value.trim().toLowerCase());
}
