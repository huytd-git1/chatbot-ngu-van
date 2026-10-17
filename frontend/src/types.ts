export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'teacher' | 'student';
  isTestTeacher: boolean;
  mustChangePassword: boolean;
  totpEnabled: boolean;
}

export interface QuotaInfo {
  dateVn: string;
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  extraGranted: number;
  isUnlimited: boolean;
  systemCapReached: boolean;
  isKillSwitchActive: boolean;
}

export interface Work {
  id: string;
  title: string;
  author: string;
  grade: number;
  description: string;
  status: 'active' | 'archived';
  ready_docs_count?: number;
  ready_docs?: number;
  assignedClassIds?: string[];
}

export interface DocumentItem {
  id: string;
  work_id: string;
  title: string;
  doc_type: 'text_primary' | 'analysis' | 'lesson_plan' | 'qa_guide';
  file_name: string;
  file_search_store_name: string;
  file_size_bytes: number;
  mime_type: string;
  status: 'pending' | 'indexing' | 'ready' | 'failed' | 'archived';
  version: number;
  created_at: string;
  creator_name?: string;
}

export interface ClassItem {
  id: string;
  name: string;
  grade: number;
  academic_year: string;
  is_archived: boolean;
  student_count?: number;
}

export interface StudentItem {
  id: string;
  student_code: string;
  notes: string | null;
  user_id: string;
  full_name: string;
  is_active: boolean;
  must_change_password: boolean;
  today_used: number;
  today_extra: number;
}

export interface FileCitation {
  fileName: string;
  sourceText?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  citations?: FileCitation[];
  suggestions?: string[];
  isNoSource?: boolean;
  toolActuallyUsed?: boolean;
  modelUsed?: string;
  isLiveAi?: boolean;
  isCached?: boolean;
  timestamp: string;
}

export type LearningMode = 'qa' | 'character_analysis' | 'outline' | 'reading_comprehension' | 'essay_feedback' | 'prep_and_review';

