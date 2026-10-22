import { Request, Response } from 'express';
import { MetadataService } from '../services/metadata.service.js';

export class MetadataController {
  /**
   * POST /api/documents/:id/regenerate-metadata
   * Kích hoạt tác vụ tạo lại metadata cho tệp tài liệu
   */
  static async triggerRegeneration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const result = await MetadataService.triggerMetadataRegeneration({
        documentId: id,
        userId,
      });

      res.status(200).json({
        message: result.isExisting
          ? 'Đang có tác vụ tạo metadata đang chạy cho tài liệu này'
          : 'Đã khởi tạo tác vụ phân tích và tạo metadata thành công',
        job: result.job,
        isExisting: result.isExisting,
      });
    } catch (err: any) {
      console.error('[MetadataController.triggerRegeneration] Error:', err);
      res.status(400).json({ error: err.message || 'Không thể tạo metadata' });
    }
  }

  /**
   * GET /api/documents/:id/metadata
   * Lấy thông tin metadata hiện tại, bản draft và tiến độ job
   */
  static async getDocumentMetadata(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const [activeMeta, latestMeta, activeJob] = await Promise.all([
        MetadataService.getActiveMetadata(id),
        MetadataService.getLatestMetadata(id),
        MetadataService.getActiveJob(id),
      ]);

      res.status(200).json({
        activeMetadata: activeMeta,
        latestMetadata: latestMeta,
        activeJob,
        hasMetadata: !!activeMeta || !!latestMeta,
        status: activeJob
          ? activeJob.status === 'processing'
            ? 'Đang xử lý'
            : 'Đang chờ'
          : latestMeta
          ? latestMeta.status === 'active'
            ? 'Đang sử dụng'
            : latestMeta.status === 'draft' || latestMeta.status === 'pending_approval'
            ? 'Chờ duyệt'
            : latestMeta.status === 'outdated'
            ? 'Đã lỗi thời'
            : 'Chưa có'
          : 'Chưa có',
      });
    } catch (err: any) {
      console.error('[MetadataController.getDocumentMetadata] Error:', err);
      res.status(500).json({ error: 'Lỗi tải metadata: ' + err.message });
    }
  }

  /**
   * POST /api/documents/:id/metadata/:metaId/approve
   * Duyệt và kích hoạt bản metadata
   */
  static async approveMetadata(req: Request, res: Response) {
    try {
      const { metaId } = req.params;
      const userId = (req as any).user.id;

      const approved = await MetadataService.approveAndActivateMetadata({
        metadataId: metaId,
        userId,
      });

      res.status(200).json({
        message: 'Đã duyệt và kích hoạt metadata thành công cho tài liệu',
        metadata: approved,
      });
    } catch (err: any) {
      console.error('[MetadataController.approveMetadata] Error:', err);
      res.status(400).json({ error: err.message || 'Không thể duyệt metadata' });
    }
  }

  /**
   * PUT /api/documents/:id/metadata/:metaId
   * Chỉnh sửa draft metadata trước khi duyệt
   */
  static async updateDraftMetadata(req: Request, res: Response) {
    try {
      const { metaId } = req.params;
      const { summary, themes, characters, analysis_points, keywords } = req.body;

      const updated = await MetadataService.updateDraftMetadata({
        metadataId: metaId,
        summary,
        themes,
        characters,
        analysis_points,
        keywords,
      });

      res.status(200).json({
        message: 'Đã cập nhật bản nháp metadata thành công',
        metadata: updated,
      });
    } catch (err: any) {
      console.error('[MetadataController.updateDraftMetadata] Error:', err);
      res.status(400).json({ error: err.message || 'Không thể cập nhật metadata' });
    }
  }
}
