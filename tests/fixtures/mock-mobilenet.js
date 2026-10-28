// Test stand-in for @tensorflow-models/mobilenet (its ImageNet weights cannot be downloaded in CI sandboxes).
// The test sets window.__fakeClassify(img) to return [{className, probability}] in ImageNet label format.
window.mobilenet = {
  async load() {
    return { model: { save: async () => ({}) }, async classify(img, k = 3) { return (window.__fakeClassify ? window.__fakeClassify(img) : []).slice(0, k); } };
  },
};
