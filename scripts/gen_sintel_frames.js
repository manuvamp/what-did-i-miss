// Generate frames.json from the extracted seq_XXXX.jpg frames,
// mapping each to its scene and a one-line caption derived from scenes.json.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'content', 'sintel');
const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenes.json'), 'utf-8'));
const framesDir = path.join(ROOT, 'frames');
const files = fs.readdirSync(framesDir).filter(f => /^seq_\d+\.jpg$/.test(f)).sort();

function captionFor(sceneId) {
  const captions = {
    scene_01: 'Sintel walks through the snow',
    scene_02: 'Sintel struggles in a blizzard',
    scene_03: 'Sintel is rescued by the shaman',
    scene_04: 'Sintel meets the baby dragon Scales',
    scene_05: 'The shaman teaches Sintel to kill',
    scene_06: 'Scales comforts Sintel; dragon trophies visible',
    scene_07: 'Sintel plays with Scales; shaman at the forge',
    scene_08: 'The shaman gives Sintel the sword and map',
    scene_09: 'Sintel leaves the hut',
    scene_10: 'Sintel journeys to the dragon cave',
    scene_11: 'Sintel explores the cave',
    scene_12: 'The dragon\'s story is shown; adult dragon appears',
    scene_13: 'Sintel fights the dragon; the recognition',
    scene_14: 'Sintel mourns the dying dragon'
  };
  return captions[sceneId] || '';
}

const frames = files.map(f => {
  const seq = parseInt(f.match(/seq_(\d+)/)[1], 10);
  const timestampMs = (seq - 1) * 3000;
  const scene = scenes.find(s => timestampMs >= s.startMs && timestampMs < s.endMs);
  return {
    id: `frame_${String(seq).padStart(3, '0')}`,
    timestampMs,
    sceneId: scene ? scene.id : null,
    path: `frames/${f}`,
    description: scene ? captionFor(scene.id) : 'Credits'
  };
});

fs.writeFileSync(path.join(ROOT, 'frames.json'), JSON.stringify(frames, null, 2));
console.log(`Wrote ${frames.length} frame references to frames.json`);
