import { GoogleGenAI, Type } from '@google/genai';
import { Question } from '../types';
import { getQuestionsFromBank, getUserAnsweredQuestionIds, saveQuestionsToBank } from './db';

const FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'fallback_1',
    questionText: 'ข้อใดคือหลักการพื้นฐานของกฎหมายอาญา?',
    choices: ['ไม่มีความผิด ไม่มีโทษ โดยไม่มีกฎหมาย', 'ความยุติธรรมต้องมาก่อนกฎหมาย', 'ผู้ใดกระทำความผิดต้องได้รับโทษสถานหนัก', 'กฎหมายอาญาไม่มีผลย้อนหลังในทางที่เป็นคุณ'],
    correctAnswerIndex: 0,
    explanation: 'หลักการ "Nullum crimen, nulla poena sine lege" หมายถึงจะไม่มีความผิดและไม่มีโทษหากไม่มีกฎหมายกำหนดไว้ในขณะกระทำความผิด',
    category: 'criminal'
  },
  {
    id: 'fallback_2',
    questionText: 'สัญญาจะซื้อจะขายอสังหาริมทรัพย์ หากไม่ได้ทำเป็นหนังสือและจดทะเบียนต่อพนักงานเจ้าหน้าที่ ผลจะเป็นอย่างไร?',
    choices: ['โมฆะ', 'โมฆียะ', 'สมบูรณ์แต่ฟ้องร้องบังคับคดีไม่ได้', 'ใช้บังคับได้ระหว่างคู่สัญญา'],
    correctAnswerIndex: 2,
    explanation: 'สัญญาจะซื้อจะขายอสังหาริมทรัพย์ กฎหมายบังคับว่าต้องมีหลักฐานเป็นหนังสืออย่างใดอย่างหนึ่งลงลายมือชื่อฝ่ายผู้ต้องรับผิด หรือได้วางประจำ หรือได้ชำระหนี้บางส่วนแล้ว จึงจะฟ้องร้องบังคับคดีได้',
    category: 'civil'
  },
  {
    id: 'fallback_3',
    questionText: 'ศาลทหารมีอำนาจพิจารณาพิพากษาคดีประเภทใด?',
    choices: ['คดีอาญาที่บุคคลที่อยู่ในอำนาจศาลทหารกระทำผิด', 'คดีแพ่งที่ทหารเป็นคู่ความ', 'คดีปกครองที่เกี่ยวกับวินัยทหาร', 'ทุกคดีที่ทหารเกี่ยวข้อง'],
    correctAnswerIndex: 0,
    explanation: 'ศาลทหารมีอำนาจพิจารณาพิพากษาคดีอาญาที่บุคคลที่อยู่ในอำนาจศาลทหารเป็นผู้กระทำความผิดตามกฎหมายอาญาหรือกฎหมายอื่นที่มีโทษทางอาญา',
    category: 'military'
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

async function callGeminiWithRetry(
  prompt: string, 
  config: any, 
  retries = 3, 
  delay = 2000
): Promise<string> {
  const models = ['gemini-3-flash-preview', 'gemini-1.5-flash'];
  let lastError: any;

  for (let attempt = 0; attempt < retries; attempt++) {
    for (const modelName of models) {
      try {
        const apiKey = getRandomApiKey();
        if (!apiKey) throw new Error('No API Key found');
        
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            ...config,
          },
        });

        const text = response.text;
        if (text) return text;
      } catch (error: any) {
        lastError = error;
        const is503 = error?.message?.includes('503') || error?.message?.includes('high demand') || error?.message?.includes('UNAVAILABLE');
        const is429 = error?.message?.includes('429') || error?.message?.includes('Too Many Requests');

        if (is503 || is429) {
          console.warn(`Gemini API ${modelName} attempt ${attempt + 1} failed: ${error.message}. Retrying...`);
          // Continue to next model or next retry
          continue;
        } else {
          // For other errors, throw immediately
          throw error;
        }
      }
    }
    // Wait before next retry attempt
    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
  }

  throw lastError || new Error('Failed to generate content after multiple retries');
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
    const text = await callGeminiWithRetry(prompt, {
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
    });
    
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
    const text = await callGeminiWithRetry(prompt, {
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
    }, 2, 3000); // Fewer retries for background task

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
