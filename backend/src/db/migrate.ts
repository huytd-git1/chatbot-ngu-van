import { query } from './pool.js';

export async function runMigrations() {
  console.log('[Migration] Starting database migration...');

  const migrations = [
    `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
      is_test_teacher BOOLEAN DEFAULT FALSE,
      password_hash TEXT NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      must_change_password BOOLEAN DEFAULT FALSE,
      totp_secret TEXT,
      totp_enabled BOOLEAN DEFAULT FALSE,
      totp_recovery_codes TEXT,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `,
    `
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(128) PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      revoked BOOLEAN DEFAULT FALSE,
      user_agent TEXT,
      ip_address VARCHAR(45)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `,
    `
    CREATE TABLE IF NOT EXISTS classes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      grade INTEGER NOT NULL,
      academic_year VARCHAR(20) NOT NULL,
      is_archived BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_classes_grade ON classes(grade);
    `,
    `
    CREATE TABLE IF NOT EXISTS teacher_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_teacher_class UNIQUE (teacher_id, class_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ta_teacher ON teacher_assignments(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_ta_class ON teacher_assignments(class_id);
    `,
    `
    CREATE TABLE IF NOT EXISTS students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      student_code VARCHAR(50) NOT NULL UNIQUE,
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);
    `,
    `
    CREATE TABLE IF NOT EXISTS works (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      author VARCHAR(100) NOT NULL,
      grade INTEGER NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_works_grade ON works(grade);
    `,
    `
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('text_primary', 'analysis', 'lesson_plan', 'qa_guide')),
      file_name VARCHAR(255) NOT NULL,
      file_search_store_name VARCHAR(255) NOT NULL,
      gemini_file_name VARCHAR(255),
      file_size_bytes BIGINT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'ready', 'failed', 'archived')),
      version INTEGER DEFAULT 1,
      raw_content TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_documents_work ON documents(work_id);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    `,
    `
    CREATE TABLE IF NOT EXISTS indexing_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      operation_name VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      error_message TEXT,
      attempt_count INTEGER DEFAULT 0,
      last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_indexing_jobs_doc ON indexing_jobs(document_id);
    CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indexing_jobs(status);
    `,
    `
    CREATE TABLE IF NOT EXISTS class_work_access (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_class_work UNIQUE (class_id, work_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cwa_class ON class_work_access(class_id);
    CREATE INDEX IF NOT EXISTS idx_cwa_work ON class_work_access(work_id);
    `,
    `
    CREATE TABLE IF NOT EXISTS learning_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      prep_questions TEXT,
      review_questions TEXT,
      learning_goals TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_learning_class_work UNIQUE (class_id, work_id)
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS quota_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('system', 'class', 'student')),
      scope_id VARCHAR(50) NOT NULL,
      daily_limit INTEGER NOT NULL DEFAULT 20,
      system_hard_cap INTEGER DEFAULT 5000,
      is_kill_switch_active BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_quota_scope UNIQUE (scope_type, scope_id)
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS quota_extra_grants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      date_vn VARCHAR(10) NOT NULL,
      extra_count INTEGER NOT NULL DEFAULT 5,
      granted_by UUID NOT NULL REFERENCES users(id),
      reason TEXT,
      granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_qeg_student_date ON quota_extra_grants(student_id, date_vn);
    `,
    `
    CREATE TABLE IF NOT EXISTS daily_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_vn VARCHAR(10) NOT NULL,
      reserved_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      no_source_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      prompt_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_user_daily UNIQUE (user_id, date_vn)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date_vn);
    `,
    `
    CREATE TABLE IF NOT EXISTS chat_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      idempotency_key VARCHAR(128) NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      prompt_hash VARCHAR(64) NOT NULL,
      learning_mode VARCHAR(50) NOT NULL,
      status VARCHAR(30) NOT NULL CHECK (status IN ('reserved', 'success', 'no_source', 'failed', 'refunded')),
      grounding_status VARCHAR(50),
      citations_meta TEXT,
      response_text TEXT,
      token_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
    );
    CREATE INDEX IF NOT EXISTS idx_cr_idempotency ON chat_requests(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_cr_user_created ON chat_requests(user_id, created_at);
    `,
    `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(100),
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_user_action ON audit_logs(user_id, action);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    `,
    `
    CREATE TABLE IF NOT EXISTS ai_settings (
      id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
      api_key TEXT,
      model_name VARCHAR(100) DEFAULT 'gemini-3.8-flash',
      embedding_model VARCHAR(100) DEFAULT 'models/gemini-embedding-2',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    `,
    `
    DROP TABLE IF EXISTS document_passages, verified_answer_cache CASCADE;
    `,
    `
    ALTER TABLE chat_requests ADD COLUMN IF NOT EXISTS verification_meta TEXT;
    `,
    `
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_role VARCHAR(30) DEFAULT 'unclassified' CHECK (document_role IN ('primary', 'reference', 'unclassified'));
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50) CHECK (reference_type IS NULL OR reference_type IN ('analysis', 'context', 'lesson_plan', 'other', 'qa_guide'));
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(30) DEFAULT 'none' CHECK (ocr_status IN ('none', 'pending', 'completed', 'review_needed'));
    `,
    `
    UPDATE documents
    SET document_role = CASE
          WHEN doc_type = 'text_primary' THEN 'primary'
          ELSE 'reference'
        END,
        reference_type = CASE
          WHEN doc_type IN ('analysis', 'lesson_plan', 'qa_guide') THEN doc_type
          WHEN doc_type = 'text_primary' THEN NULL
          ELSE 'other'
        END,
        is_active = (doc_type = 'text_primary'),
        reviewed_at = COALESCE(reviewed_at, created_at)
    WHERE document_role IS NULL OR document_role = 'unclassified';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_primary_per_work
    ON documents(work_id)
    WHERE document_role = 'primary' AND is_active = true;
    `,
    `
    CREATE TABLE IF NOT EXISTS work_paragraphs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      paragraph_order INTEGER NOT NULL,
      page_number INTEGER,
      content TEXT NOT NULL,
      normalized_content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_paragraphs_doc ON work_paragraphs(document_id);
    CREATE INDEX IF NOT EXISTS idx_paragraphs_work_ver ON work_paragraphs(work_id, version);
    `,
    `
    CREATE TABLE IF NOT EXISTS api_key_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key_hash VARCHAR(64) NOT NULL UNIQUE,
      masked_key VARCHAR(60) NOT NULL,
      total_tokens BIGINT DEFAULT 0,
      prompt_tokens BIGINT DEFAULT 0,
      output_tokens BIGINT DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_api_key_usage_hash ON api_key_usage(key_hash);
    ALTER TABLE chat_requests ADD COLUMN IF NOT EXISTS api_key_masked VARCHAR(60);
    `,
    `
    ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) DEFAULT 'google_official';
    ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS custom_base_url VARCHAR(255) DEFAULT 'https://api.routeapi.ai/v1';
    ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS custom_api_key TEXT;
    ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS custom_model_name VARCHAR(100) DEFAULT 'google/gemini-2.5-flash';
    ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS key_models TEXT DEFAULT '{}';
    `,
    `
    -- Enable pg_trgm extension if available for keyword similarity search
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `,
    `
    -- Table for rich document chunks (primary & reference)
    CREATE TABLE IF NOT EXISTS document_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      chunk_order INTEGER NOT NULL,
      chunk_role VARCHAR(30) NOT NULL CHECK (chunk_role IN ('primary', 'reference')),
      section_title VARCHAR(255),
      page_number INTEGER,
      start_offset INTEGER NOT NULL DEFAULT 0,
      end_offset INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL,
      normalized_content TEXT NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 0,
      token_method VARCHAR(30) DEFAULT 'estimated_chars',
      metadata JSONB DEFAULT '{}'::jsonb,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_work_role ON document_chunks(work_id, chunk_role);
    CREATE INDEX IF NOT EXISTS idx_chunks_hash ON document_chunks(content_hash);
    `,
    `
    -- Table for document metadata ("Tạo lại metadata")
    CREATE TABLE IF NOT EXISTS document_metadata (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'active', 'rejected', 'outdated')),
      generation_method VARCHAR(50) DEFAULT 'ai_batch',
      model_name VARCHAR(100),
      summary TEXT,
      themes JSONB DEFAULT '[]'::jsonb,
      characters JSONB DEFAULT '[]'::jsonb,
      literary_details JSONB DEFAULT '[]'::jsonb,
      analysis_points JSONB DEFAULT '[]'::jsonb,
      qa_pairs JSONB DEFAULT '[]'::jsonb,
      keywords JSONB DEFAULT '[]'::jsonb,
      chunk_links JSONB DEFAULT '[]'::jsonb,
      token_usage JSONB DEFAULT '{}'::jsonb,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_doc_metadata_doc_status ON document_metadata(document_id, status);
    `,
    `
    -- Table for background metadata generation jobs
    CREATE TABLE IF NOT EXISTS metadata_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
      progress_pct INTEGER DEFAULT 0,
      error_message TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      metadata_id UUID REFERENCES document_metadata(id) ON DELETE SET NULL,
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_meta_jobs_doc_status ON metadata_jobs(document_id, status);
    `,
    `
    -- Table for persistent RAG query traces
    CREATE TABLE IF NOT EXISTS rag_traces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trace_source VARCHAR(30) NOT NULL DEFAULT 'student' CHECK (trace_source IN ('student', 'admin_lab', 'eval_batch')),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      work_id UUID REFERENCES works(id) ON DELETE SET NULL,
      chat_request_id UUID REFERENCES chat_requests(id) ON DELETE SET NULL,
      query_text TEXT NOT NULL,
      learning_mode VARCHAR(50) NOT NULL,
      processing_method VARCHAR(50) NOT NULL,
      model_name VARCHAR(100),
      prompt_tokens_reported INTEGER DEFAULT 0,
      output_tokens_reported INTEGER DEFAULT 0,
      prompt_tokens_estimated JSONB DEFAULT '{}'::jsonb,
      retrieved_chunks JSONB DEFAULT '[]'::jsonb,
      context_sent JSONB DEFAULT '{}'::jsonb,
      raw_output TEXT,
      final_output TEXT,
      quote_verification_result JSONB DEFAULT '{}'::jsonb,
      citations JSONB DEFAULT '[]'::jsonb,
      latency_ms INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      fallback_occurred BOOLEAN DEFAULT FALSE,
      lack_of_source BOOLEAN DEFAULT FALSE,
      error_message TEXT,
      is_mock BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rag_traces_work ON rag_traces(work_id);
    CREATE INDEX IF NOT EXISTS idx_rag_traces_created ON rag_traces(created_at);
    CREATE INDEX IF NOT EXISTS idx_rag_traces_source ON rag_traces(trace_source);
    `,
    `
    -- Table for human evaluator reviews
    CREATE TABLE IF NOT EXISTS rag_manual_evaluations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trace_id UUID NOT NULL REFERENCES rag_traces(id) ON DELETE CASCADE,
      evaluator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      retrieval_rating VARCHAR(30) CHECK (retrieval_rating IN ('correct', 'partially_correct', 'wrong', 'not_applicable')),
      evidence_missing BOOLEAN DEFAULT FALSE,
      quote_accuracy VARCHAR(30) CHECK (quote_accuracy IN ('exact', 'distorted', 'fabricated', 'none')),
      analysis_grounded VARCHAR(30) CHECK (analysis_grounded IN ('fully_supported', 'partially_supported', 'unsupported', 'hallucinated')),
      mode_fit BOOLEAN DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_eval_trace ON rag_manual_evaluations(trace_id);
    `,
    `
    -- Benchmark test sets and evaluation runs
    CREATE TABLE IF NOT EXISTS rag_eval_testsets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      description TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rag_eval_test_cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      testset_id UUID NOT NULL REFERENCES rag_eval_testsets(id) ON DELETE CASCADE,
      work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      learning_mode VARCHAR(50) NOT NULL DEFAULT 'analysis',
      question TEXT NOT NULL,
      expected_ref_topics TEXT,
      expected_quotes TEXT,
      should_refuse BOOLEAN DEFAULT FALSE,
      document_version INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_eval_test_cases_set ON rag_eval_test_cases(testset_id);

    CREATE TABLE IF NOT EXISTS rag_eval_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      testset_id UUID NOT NULL REFERENCES rag_eval_testsets(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(30) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'stopped')),
      total_cases INTEGER DEFAULT 0,
      completed_cases INTEGER DEFAULT 0,
      passed_cases INTEGER DEFAULT 0,
      avg_tokens INTEGER DEFAULT 0,
      avg_latency_ms INTEGER DEFAULT 0,
      accuracy_rate NUMERIC(5,2) DEFAULT 0,
      results JSONB DEFAULT '[]'::jsonb,
      error_message TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE
    );
    CREATE INDEX IF NOT EXISTS idx_eval_runs_testset ON rag_eval_runs(testset_id);
    `
  ];

  for (let i = 0; i < migrations.length; i++) {
    try {
      await query(migrations[i]);
    } catch (err: any) {
      if (migrations[i].includes('CREATE EXTENSION')) {
        console.warn(`[Migration] Extension not supported in this environment, skipping: ${err.message}`);
        continue;
      }
      console.error(`[Migration] Error at step ${i + 1}:`, err);
      throw err;
    }
  }

  // Ensure default system quota exists
  await query(`
    INSERT INTO quota_settings (scope_type, scope_id, daily_limit, system_hard_cap, is_kill_switch_active)
    VALUES ('system', 'default', 20, 5000, FALSE)
    ON CONFLICT (scope_type, scope_id) DO NOTHING;
  `);

  // Ensure default AI settings row exists
  await query(`
    INSERT INTO ai_settings (id, model_name, embedding_model)
    VALUES ('default', 'gemini-3.8-flash', 'models/gemini-embedding-2')
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log('[Migration] All migrations completed successfully.');
}

if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
