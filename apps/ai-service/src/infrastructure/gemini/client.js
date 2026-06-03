import { GoogleGenAI } from '@google/genai';
import { getConfig } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

let clientInstance = null;

export function getGeminiClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const { geminiApiKey } = getConfig();

  if (!geminiApiKey) {
    throw new AppError('GEMINI_API_KEY is not configured', {
      statusCode: 500,
      code: 'AI_CONFIG_ERROR',
    });
  }

  clientInstance = new GoogleGenAI({ apiKey: geminiApiKey });
  return clientInstance;
}

export function resetGeminiClientForTests() {
  clientInstance = null;
}
