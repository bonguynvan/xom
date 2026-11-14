// Move the images out of a .glb into files beside it, so the browser loads them from 'self' like any other
// image. GLTFLoader turns embedded images into blob: URLs, which the strict CSP (img-src 'self' data:,
// connect-src 'self') refuses; this keeps the CSP as it is. Run once per model you add:
//   node scripts/unpack-glb.js public/models/soldier.glb
// No dependencies. The .glb is rewritten in place (smaller), the images land as <name>-<k>.<ext>.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const GLB = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const pad4 = (n) => (n + 3) & ~3;

export function unpack(file) {
  const data = readFileSync(file);
  if (data.readUInt32LE(0) !== GLB) throw new Error(`${file}: not a glb`);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < data.length) {
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(chunk.toString('utf8'));
    if (type === BIN_CHUNK) bin = chunk;
    offset += 8 + length;
  }
  const stem = basename(file, extname(file));
  const imageViews = new Set();
  (json.images ?? []).forEach((image, k) => {
    if (image.bufferView === undefined) return;
    const view = json.bufferViews[image.bufferView];
    const ext = image.mimeType === 'image/png' ? 'png' : 'jpg';
    const name = `${stem}-${k}.${ext}`;
    writeFileSync(join(dirname(file), name), bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
    imageViews.add(image.bufferView);
    delete image.bufferView;
    delete image.mimeType;
    image.uri = name;
  });
  // keep only the buffer views something still uses, packed again (4-byte aligned)
  const remap = new Map();
  const parts = [];
  let size = 0;
  json.bufferViews = json.bufferViews.filter((view, k) => {
    if (imageViews.has(k)) return false;
    const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    remap.set(k, remap.size);
    view.byteOffset = size;
    parts.push(bytes, Buffer.alloc(pad4(bytes.length) - bytes.length));
    size = pad4(size + bytes.length);
    return true;
  });
  for (const list of [json.accessors ?? [], json.images ?? []]) for (const item of list) if (item.bufferView !== undefined) item.bufferView = remap.get(item.bufferView);
  for (const accessor of json.accessors ?? []) {
    for (const sparse of [accessor.sparse?.indices, accessor.sparse?.values]) if (sparse) sparse.bufferView = remap.get(sparse.bufferView);
  }
  const newBin = Buffer.concat(parts);
  json.buffers = [{ byteLength: newBin.length }];
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  text = Buffer.concat([text, Buffer.alloc(pad4(text.length) - text.length, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + newBin.length, 8);
  const chunkHead = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  writeFileSync(file, Buffer.concat([header, chunkHead(text.length, JSON_CHUNK), text, chunkHead(newBin.length, BIN_CHUNK), newBin]));
  return [...imageViews].length;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  for (const file of process.argv.slice(2)) console.log(`${file}: ${unpack(file)} ảnh đã tách ra`);
}
