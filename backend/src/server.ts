import express from 'express';
import cors from 'cors';
import { recapRouter } from './api/recap';
import { questionRouter } from './api/question';
import { contentRouter } from './api/content';
import { config } from './config';

const app = express();

app.use(cors());
app.use(express.json());

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
