import { AIProvider } from './types';
import { DeterministicProvider } from './DeterministicProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { BedrockProvider } from './BedrockProvider';
import { config } from '../config';

let providerInstance: AIProvider | null = null;

/**
 * Provider selection. "deterministic" needs no credentials and always works.
 * The recap/question services always fall back to deterministic output if
 * the configured provider throws, so the product never hard-fails.
 */
export function getAIProvider(): AIProvider {
  if (providerInstance) return providerInstance;

  switch (config.aiProvider) {
    case 'anthropic':
      providerInstance = new AnthropicProvider();
      break;
    case 'bedrock':
      providerInstance = new BedrockProvider();
      break;
    case 'deterministic':
    case 'mock':
    default:
      providerInstance = new DeterministicProvider();
      break;
  }

  console.log(`[ai] using provider: ${providerInstance.name}`);
  return providerInstance;
}

/** Used by tests to inject a provider. */
export function setAIProvider(provider: AIProvider): void {
  providerInstance = provider;
}
