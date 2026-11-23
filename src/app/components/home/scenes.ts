// Both three.js scenes behind one dynamic import. Imported separately, Turbopack
// put three, fiber and drei into each scene's chunk, and the home page, which
// shows both, downloaded the same 1 MB twice.
export { default as GlassTitleScene } from "./GlassTitleScene";
export { default as PhoneStageScene } from "./PhoneStageScene";
