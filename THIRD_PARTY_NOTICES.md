# Third-party software, models and assets

SNAPMON's own code: see the repository. Everything below is served from the deployed site itself (vendored, pinned
versions) and is intended to be bundled in a future Android app.

| Component | Use | Licence | Source |
|---|---|---|---|
| TensorFlow.js 4.22.0 | runtime for the detector + classifier part of the recognition engine | Apache-2.0 | https://github.com/tensorflow/tfjs |
| @tensorflow-models/mobilenet 2.1.1 | MobileNet wrapper | Apache-2.0 | https://github.com/tensorflow/tfjs-models |
| @tensorflow-models/coco-ssd 2.2.3 | COCO-SSD wrapper | Apache-2.0 | https://github.com/tensorflow/tfjs-models |
| MobileNet v2 weights (ImageNet) | production classifier | Apache-2.0 (TF Hub / Kaggle Models) | tfhub.dev/google/imagenet/mobilenet_v2_100_224 |
| SSDLite MobileNet v2 weights (COCO) | production detector | Apache-2.0 | storage.googleapis.com/tfjs-models |
| ONNX Runtime Web 1.20.1 | runtime for the TinyCLIP part of the recognition engine | MIT | https://github.com/microsoft/onnxruntime |
| TinyCLIP ViT-39M/16 (Microsoft) weights | vocabulary model of the standard recognition engine | MIT | https://github.com/microsoft/Cream/tree/main/TinyCLIP, https://huggingface.co/wkcn |
| Google Fonts: Silkscreen, Space Grotesk | UI fonts | SIL Open Font License 1.1 | fonts.google.com |

Evaluated but **not shipped**: Apple MobileCLIP / MobileCLIP2 (Apple ML research licence, non-commercial),
MetaCLIP (CC-BY-NC), OpenAI CLIP ViT-B/32 (used only as an accuracy reference in the lab; its model card discourages
deployment), SigLIP (Apache-2.0 but ≥ 90 MB vision tower). Transformers.js is not used.

The lab's evaluation photos come from Wikimedia Commons, are downloaded only inside CI for measurement, and are never
committed or deployed.
