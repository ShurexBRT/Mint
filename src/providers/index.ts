import type { z } from 'zod';
export interface ProviderResult<T> { output: T; estimatedTokens: number; estimatedCost: 0 }
export interface LLMProvider {
  readonly name: string;
  generateStructured<T>(request: { task: string; input: unknown; schema: z.ZodType<T>; local: () => unknown }): Promise<ProviderResult<T>>;
  generateText(request: { task: string; local: () => string }): Promise<ProviderResult<string>>;
}
// No network client, API key, model download, or paid adapter is included.
export class DeterministicLocalProvider implements LLMProvider {
  readonly name = 'deterministic-local';
  async generateStructured<T>(request: { task: string; input: unknown; schema: z.ZodType<T>; local: () => unknown }): Promise<ProviderResult<T>> {
    return { output: request.schema.parse(request.local()), estimatedTokens: 0, estimatedCost: 0 };
  }
  async generateText(request: { task: string; local: () => string }): Promise<ProviderResult<string>> {
    return { output: request.local(), estimatedTokens: 0, estimatedCost: 0 };
  }
}
export { DeterministicLocalProvider as FakeLLMProvider };
