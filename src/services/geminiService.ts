import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in the environment.");
}

export const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const DEFAULT_MODEL = "gemini-3-flash-preview";

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
}

export interface Message {
  role: "user" | "model";
  content: string;
  thought?: string;
  timestamp: number;
  files?: FileAttachment[];
}

export interface ChatOptions {
  thinkingLevel?: ThinkingLevel;
  systemInstruction?: string;
}

export async function generateChatTitle(messages: Message[]): Promise<string> {
  if (messages.length === 0) return "Новый чат";
  
  try {
    const prompt = `Проанализируй начало диалога и придумай очень короткое (2-4 слова) название для этого чата на русском языке. 
    Верни ТОЛЬКО название, без кавычек и лишних знаков.
    
    Диалог:
    ${messages.slice(0, 2).map(m => `${m.role === 'user' ? 'Пользователь' : 'ИИ'}: ${m.content}`).join('\n')}`;
    
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    return response.text?.trim().replace(/^"|"$/g, '') || "Новый чат";
  } catch (error) {
    console.error("Failed to generate title:", error);
    return messages[0].content.substring(0, 30) + "...";
  }
}

export async function generateFollowUpSuggestions(messages: Message[]): Promise<string[]> {
  try {
    const context = messages.slice(-3).map(m => `${m.role === 'user' ? 'Пользоватерль' : 'ИИ'}: ${m.content}`).join('\n');
    
    const prompt = `На основе контекста диалога ниже, предложи 3 коротких (до 5-6 слов) вопроса или фразы, которые пользователь мог бы задать следующими.
    Вопросы должны быть на русском языке.
    Верни ответ СТРОГО в формате JSON: ["вопрос 1", "вопрос 2", "вопрос 3"]
    
    Контекст:
    ${context}`;
    
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    const text = response.text || "";
    const match = text.match(/\[.*\]/s);
    if (match) {
      return JSON.parse(match[0]);
    }
    return [];
  } catch (error) {
    console.error("Failed to generate suggestions:", error);
    return [];
  }
}

export async function* sendMessageStream(
  prompt: string, 
  history: Message[] = [], 
  files: FileAttachment[] = [],
  options: ChatOptions = {}
) {
  if (!apiKey) throw new Error("API Key missing");

  const contents = history.map(msg => ({
    role: msg.role as "user" | "model",
    parts: [
      { text: msg.content },
      ...(msg.files?.map(f => ({
        inlineData: {
          mimeType: f.mimeType,
          data: f.data
        }
      })) || [])
    ]
  }));

  // Add current message parts
  const currentParts: any[] = [{ text: prompt }];
  files.forEach(f => {
    currentParts.push({
      inlineData: {
        mimeType: f.mimeType,
        data: f.data
      }
    });
  });

  contents.push({
    role: "user",
    parts: currentParts
  });

  // Always use the Flash model as requested by the user to avoid limits/latency
  const modelName = DEFAULT_MODEL;

  const responseStream = await ai.models.generateContentStream({
    model: modelName,
    contents: contents,
    config: {
      systemInstruction: options.systemInstruction
    }
  });

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield { type: "text", content: chunk.text };
    }
  }
}

export async function getSuggestions(history: Message[]): Promise<string[]> {
  const context = history.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 500)}`).join('\n');
  const prompt = `Based on this chat history, generate 3 very short (max 5 words each) follow-up questions or suggestions for the user. Return ONLY a JSON array of strings. Do not include markdown formatting like \`\`\`json.
  History:
  ${context}`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
    const text = response.text || "";
    const suggestions = JSON.parse(text);
    return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
  } catch (e) {
    console.error("Failed to get suggestions", e);
    return [];
  }
}
