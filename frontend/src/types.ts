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
  document_role: 'primary' | 'reference' | 'unclassified';
  reference_type: 'analysis' | 'context' | 'lesson_plan' | 'other' | 'qa_guide' | null;
  is_active: boolean;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_name?: string | null;
  ocr_status: 'none' | 'pending' | 'completed' | 'review_needed';
  file_name: string;
  file_search_store_name: string;
  file_size_bytes: number;
  mime_type: string;
  status: 'pending' | 'indexing' | 'ready' | 'failed' | 'archived';
  version: number;
  created_at: string;
  creator_name?: string;
}

export interface PrimaryCitation {
  documentTitle: string;
  version: number;
  quote: string;
  pageNumber?: number | null;
  paragraphOrder?: number;
  verified: boolean;
  contextSnippet?: string;
}

export interface ReferenceCitation {
  documentTitle: string;
  referenceType?: string | null;
  role: string;
}

export interface ParagraphItem {
  id: string;
  document_id: string;
  work_id: string;
  version: number;
  paragraph_order: number;
  page_number: number | null;
  content: string;
  normalized_content: string;
  created_at: string;
}

export interface DocumentDiffItem {
  referenceDocTitle: string;
  quoteCandidate: string;
  foundInPrimary: boolean;
  matchedParagraphOrder?: number;
  notes: string;
}

export interface DocumentDiffReport {
  workId: string;
  hasActivePrimary: boolean;
  primaryDoc?: {
    id: string;
    title: string;
    version: number;
    paragraphCount: number;
  };
  referenceDocsCount: number;
  discrepanciesCount: number;
  items: DocumentDiffItem[];
  generatedAt: string;
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
  primaryCitations?: PrimaryCitation[];
  referenceCitations?: ReferenceCitation[];
  suggestions?: string[];
  isNoSource?: boolean;
  toolActuallyUsed?: boolean;
  modelUsed?: string;
  isLiveAi?: boolean;
  isCached?: boolean;
  timestamp: string;
}

export type LearningMode = 'qa' | 'character_analysis' | 'outline' | 'reading_comprehension' | 'essay_feedback' | 'prep_and_review';

export interface TokenStatsSummary {
  totalTokens: number;
  totalPromptTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  totalSuccessRequests: number;
  totalErrorRequests: number;
  avgTokensPerRequest: number;
  activeKeysCount: number;
  historicalKeysCount?: number;
}

export interface KeyPoolItem {
  index: number;
  maskedKey: string;
  isCooldown: boolean;
  cooldownSecondsLeft: number;
  totalTokens: number;
  promptTokens: number;
  outputTokens: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  lastUsedAt: string | null;
  percentShare: number;
}

export interface ThirdPartyPreset {
  id: string;
  name: string;
  baseUrl: string;
  suggestedModels: Array<{ id: string; name: string }>;
  description: string;
}


