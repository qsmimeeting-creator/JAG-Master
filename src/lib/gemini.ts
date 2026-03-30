import { GoogleGenAI, Type } from '@google/genai';
import { Question } from '../types';
import { getQuestionsFromBank, getUserAnsweredQuestionIds, saveQuestionsToBank } from './db';

const FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'fallback_1',
    questionText: 'ระบบขัดข้องชั่วคราว ข้อใดคือหลักการพื้นฐานของกฎหมาย?',
    choices: ['ความยุติธรรม', 'ความรวดเร็ว', 'ความประหยัด', 'ความสะดวก'],
    correctAnswerIndex: 0,
    explanation: 'หลักการพื้นฐานของกฎหมายคือการผดุงความยุติธรรมในสังคม',
    category: 'general'
  }
];

function getRandomApiKey(): string {
  const keysEnv = import.meta.env.VITE_GEMINI_API_KEYS;
  if (keysEnv) {
    const keys = keysEnv.split(',').map((k: string) => k.trim()).filter(Boolean);
    if (keys.length > 0) {
      return keys[Math.floor(Math.random() * keys.length)];
    }
  }
  // Fallback to single key if multiple keys are not provided
  return import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

export async function generateQuestions(category: string, respondentName: string): Promise<{ questions: Question[], source: string }> {
  const TARGET_COUNT = 10;
  
  // 1. Fetch answered IDs to prevent duplicates
  const answeredIds = await getUserAnsweredQuestionIds(respondentName, category);
  
  // 2. Try to get from Bank first
  let finalQuestions = await getQuestionsFromBank(category, answeredIds, TARGET_COUNT);
  
  if (finalQuestions.length >= TARGET_COUNT) {
    return { questions: finalQuestions, source: 'bank' };
  }

  // 3. Generate missing questions via Gemini
  const needed = TARGET_COUNT - finalQuestions.length;
  if (needed <= 0) return { questions: finalQuestions, source: 'bank' };

  let categoryContext = '';
  switch (category) {
    case 'general': categoryContext = 'ความรู้ความสามารถทั่วไป (คณิตศาสตร์, ภาษาไทย, ภาษาอังกฤษ, ความรู้ทั่วไป)'; break;
    case 'criminal': categoryContext = 'กฎหมายอาญา และ กฎหมายวิธีพิจารณาความอาญา'; break;
    case 'civil': categoryContext = 'กฎหมายแพ่งและพาณิชย์ และ กฎหมายวิธีพิจารณาความแพ่ง'; break;
    case 'public': categoryContext = 'กฎหมายมหาชน (กฎหมายรัฐธรรมนูญ, กฎหมายปกครอง)'; break;
    case 'military': categoryContext = 'กฎหมายทหาร (พ.ร.บ.ธรรมนูญศาลทหาร, กฎหมายว่าด้วยวินัยทหาร)'; break;
    default: categoryContext = 'กฎหมายทั่วไป';
  }

  // Split into chunks if needed > 5 to speed up generation
  const chunkSize = needed > 5 ? Math.ceil(needed / 2) : needed;
  const numChunks = Math.ceil(needed / chunkSize);
  const chunkPromises = [];

  for (let i = 0; i < numChunks; i++) {
    const count = (i === numChunks - 1) ? needed - (i * chunkSize) : chunkSize;
    if (count <= 0) continue;

    const chunkPrompt = `
Role: ผู้เชี่ยวชาญด้านกฎหมายและติวเตอร์เตรียมสอบนายทหารพระธรรมนูญ (ทหารชั้นสัญญาบัตร สายงานนิติศาสตร์)
Task: สร้างข้อสอบปรนัย (Multiple Choice) จำนวน ${count} ข้อที่ไม่ซ้ำกัน
Topic: ${categoryContext}
Level: ระดับปานกลางถึงยาก (เน้นการปรับใช้หลักกฎหมายและวิเคราะห์)
Focus: ${i === 0 ? 'เน้นหลักการพื้นฐานและมาตราสำคัญ' : 'เน้นกรณีศึกษาและการตีความ'}

STRICT RULES:
1. ACCURACY: คำถามและคำตอบต้องถูกต้องตามหลักกฎหมายไทยปัจจุบัน หรือความรู้ทั่วไปที่ถูกต้อง
2. Language: ภาษาไทย ใช้ภาษาราชการ/ภาษากฎหมายที่ถูกต้อง
3. Format: JSON Array เท่านั้น
4. Uniqueness: คำถามต้องไม่ซ้ำกัน
5. Explanation: อธิบายเหตุผลทางกฎหมายหรือหลักการที่ถูกต้องอย่างชัดเจน พร้อมอ้างอิงมาตราถ้ามี (สามารถใช้ Markdown เช่น **ตัวหนา** หรือการขึ้นบรรทัดใหม่ได้)
`;

    chunkPromises.push((async () => {
      let retries = 2;
      while (retries > 0) {
        try {
          const apiKey = getRandomApiKey();
          if (!apiKey) throw new Error('No API Key found');
          
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: chunkPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionText: { type: Type.STRING, description: 'คำถาม' },
                    choices: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'ตัวเลือก 4 ข้อ (ก, ข, ค, ง)'
                    },
                    correctAnswerIndex: { type: Type.INTEGER, description: 'index ของคำตอบที่ถูกต้อง (0-3)' },
                    explanation: { type: Type.STRING, description: 'คำอธิบายเฉลย (ใช้ Markdown ได้)' },
                  },
                  required: ['questionText', 'choices', 'correctAnswerIndex', 'explanation'],
                },
              },
              temperature: 0.8,
            },
          });

          const text = response.text;
          if (!text) throw new Error('No response from Gemini');
          
          return JSON.parse(text).map((q: any, index: number) => ({
            ...q,
            id: `ai_${Date.now()}_${i}_${index}`,
            category,
            createdAt: Date.now()
          }));
        } catch (error) {
          console.error(`Error in chunk ${i} (retries left: ${retries - 1}):`, error);
          retries--;
          if (retries === 0) return [];
        }
      }
      return [];
    })());
  }

  const results = await Promise.all(chunkPromises);
  let aiQuestions: Question[] = results.flat();

  if (aiQuestions.length === 0 && finalQuestions.length === 0) {
    return { questions: FALLBACK_QUESTIONS, source: 'fallback' };
  }

  if (aiQuestions.length > 0) {
    // Save new questions to bank
    await saveQuestionsToBank(aiQuestions, category);
    finalQuestions = [...finalQuestions, ...aiQuestions];
  }

  return { questions: finalQuestions, source: 'ai_mixed' };
}
