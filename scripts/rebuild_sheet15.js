const { execSync } = require('child_process');
const path = require('path');
const FF = 'C:\\Users\\cocat\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const R = path.resolve(__dirname, '..', 'content', 'sintel');
const inputs = [];
for (let i = 225; i <= 238; i++) {
  const f = path.join(R, 'frames', `seq_${String(i).padStart(4, '0')}.jpg`).replace(/\\/g, '/');
  inputs.push('-i', `"${f}"`);
}
const filter = path.join(R, 'filters', 'sheet_015.txt').replace(/\\/g, '/');
const out = path.join(R, 'sheets', 'sheet_015.jpg').replace(/\\/g, '/');
const cmd = `"${FF}" -hide_banner -y ${inputs.join(' ')} -/filter_complex "${filter}" -map "[sheet]" -q:v 4 "${out}"`;
console.log(cmd);
try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('SUCCESS');
} catch (e) {
  process.exit(1);
}
