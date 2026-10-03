import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface FrameConfig {
  intervalSeconds: number;
  maxFramesPerScene: number;
  quality: number;
}

const DEFAULT_CONFIG: FrameConfig = {
  intervalSeconds: 12,
  maxFramesPerScene: 6,
  quality: 3 // ffmpeg -q:v 3
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDuration(videoPath: string): number {
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
    { encoding: 'utf-8' }
  );
  return parseFloat(result.trim());
}

function extractFramesAtInterval(
  videoPath: string,
  outputDir: string,
  intervalSeconds: number,
  startTime: number = 0,
  duration: number = 0
): number {
  const args = [
    '-i', `"${videoPath}"`,
    '-vf', `fps=1/${intervalSeconds}`,
    '-q:v', '3',
    '-start_number', '1'
  ];

  if (startTime > 0) {
    args.push('-ss', String(startTime));
  }
  if (duration > 0) {
    args.push('-t', String(duration));
  }

  args.push(`"${path.join(outputDir, 'frame_%04d.jpg')}"`);

  execSync(`ffmpeg ${args.join(' ')}`, { stdio: 'inherit' });

  // Count extracted frames
  return fs.readdirSync(outputDir).filter(f => f.endsWith('.jpg')).length;
}

function main() {
  const videoPath = process.argv[2];
  const outputDir = process.argv[3];
  const interval = parseInt(process.argv[4] || String(DEFAULT_CONFIG.intervalSeconds), 10);

  if (!videoPath || !outputDir) {
    console.error('Usage: ts-node extract_frames.ts <video.mp4> <outputDir> [intervalSeconds]');
    process.exit(1);
  }

  ensureDir(outputDir);

  console.log(`Extracting frames from: ${videoPath}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Interval: every ${interval} seconds`);

  const duration = getDuration(videoPath);
  console.log(`Video duration: ${duration.toFixed(1)}s`);

  const frameCount = extractFramesAtInterval(videoPath, outputDir, interval);
  console.log(`Extracted ${frameCount} frames`);
}

main();
