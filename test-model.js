import { GoogleAuth } from 'google-auth-library';
import { GoogleGenAI } from '@google/genai';

async function run() {
  try {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/generative-language', 'https://www.googleapis.com/auth/cloud-platform'] });
    const token = await auth.getAccessToken();
    const genAI = new GoogleGenAI({ apiKey: token });
    const response = await genAI.models.generateContent({ model: 'gemini-2.0-flash-exp', contents: 'Say Hello' });
    console.log(response.text);
  } catch(e) { console.error("Error:", e.message); }
}
run();
