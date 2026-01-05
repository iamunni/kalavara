import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(apiKey?: string): OpenAI | null {
  const key = apiKey || process.env.OPENAI_API_KEY;

  if (!key) {
    return null;
  }

  if (!openaiClient || (apiKey && apiKey !== process.env.OPENAI_API_KEY)) {
    openaiClient = new OpenAI({ apiKey: key });
  }

  return openaiClient;
}
