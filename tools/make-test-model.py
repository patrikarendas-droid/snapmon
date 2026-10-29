"""Builds a tiny deterministic stand-in for the TinyCLIP image encoder, used ONLY by automated browser tests
(tests/e2e-engine.js). Its "embedding" is the image's mean colour (after CLIP normalisation) projected to 8 dims,
and its vocabulary maps colours to objects (red -> apple, blue -> mug, ...), so tests exercise the real worker,
ONNX Runtime, caching, backend fallback and decision rules with predictable answers.
Usage: python tools/make-test-model.py <out_dir>   (writes vision.onnx, vocab.bin, vocab.json)"""
import json, os, sys
import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper

out = sys.argv[1]; os.makedirs(out, exist_ok=True)
D = 8
# projection: mean RGB (3) + constant -> 8 dims; colour directions live in the first 3 dims
W = np.zeros((3, D), np.float32); W[0, 0] = W[1, 1] = W[2, 2] = 1.0
inp = helper.make_tensor_value_info('pixel_values', TensorProto.FLOAT, ['n', 3, 224, 224])
outp = helper.make_tensor_value_info('image_embeds', TensorProto.FLOAT, ['n', D])
nodes = [
    helper.make_node('GlobalAveragePool', ['pixel_values'], ['gap']),
    helper.make_node('Flatten', ['gap'], ['flat'], axis=1),
    helper.make_node('MatMul', ['flat', 'W'], ['image_embeds']),
]
g = helper.make_graph(nodes, 'testcolor', [inp], [outp], [numpy_helper.from_array(W, 'W')])
m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)]); m.ir_version = 8
onnx.checker.check_model(m)
onnx.save(m, os.path.join(out, 'vision.onnx'))

mean, std = np.array([0.48145466, 0.4578275, 0.40821073]), np.array([0.26862954, 0.26130258, 0.27577711])
def emb(rgb):  # the embedding a flat image of this colour produces, normalised
    v = np.zeros(D); v[:3] = (np.array(rgb) / 255 - mean) / std; return v / np.linalg.norm(v)
LABELS = [('red apple', 'apple', (200, 30, 35)), ('banana', 'banana', (235, 200, 40)), ('coffee mug', 'mug', (35, 80, 205)),
          ('houseplant', 'potted_plant', (50, 160, 60)), ('forklift', 'forklift', (240, 170, 20)), ('a grey wall', None, (128, 128, 128)),
          ('a white wall', None, (235, 235, 235)), ('purple umbrella', 'umbrella', (130, 45, 170))]
E = np.stack([emb(c) for _, _, c in LABELS]).astype(np.float16)
E.tofile(os.path.join(out, 'vocab.bin'))
meta = {'name': 'test colour encoder (not a real model)', 'variant': 'testcolor', 'model': 'vision.onnx', 'dim': D, 'scale': 60.0,
        'image': {'size': 224, 'mean': mean.tolist(), 'std': std.tolist()},
        'labels': [{'l': l, 'o': o} for l, o, _ in LABELS], 'license': 'test fixture',
        'calib': {'accept': {'p': 0.35, 'margin': 0.15}, 'heldOut': {'photos': 100, 'accepted': 30, 'precision': 0.8}}}
json.dump(meta, open(os.path.join(out, 'vocab.json'), 'w'))
print('test model written to', out)
