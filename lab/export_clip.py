"""Export a CLIP-style model for SnapMon's experimental lens (runs in GitHub Actions).
Writes <out>/<variant>/: vision.onnx (int8 weights, MatMul/Gemm only), vision_fp32.onnx (optional),
vocab.bin (float16 text embeddings, one row per vocabulary label), vocab.json (labels, preprocessing, scale).
Usage: python lab/export_clip.py <hf_model_id> <variant> <vocab-labels.json> <out_dir> [calib.json]"""
import json, os, sys, time
import numpy as np, torch
from transformers import CLIPModel, CLIPTokenizer

model_id, variant, vocab_path, out_root = sys.argv[1:5]
calib_path = sys.argv[5] if len(sys.argv) > 5 else None
out = os.path.join(out_root, variant); os.makedirs(out, exist_ok=True)
t0 = time.time()
model = CLIPModel.from_pretrained(model_id).eval()
tok = CLIPTokenizer.from_pretrained(model_id)
size = model.config.vision_config.image_size
mean, std = [0.48145466, 0.4578275, 0.40821073], [0.26862954, 0.26130258, 0.27577711]

class Vision(torch.nn.Module):
    def __init__(self, m): super().__init__(); self.m = m
    def forward(self, pixel_values):
        f = self.m.get_image_features(pixel_values=pixel_values)
        return f / f.norm(dim=-1, keepdim=True)

fp32 = os.path.join(out, 'vision_fp32.onnx')
torch.onnx.export(Vision(model), torch.randn(1, 3, size, size), fp32, input_names=['pixel_values'], output_names=['image_embeds'],
                  dynamic_axes={'pixel_values': {0: 'n'}, 'image_embeds': {0: 'n'}}, opset_version=17, do_constant_folding=True,
                  **({'dynamo': False} if 'dynamo' in torch.onnx.export.__code__.co_varnames else {}))
from onnxruntime.quantization import quantize_dynamic, QuantType
q8 = os.path.join(out, 'vision.onnx')
quantize_dynamic(fp32, q8, weight_type=QuantType.QUInt8, op_types_to_quantize=['MatMul', 'Gemm'])

# quantisation sanity check: int8 vs fp32 embeddings should agree
import onnxruntime as ort
x = np.random.RandomState(0).randn(2, 3, size, size).astype(np.float32)
a = ort.InferenceSession(fp32).run(None, {'pixel_values': x})[0]; b = ort.InferenceSession(q8).run(None, {'pixel_values': x})[0]
agree = float((a * b).sum(-1).mean())

labels = json.load(open(vocab_path))
templates = ['a photo of a {}.', 'a close-up photo of a {}.', 'a photo of the {}, an everyday object.', 'a blurry photo of a {}.']
embs = []
with torch.no_grad():
    for i in range(0, len(labels), 256):
        chunk = [l['l'] for l in labels[i:i + 256]]
        acc = None
        for t in templates:
            enc = tok([t.format(c) for c in chunk], padding=True, truncation=True, max_length=77, return_tensors='pt')
            f = model.get_text_features(**enc); f = f / f.norm(dim=-1, keepdim=True)
            acc = f if acc is None else acc + f
        acc = acc / acc.norm(dim=-1, keepdim=True)
        embs.append(acc.numpy())
E = np.concatenate(embs).astype(np.float16)
E.tofile(os.path.join(out, 'vocab.bin'))
meta = {
    'name': model_id, 'variant': variant, 'model': 'vision.onnx', 'dim': int(E.shape[1]), 'scale': float(model.logit_scale.exp().item()),
    'image': {'size': size, 'mean': mean, 'std': std}, 'labels': labels, 'templates': templates,
    'sizes': {'vision_int8': os.path.getsize(q8), 'vision_fp32': os.path.getsize(fp32), 'vocab': os.path.getsize(os.path.join(out, 'vocab.bin'))},
    'int8_vs_fp32_cosine': round(agree, 4), 'license': 'MIT (TinyCLIP, Microsoft)' if 'TinyCLIP' in model_id else 'see model card',
}
if calib_path and os.path.exists(calib_path): meta['calib'] = json.load(open(calib_path))
json.dump(meta, open(os.path.join(out, 'vocab.json'), 'w'))
print(f"EXPORT {variant}: dim={E.shape[1]} labels={len(labels)} int8={os.path.getsize(q8)/1048576:.1f}MB fp32={os.path.getsize(fp32)/1048576:.1f}MB vocab={os.path.getsize(os.path.join(out,'vocab.bin'))/1048576:.1f}MB int8~fp32 cos={agree:.4f} scale={meta['scale']:.1f} took {time.time()-t0:.0f}s")
