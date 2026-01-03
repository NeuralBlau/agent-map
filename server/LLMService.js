import axios from 'axios';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:4b';

/**
 * LLMService - Unified service for interacting with target LLM (Ollama)
 */
export async function callLLM(prompt, agentName = 'Generic', format = 'json', context = 'General') {
    try {
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: prompt,
            stream: false,
            // format: format // REMOVED: format: 'json' enforces strict JSON output, suppressing CoT reasoning
        }, { timeout: 45000 });

        const content = response.data.response;

        if (format === 'json') {
            try {
                // Pre-processing: Standardize quotes (handle smart quotes from LLM)
                let cleanedContent = content
                    .replace(/[\u201C\u201D]/g, '"')  // Replace smart double quotes
                    .replace(/[\u2018\u2019]/g, "'"); // Replace smart single quotes (less critical for JSON but good practice)

                console.log(`[LLMService][${context}] Raw Content from ${agentName}:\n${content}\n-------------------`);

                // Strategy 1: Look for markdown code blocks
                const jsonBlockRegex = /```json\n([\s\S]*?)\n```/;
                const blockMatch = cleanedContent.match(jsonBlockRegex);
                if (blockMatch) {
                    return JSON.parse(blockMatch[1]);
                }

                // Strategy 2: Look for the *last* valid JSON object in the text
                const lastBraceIndex = cleanedContent.lastIndexOf('}');
                if (lastBraceIndex !== -1) {
                    let startIndex = cleanedContent.indexOf('{');
                    while (startIndex !== -1 && startIndex < lastBraceIndex) {
                        const potentialJson = cleanedContent.substring(startIndex, lastBraceIndex + 1);
                        try {
                            const parsed = JSON.parse(potentialJson);
                            console.log(`[LLMService][${context}] Extracted valid JSON from mixed content.`);
                            return parsed;
                        } catch (e) {
                             // Valid JSON not found starting at this {, try next one
                             startIndex = cleanedContent.indexOf('{', startIndex + 1);
                        }
                    }
                }

                // Fallback: simple match
                const simpleMatch = cleanedContent.match(/{[\s\S]*}/);
                if (simpleMatch) {
                     return JSON.parse(simpleMatch[0]);
                }
                
                throw new Error("No valid JSON found in response");

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
