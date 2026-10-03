import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  contentDir: process.env.CONTENT_DIR || path.join(__dirname, '..', '..', 'content'),
  aiProvider: process.env.AI_PROVIDER || 'deterministic',
  bedrock: {
    region: process.env.AWS_REGION || 'us-east-1',
    modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0'
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  },
  cache: {
    recapTtlMs: parseInt(process.env.RECAP_CACHE_TTL_MS || '86400000', 10),
    maxEntries: parseInt(process.env.RECAP_CACHE_MAX || '500', 10)
  }
};
