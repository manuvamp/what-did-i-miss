import express from 'express';
import cors from 'cors';
import path from 'path';
import { recapRouter } from './api/recap';
import { questionRouter } from './api/question';
import { contentRouter } from './api/content';
import { config } from './config';

const app = express();

app.use(cors());
app.use(express.json());

// Serve packaged HLS so the emulator can reach the demo film at
// http://10.0.2.2:3000/hls/sintel/index.m3u8
const hlsDir = path.resolve(__dirname, '..', '..', 'dist', 'hls');
app.use('/hls', express.static(hlsDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.m3u8')) res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    if (filePath.endsWith('.ts')) res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Request logging with latency (no raw dialogue)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      `[api] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`
    );
  });
  next();
});

app.use('/api/recap', recapRouter);
app.use('/api/question', questionRouter);
app.use('/api/content', contentRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    provider: config.aiProvider,
    contentDir: config.contentDir,
    timestamp: new Date().toISOString()
  });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`What Did I Miss? backend running on port ${config.port}`);
    console.log(`Content dir: ${config.contentDir}`);
    console.log(`AI provider: ${config.aiProvider}`);
  });
}

export default app;
