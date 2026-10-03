// Build 4x4 contact-sheet montages with timestamps burned in, via
// ffmpeg filter_complex_script files (avoids Windows quoting issues).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FF = 'C:\\Users\\cocat\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const ROOT = path.resolve(__dirname, '..', 'content', 'sintel');
const FRAMES = path.join(ROOT, 'frames');
const OUT = path.join(ROOT, 'sheets');
const FILTER_DIR = path.join(ROOT, 'filters');

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(FILTER_DIR, { recursive: true });

const frameFiles = fs.readdirSync(FRAMES).filter(f => /^seq_\d+\.jpg$/.test(f)).sort();
console.log(`Total frames: ${frameFiles.length}`);

const PER_SHEET = 16;
const sheets = Math.ceil(frameFiles.length / PER_SHEET);

// Split n frames into up to 4 rows with equal widths (width <= 4).
function greedyRows(n) {
  for (let rows = 1; rows <= 4; rows++) {
    if (n % rows === 0 && n / rows <= 4) return Array(rows).fill(n / rows);
  }
  // No perfect split: use balanced rows, largest first
  const rows = Math.min(4, Math.ceil(n / 4));
  const base = Math.floor(n / rows);
  const extra = n % rows;
  const layout = [];
  for (let i = 0; i < rows; i++) layout.push(base + (i < extra ? 1 : 0));
  return layout;
}

function mmss(ms) {
  const s = Math.floor(ms / 1000);
  const str = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  // FFmpeg filter args split on ':' — backslash-escape the time colon.
  return str.replace(':', String.fromCharCode(92) + ':');
}

for (let sheetIdx = 0; sheetIdx < sheets; sheetIdx++) {
  const slice = frameFiles.slice(sheetIdx * PER_SHEET, (sheetIdx + 1) * PER_SHEET);
  const inputs = [];
  const chains = [];

  slice.forEach((f, i) => {
    const seq = parseInt(f.match(/seq_(\d+)/)[1], 10); // 1-based
    const tsMs = (seq - 1) * 3000;
    inputs.push('-i', path.join(FRAMES, f).includes(' ') ? `"${path.join(FRAMES, f)}"` : path.join(FRAMES, f));
    // Force every cell to exactly 320x140 (covers the 640x273 source aspect)
    // so hstack/vstack widths are deterministic.
    chains.push(
      `[${i}:v]scale=320:140:force_original_aspect_ratio=decrease,pad=320:140:(ow-iw)/2:(oh-ih)/2:black,setsar=1,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${mmss(tsMs)}':x=6:y=h-th-6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.7[cell${i}]`
    );
  });

  // Layout the ragged last sheet as complete rows: N frames => rows of:
  // 14 -> 4,4,3,3 | 13 -> 4,3,3,3 | 12 -> 3,3,3,3 | else greedy
  const n = slice.length;
  const layout = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].includes(n)
    ? greedyRows(n)
    : [4, 4, 4, 4];
  let cellCursor = 0;
  const rowLabels = [];
  const maxRowWidth = Math.max(...layout);
  layout.forEach((width, r) => {
    const cells = [];
    for (let c = 0; c < width; c++) cells.push(`[cell${cellCursor++}]`);
    chains.push(`${cells.join('')}hstack=inputs=${width}[row${r}raw]`);
    // vstack needs equal widths: pad short rows with black
    if (width < maxRowWidth) {
      chains.push(`[row${r}raw]pad=${maxRowWidth * 320}:ih:0:0:black[row${r}]`);
    } else {
      chains.push(`[row${r}raw]copy[row${r}]`);
    }
    rowLabels.push(`[row${r}]`);
  });
  chains.push(`${rowLabels.join('')}vstack=inputs=${rowLabels.length}[sheet]`);

  const scriptPath = path.join(FILTER_DIR, `sheet_${String(sheetIdx + 1).padStart(3, '0')}.txt`);
  fs.writeFileSync(scriptPath, chains.join(';\n') + '\n');

  const outPath = path.join(OUT, `sheet_${String(sheetIdx + 1).padStart(3, '0')}.jpg`);
  const cmd = `"${FF}" -hide_banner -y ${inputs.join(' ')} -/filter_complex "${scriptPath}" -map "[sheet]" -q:v 4 "${outPath}"`;
  const env = Object.assign({}, process.env, {
    FONTCONFIG_FILE: path.join(FILTER_DIR, 'fonts.conf'),
    FONTCONFIG_PATH: FILTER_DIR
  });
  try {
    execSync(cmd, { stdio: 'pipe', env });
    console.log(`OK sheet ${sheetIdx + 1}/${sheets} (${slice.length} frames)`);
  } catch (e) {
    const stderr = (e.stderr && e.stderr.toString()) || e.message;
    console.error(`FAIL sheet ${sheetIdx + 1}: ${stderr.slice(-600)}`);
    process.exit(1);
  }
}
console.log('Done.');
