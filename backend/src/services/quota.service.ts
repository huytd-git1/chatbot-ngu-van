import crypto from 'crypto';
import { query } from '../db/pool.js';
import { UserRow } from './auth.service.js';

export interface DailyQuotaInfo {
  dateVn: string;
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  extraGranted: number;
  isUnlimited: boolean; // teacher_test role
  systemCapReached: boolean;
  isKillSwitchActive: boolean;
}

export class QuotaService {
  /**
   * Returns current date string (YYYY-MM-DD) in Asia/Ho_Chi_Minh timezone
   */
  static getVietnamDateString(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // Formats as YYYY-MM-DD
  }

  /**
   * Hashes prompt text for idempotency verification
   */
  static hashPrompt(prompt: string): string {
    return crypto.createHash('sha256').update(prompt.trim().toLowerCase()).digest('hex');
  }

  /**
   * Resolves the effective daily quota limit for a user
   * Priority: Student Specific > Class Specific > System Default (20)
   */
  static async getEffectiveLimit(userId: string): Promise<number> {
    // 1. Check student-specific quota
    const studentQuota = await query(
      `SELECT daily_limit FROM quota_settings WHERE scope_type = 'student' AND scope_id = $1`,
      [userId]
    );
    if (studentQuota.rows.length > 0) {
      return studentQuota.rows[0].daily_limit;
    }

    // 2. Check class-specific quota if user is a student
    const studentClass = await query(
      `SELECT class_id FROM students WHERE user_id = $1`,
      [userId]
    );
    if (studentClass.rows.length > 0 && studentClass.rows[0].class_id) {
      const classId = studentClass.rows[0].class_id;
      const classQuota = await query(
        `SELECT daily_limit FROM quota_settings WHERE scope_type = 'class' AND scope_id = $1`,
        [classId]
      );
      if (classQuota.rows.length > 0) {
        return classQuota.rows[0].daily_limit;
      }
    }

    // 3. System default
    const sysQuota = await query(
      `SELECT daily_limit FROM quota_settings WHERE scope_type = 'system' AND scope_id = 'default'`
    );
    return sysQuota.rows.length > 0 ? sysQuota.rows[0].daily_limit : 20;
  }

  /**
   * Fetches total extra grants for a student for the given VN date
   */
  static async getExtraGrants(userId: string, dateVn: string): Promise<number> {
    const studentRes = await query(
      `SELECT s.id FROM students s WHERE s.user_id = $1`,
      [userId]
    );
    if (studentRes.rows.length === 0) return 0;
    const studentId = studentRes.rows[0].id;

    const grants = await query(
      `SELECT COALESCE(SUM(extra_count), 0) as total FROM quota_extra_grants
       WHERE student_id = $1 AND date_vn = $2`,
      [studentId, dateVn]
    );
    return parseInt(grants.rows[0].total, 10) || 0;
  }

  /**
   * Checks system-wide kill switch and hard cap
   */
  static async checkSystemStatus(dateVn: string): Promise<{ isKillSwitchActive: boolean; systemCapReached: boolean }> {
    const sysSettings = await query(
      `SELECT system_hard_cap, is_kill_switch_active FROM quota_settings
       WHERE scope_type = 'system' AND scope_id = 'default'`
    );
    const hardCap = sysSettings.rows[0]?.system_hard_cap ?? 5000;
    const killSwitch = !!sysSettings.rows[0]?.is_kill_switch_active;

    const sysUsage = await query(
      `SELECT COALESCE(SUM(success_count + reserved_count), 0) as total_calls
       FROM daily_usage WHERE date_vn = $1`,
      [dateVn]
    );
    const totalToday = parseInt(sysUsage.rows[0]?.total_calls ?? '0', 10);
    const systemCapReached = totalToday >= hardCap;

    return { isKillSwitchActive: killSwitch, systemCapReached };
  }

  /**
   * Gets quota overview for a user
   */
  static async getUserQuotaInfo(user: UserRow): Promise<DailyQuotaInfo> {
    const dateVn = this.getVietnamDateString();
    const { isKillSwitchActive, systemCapReached } = await this.checkSystemStatus(dateVn);

    // If admin or teacher_test, unlimited individual quota
    const isUnlimited = user.role === 'admin' || !!user.is_test_teacher;

    const baseLimit = await this.getEffectiveLimit(user.id);
    const extra = await this.getExtraGrants(user.id, dateVn);
    const totalLimit = isUnlimited ? 999999 : baseLimit + extra;

    const usageRes = await query(
      `SELECT success_count, reserved_count FROM daily_usage
       WHERE user_id = $1 AND date_vn = $2`,
      [user.id, dateVn]
    );
    const successCount = usageRes.rows[0]?.success_count ?? 0;
    const reservedCount = usageRes.rows[0]?.reserved_count ?? 0;
    const remaining = isUnlimited ? 999999 : Math.max(0, totalLimit - (successCount + reservedCount));

    return {
      dateVn,
      limit: totalLimit,
      used: successCount,
      reserved: reservedCount,
      remaining,
      extraGranted: extra,
      isUnlimited,
      systemCapReached: isUnlimited ? false : systemCapReached,
      isKillSwitchActive: isUnlimited ? false : isKillSwitchActive,
    };
  }

  /**
   * Atomically reserves 1 query quota BEFORE calling Gemini
   * Rejects if idempotency collision, quota exceeded, system cap reached, or kill switch enabled.
   */
  static async reserveQuota(
    user: UserRow,
    workId: string,
    prompt: string,
    learningMode: string,
    idempotencyKey: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    existingResponse?: string;
    citationsMeta?: any;
    promptHash: string;
  }> {
    const dateVn = this.getVietnamDateString();
    const promptHash = this.hashPrompt(prompt);

    // 1. Check idempotency key first
    const existingReq = await query(
      `SELECT * FROM chat_requests WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    if (existingReq.rows.length > 0) {
      const prev = existingReq.rows[0];
      // If same key but different prompt hash -> reject as tampering
      if (prev.prompt_hash !== promptHash || prev.user_id !== user.id) {
        return { allowed: false, reason: 'Idempotency key collision với nội dung khác.', promptHash };
      }
      // If same key and already completed -> return cached response without extra charge
      if (prev.status === 'success' || prev.status === 'no_source') {
        let meta = null;
        try {
          meta = prev.citations_meta ? JSON.parse(prev.citations_meta) : null;
        } catch {}
        return {
          allowed: false, // Don't re-execute
          reason: 'Duplicate retry',
          existingResponse: prev.response_text,
          citationsMeta: meta,
          promptHash,
        };
      }
      if (prev.status === 'reserved') {
        return { allowed: false, reason: 'Yêu cầu này đang được xử lý.', promptHash };
      }
    }

    // 2. Check system-wide kill switch and hard cap (admins are exempt for testing & diagnostics)
    const isAdmin = user.role === 'admin';
    const isExempt = isAdmin || !!user.is_test_teacher;

    const { isKillSwitchActive, systemCapReached } = await this.checkSystemStatus(dateVn);
    if (!isAdmin && isKillSwitchActive) {
      return { allowed: false, reason: 'Hệ thống AI hiện đang tạm bảo trì theo chỉ định quản trị viên.', promptHash };
    }
    if (!isAdmin && systemCapReached) {
      return { allowed: false, reason: 'Hệ thống đã đạt trần phục vụ trong ngày. Vui lòng thử lại vào ngày mai!', promptHash };
    }

    // 3. Check user quota (if exempt, e.g. admin or test teacher, skip daily limit check)
    if (!isExempt) {
      const baseLimit = await this.getEffectiveLimit(user.id);
      const extra = await this.getExtraGrants(user.id, dateVn);
      const totalLimit = baseLimit + extra;

      // Ensure usage row exists
      await query(
        `INSERT INTO daily_usage (user_id, date_vn, reserved_count, success_count, no_source_count, failed_count)
         VALUES ($1, $2, 0, 0, 0, 0)
         ON CONFLICT (user_id, date_vn) DO NOTHING`,
        [user.id, dateVn]
      );

      // Atomic conditional update to reserve a slot
      const updateRes = await query(
        `UPDATE daily_usage
         SET reserved_count = reserved_count + 1, updated_at = NOW()
         WHERE user_id = $1 AND date_vn = $2 AND (success_count + reserved_count) < $3
         RETURNING reserved_count`,
        [user.id, dateVn, totalLimit]
      );

      if (updateRes.rowCount === 0) {
        return {
          allowed: false,
          reason: `Em đã dùng hết hạn mức câu hỏi hôm nay (${totalLimit}/${totalLimit} lượt). Hãy ôn tập lại bài hoặc xin giáo viên cấp thêm lượt nhé!`,
          promptHash,
        };
      }
    } else {
      // Admin and test teacher still update usage row for audit
      await query(
        `INSERT INTO daily_usage (user_id, date_vn, reserved_count, success_count, no_source_count, failed_count)
         VALUES ($1, $2, 1, 0, 0, 0)
         ON CONFLICT (user_id, date_vn)
         DO UPDATE SET reserved_count = daily_usage.reserved_count + 1, updated_at = NOW()`,
        [user.id, dateVn]
      );
    }

    // 4. Create chat_requests entry with status 'reserved'
    await query(
      `INSERT INTO chat_requests (idempotency_key, user_id, work_id, prompt_hash, learning_mode, status)
       VALUES ($1, $2, $3, $4, $5, 'reserved')`,
      [idempotencyKey, user.id, workId, promptHash, learningMode]
    );

    return { allowed: true, promptHash };
  }

  /**
   * Finalizes request as SUCCESS: decrement reserved, increment success_count
   */
  static async recordSuccess(
    userId: string,
    idempotencyKey: string,
    responseText: string,
    citationsMeta: any,
    tokenCount: number,
    verificationMeta?: any,
    apiKeyMasked?: string
  ): Promise<void> {
    const dateVn = this.getVietnamDateString();

    await query(
      `UPDATE daily_usage
       SET reserved_count = GREATEST(0, reserved_count - 1),
           success_count = success_count + 1,
           output_tokens = output_tokens + $1,
           updated_at = NOW()
       WHERE user_id = $2 AND date_vn = $3`,
      [tokenCount, userId, dateVn]
    );

    await query(
      `UPDATE chat_requests
       SET status = 'success',
           grounding_status = 'has_citations',
           citations_meta = $1,
           response_text = $2,
           token_count = $3,
           verification_meta = $5,
           api_key_masked = COALESCE($6, api_key_masked)
       WHERE idempotency_key = $4`,
      [
        JSON.stringify(citationsMeta),
        responseText,
        tokenCount,
        idempotencyKey,
        verificationMeta ? JSON.stringify(verificationMeta) : null,
        apiKeyMasked || null,
      ]
    );
  }

  /**
   * Finalizes request as NO_SOURCE: does NOT charge student daily quota, but records for monitoring
   */
  static async recordNoSource(
    userId: string,
    idempotencyKey: string,
    refusalResponse: string
  ): Promise<void> {
    const dateVn = this.getVietnamDateString();

    // Do NOT increment success_count; return reserved slot, increment no_source_count
    await query(
      `UPDATE daily_usage
       SET reserved_count = GREATEST(0, reserved_count - 1),
           no_source_count = no_source_count + 1,
           updated_at = NOW()
       WHERE user_id = $1 AND date_vn = $2`,
      [userId, dateVn]
    );

    await query(
      `UPDATE chat_requests
       SET status = 'no_source',
           grounding_status = 'no_citations_refusal',
           response_text = $1
       WHERE idempotency_key = $2`,
      [refusalResponse, idempotencyKey]
    );
  }

  /**
   * Finalizes request as TECHNICAL FAILURE: refunds quota completely
   */
  static async recordFailure(
    userId: string,
    idempotencyKey: string,
    errorMessage: string
  ): Promise<void> {
    const dateVn = this.getVietnamDateString();

    // Refund reserved count, increment failed_count
    await query(
      `UPDATE daily_usage
       SET reserved_count = GREATEST(0, reserved_count - 1),
           failed_count = failed_count + 1,
           updated_at = NOW()
       WHERE user_id = $1 AND date_vn = $2`,
      [userId, dateVn]
    );

    await query(
      `UPDATE chat_requests
       SET status = 'failed',
           response_text = $1
       WHERE idempotency_key = $2`,
      [errorMessage, idempotencyKey]
    );
  }
}
