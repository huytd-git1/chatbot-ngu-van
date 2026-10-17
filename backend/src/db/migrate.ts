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
    `
  ];

  for (let i = 0; i < migrations.length; i++) {
    try {
      await query(migrations[i]);
    } catch (err) {
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
