import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:4b';
const PROMPT_FILE = 'test_prompt.txt';

async function testPrompt() {
    try {
        const promptPath = path.join(__dirname, PROMPT_FILE);
        const prompt = fs.readFileSync(promptPath, 'utf-8');

        console.log(`\n📄 Sending prompt from ${PROMPT_FILE} to ${MODEL}...\n`);
        
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL,
            prompt: prompt,
            stream: false,
            format: 'json'
        }, { timeout: 60000 });

        const rawContent = response.data.response;
        
        console.log('🤖 Raw Response from LLM:');
        console.log('---------------------------------------------------');
        console.log(rawContent);
        console.log('---------------------------------------------------\n');

        // Try parsing JSON if possible
        // Try parsing JSON if possible
        try {
            // Strategy 1: Look for markdown code blocks
            const jsonBlockRegex = /```json\n([\s\S]*?)\n```/;
            const blockMatch = rawContent.match(jsonBlockRegex);
            if (blockMatch) {
                const parsed = JSON.parse(blockMatch[1]);
                console.log('✅ Parsed JSON (from markdown block):');
                console.log(JSON.stringify(parsed, null, 2));
                return;
            }

            // Strategy 2: Look for the text after the last '}' and scan backwards
            const lastBraceIndex = rawContent.lastIndexOf('}');
            if (lastBraceIndex !== -1) {
                let startIndex = rawContent.indexOf('{');
                while (startIndex !== -1 && startIndex < lastBraceIndex) {
                    const potentialJson = rawContent.substring(startIndex, lastBraceIndex + 1);
                    try {
                        const parsed = JSON.parse(potentialJson);
                        console.log('✅ Parsed JSON (via backward scan):');
                        console.log(JSON.stringify(parsed, null, 2));
                        return;
                    } catch (e) {
                         // Valid JSON not found starting at this {, try next one
                         startIndex = rawContent.indexOf('{', startIndex + 1);
                    }
                }
            }
            
            // Fallback
             const jsonRegex = /```json\n([\s\S]*?)\n```|{[\s\S]*}/;
             const jsonMatch = rawContent.match(jsonRegex);
             if (jsonMatch) {
                 const parsed = JSON.parse(jsonMatch[0]);
                 console.log('✅ Parsed JSON (regex fallback):');
                 console.log(JSON.stringify(parsed, null, 2));
             } else {
                 throw new Error("No JSON found");
             }

        } catch (e) {
            console.warn('⚠️ Could not parse JSON from response.');
        }

    } catch (error) {
        console.error('❌ Error executing test:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testPrompt();
