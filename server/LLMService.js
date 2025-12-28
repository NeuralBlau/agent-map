import axios from 'axios';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:4b';

/**
 * LLMService - Unified service for interacting with target LLM (Ollama)
 */
export async function callLLM(prompt, agentName = 'Generic', format = 'json') {
    try {
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: prompt,
            stream: false,
            format: format
        }, { timeout: 45000 });

        const content = response.data.response;

        if (format === 'json') {
            try {
                return JSON.parse(content);
            } catch (e) {
                console.error(`[LLMService] Failed to parse JSON for ${agentName}:`, e.message);
                console.debug(`[LLMService] Raw content:`, content);
                return null;
            }
        }

        return content;
    } catch (error) {
        console.error(`[LLMService] Error calling LLM for ${agentName}:`, error.message);
        return null;
    }
}
