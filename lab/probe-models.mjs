// Lab: list candidate on-device image-text models with license and ONNX file sizes (runs in GitHub Actions).
const HF = 'https://huggingface.co/api/models';
const searches = ['TinyCLIP', 'mobileclip', 'clip-vit-base-patch32', 'clip-vit-base-patch16', 'siglip-base-patch16-224', 'siglip2-base', 'clip-ViT-B-32', 'nomic-embed-vision', 'jina-clip', 'Unicom', 'clip'];
const authors = ['Xenova', 'onnx-community', 'Qdrant', 'wkcn', 'apple', 'jinaai', 'nomic-ai', 'google', 'laion', 'openai', 'timm'];
const seen = new Map();
async function j(url) { const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }
for (const q of searches) {
  try {
    const list = await j(`${HF}?search=${encodeURIComponent(q)}&limit=100&sort=downloads`);
    for (const m of list) if (authors.includes(m.id.split('/')[0]) && !seen.has(m.id)) seen.set(m.id, m);
  } catch (e) { console.log('search failed', q, e.message); }
}
const rows = [];
for (const id of seen.keys()) {
  if (!/clip|siglip|unicom|nomic-embed-vision/i.test(id)) continue;
  try {
    const m = await j(`${HF}/${id}?blobs=true`);
    const lic = (m.cardData && m.cardData.license) || (m.tags || []).find(t => t.startsWith('license:')) || '?';
    const onnx = (m.siblings || []).filter(s => /\.onnx(_data)?$/.test(s.rfilename)).map(s => `${s.rfilename}=${(s.size / 1048576).toFixed(1)}MB`);
    const libs = (m.tags || []).filter(t => ['transformers.js', 'onnx', 'open_clip', 'transformers', 'timm'].includes(t));
    rows.push(`${id} | license=${lic} | libs=${libs.join(',')} | downloads=${m.downloads} | ${onnx.length ? onnx.join(' ') : 'no-onnx'}`);
  } catch (e) { rows.push(`${id} | error ${e.message}`); }
}
console.log('=== CANDIDATES (' + rows.length + ') ===');
for (const r of rows.sort()) console.log(r);
