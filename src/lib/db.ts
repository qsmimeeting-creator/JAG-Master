import { collection, addDoc, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Question, QuizSession } from '../types';

const BANK_COLLECTION = 'QuestionBank';
const RESULTS_COLLECTION = 'QuizResults';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function saveQuizResult(session: QuizSession) {
  if (!db) return;
  try {
    const docRef = await addDoc(collection(db, RESULTS_COLLECTION), {
      ...session,
      createdAt: Date.now(),
      // Store answered IDs to prevent repeating
      answeredIds: session.questions.map(q => q.id)
    });
    return docRef.id;
  } catch (error) {
    console.warn("Could not save quiz result:", error);
  }
}

export async function getUserAnsweredQuestionIds(respondentName: string, category: string): Promise<Set<string>> {
  if (!db || !respondentName) return new Set();
  try {
    const q = query(
      collection(db, RESULTS_COLLECTION),
      where('respondentName', '==', respondentName),
      where('category', '==', category)
    );
    const querySnapshot = await getDocs(q);
    const answeredIds = new Set<string>();
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.answeredIds && Array.isArray(data.answeredIds)) {
        data.answeredIds.forEach((id: string) => answeredIds.add(id));
      }
    });
    return answeredIds;
  } catch (error) {
    console.warn("Could not get user answered IDs:", error);
    return new Set();
  }
}

export async function getQuestionsFromBank(category: string, excludeIds: Set<string>, count: number): Promise<Question[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, BANK_COLLECTION),
      where('category', '==', category),
      orderBy('createdAt', 'desc'),
      limit(100) 
    );
    const querySnapshot = await getDocs(q);
    const questions: Question[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Question;
      if (!excludeIds.has(data.id)) {
        questions.push(data);
      }
    });

    return questions.sort(() => 0.5 - Math.random()).slice(0, count);
  } catch (error) {
    console.warn("Could not get questions from bank:", error);
    return [];
  }
}

export async function saveQuestionsToBank(questions: Question[], category: string) {
  if (!db || questions.length === 0) return;
  try {
    const promises = questions.map(q => {
      return addDoc(collection(db, BANK_COLLECTION), {
        ...q,
        category,
        createdAt: Date.now()
      });
    });
    await Promise.all(promises);
  } catch (error) {
    // Just log for bank saving, don't throw to avoid stopping the quiz
    console.warn("Could not save questions to bank (cache):", error);
  }
}
