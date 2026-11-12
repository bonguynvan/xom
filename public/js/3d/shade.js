// Several small additions to one material's shader (the cascaded shadows, the wet weather, a detail map…)
// without each overwriting the other's onBeforeCompile: every addition is a named hook, run in order, and the
// names make the program cache key, so two materials share a program only when they have the same hooks.
const hooks = new WeakMap(); // material -> [{ key, fn }]   (not userData: Material.clone() would copy it as JSON)
let serial = 0;

/** Add `fn(shader, renderer)` to what happens when `material` is compiled. `key` names what fn does to the source. */
export function hook(material, key, fn) {
  let list = hooks.get(material);
  if (!list) {
    list = [];
    if (Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')) { serial += 1; list.push({ key: `own${serial}`, fn: material.onBeforeCompile }); }
    hooks.set(material, list);
    material.onBeforeCompile = (shader, renderer) => { for (const h of list) h.fn(shader, renderer); };
    material.customProgramCacheKey = () => list.map((h) => h.key).join('|');
  }
  if (list.some((h) => h.key === key)) return material;
  list.push({ key, fn });
  material.needsUpdate = true;
  return material;
}

export const hooked = (material, key) => Boolean(hooks.get(material)?.some((h) => h.key === key));

/** Every lit material under an object (standard, physical, lambert, phong), each once. */
export function litMaterials(root) {
  const out = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m?.isMeshStandardMaterial || m?.isMeshLambertMaterial || m?.isMeshPhongMaterial) out.add(m);
  });
  return [...out];
}
