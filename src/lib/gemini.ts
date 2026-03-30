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

  const prompt = `
Role: ผู้เชี่ยวชาญด้านกฎหมายและติวเตอร์เตรียมสอบนายทหารพระธรรมนูญ (ทหารชั้นสัญญาบัตร สายงานนิติศาสตร์)
Task: สร้างข้อสอบปรนัย (Multiple Choice) จำนวน ${needed} ข้อ
Topic: ${categoryContext}
Level: ระดับปานกลางถึงยาก (เน้นการปรับใช้หลักกฎหมายและวิเคราะห์)

STRICT RULES:
1. ACCURACY & UP-TO-DATE: คำถามและคำตอบต้องถูกต้องตามหลักกฎหมายไทยปัจจุบันที่มีการแก้ไขล่าสุด (อัปเดตถึงปีปัจจุบัน)
2. NO DUPLICATES: ห้ามสร้างโจทย์ที่ซ้ำกันหรือคล้ายคลึงกันมากในชุดเดียวกันโดยเด็ดขาด
3. Language: ภาษาไทย ใช้ภาษาราชการ/ภาษากฎหมายที่ถูกต้อง
4. Format: JSON Array เท่านั้น
5. Explanation: อธิบายเหตุผลทางกฎหมายหรือหลักการที่ถูกต้องอย่างชัดเจน พร้อมอ้างอิงมาตราถ้ามี
`;

  try {
    const apiKey = getRandomApiKey();
    if (!apiKey) throw new Error('No API Key found');
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
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
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');
    
    const aiQuestions = JSON.parse(text).map((q: any, index: number) => ({
      ...q,
      id: `ai_${Date.now()}_${index}`,
      category,
      createdAt: Date.now()
    }));

    if (aiQuestions.length > 0) {
      await saveQuestionsToBank(aiQuestions, category);
      finalQuestions = [...finalQuestions, ...aiQuestions];
    }

    return { questions: finalQuestions, source: 'ai_mixed' };
  } catch (error) {
    console.error(`Error generating questions:`, error);
    if (finalQuestions.length > 0) return { questions: finalQuestions, source: 'bank_partial' };
    return { questions: FALLBACK_QUESTIONS, source: 'fallback' };
  }
}

export async function preGenerateQuestions(category: string) {
  const TARGET_COUNT = 20;
  
  let categoryContext = '';
  switch (category) {
    case 'general': categoryContext = 'ความรู้ความสามารถทั่วไป (คณิตศาสตร์, ภาษาไทย, ภาษาอังกฤษ, ความรู้ทั่วไป)'; break;
    case 'criminal': categoryContext = 'กฎหมายอาญา และ กฎหมายวิธีพิจารณาความอาญา'; break;
    case 'civil': categoryContext = 'กฎหมายแพ่งและพาณิชย์ และ กฎหมายวิธีพิจารณาความแพ่ง'; break;
    case 'public': categoryContext = 'กฎหมายมหาชน (กฎหมายรัฐธรรมนูญ, กฎหมายปกครอง)'; break;
    case 'military': categoryContext = 'กฎหมายทหาร (พ.ร.บ.ธรรมนูญศาลทหาร, กฎหมายว่าด้วยวินัยทหาร)'; break;
    default: categoryContext = 'กฎหมายทั่วไป';
  }

  const prompt = `
Role: ผู้เชี่ยวชาญด้านกฎหมายและติวเตอร์เตรียมสอบนายทหารพระธรรมนูญ
Task: สร้างข้อสอบปรนัย (Multiple Choice) จำนวน ${TARGET_COUNT} ข้อเพื่อเก็บเข้าคลัง
Topic: ${categoryContext}
STRICT RULES:
1. ACCURACY & UP-TO-DATE: กฎหมายไทยปัจจุบัน
2. NO DUPLICATES: ห้ามซ้ำกันเด็ดขาด
3. Format: JSON Array เท่านั้น
`;

  try {
    const apiKey = getRandomApiKey();
    if (!apiKey) return;
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionText: { type: Type.STRING },
              choices: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
            },
            required: ['questionText', 'choices', 'correctAnswerIndex', 'explanation'],
          },
        },
        temperature: 0.9, // Higher temperature for variety in bank
      },
    });

    const text = response.text;
    if (text) {
      const aiQuestions = JSON.parse(text).map((q: any, index: number) => ({
        ...q,
        id: `pre_${Date.now()}_${index}`,
        category,
        createdAt: Date.now()
      }));
      await saveQuestionsToBank(aiQuestions, category);
    }
  } catch (error) {
    console.warn(`Background generation failed for ${category}:`, error);
  }
}
