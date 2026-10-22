import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Loader2, Edit3, Save, Layers, HelpCircle, KeyRound, Tag } from 'lucide-react';
import { apiRequest } from '../api/client.js';

interface DocumentMetadataModalProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  onMetadataUpdated?: () => void;
}

export const DocumentMetadataModal: React.FC<DocumentMetadataModalProps> = ({
  documentId,
  documentTitle,
  onClose,
  onMetadataUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [activeMeta, setActiveMeta] = useState<any | null>(null);
  const [latestMeta, setLatestMeta] = useState<any | null>(null);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [status, setStatus] = useState<string>('Chưa có');

  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [editThemes, setEditThemes] = useState('');
  const [editCharacters, setEditCharacters] = useState('');
  const [editAnalysisPoints, setEditAnalysisPoints] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [approving, setApproving] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchMetadata = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/api/teacher/documents/${documentId}/metadata`);
      setActiveMeta(res.activeMetadata);
      setLatestMeta(res.latestMetadata);
      setActiveJob(res.activeJob);
      setStatus(res.status);

      const targetMeta = res.latestMetadata || res.activeMetadata;
      if (targetMeta) {
        setEditSummary(targetMeta.summary || '');
        setEditThemes((targetMeta.themes || []).join('\n'));
        setEditCharacters((targetMeta.characters || []).join(', '));
        setEditAnalysisPoints((targetMeta.analysis_points || []).join('\n'));
        setEditKeywords((targetMeta.keywords || []).join(', '));
      }
    } catch (err: any) {
      alert('Không thể tải metadata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [documentId]);

  // Polling nếu job đang chạy
  useEffect(() => {
    let interval: any;
    if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'processing')) {
      interval = setInterval(() => {
        fetchMetadata();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeJob]);

  const handleTriggerRegeneration = async () => {
    try {
      setTriggering(true);
      const res = await apiRequest(`/api/teacher/documents/${documentId}/regenerate-metadata`, {
        method: 'POST',
      });
      alert(res.message);
      await fetchMetadata();
      if (onMetadataUpdated) onMetadataUpdated();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi kích hoạt tạo metadata');
    } finally {
      setTriggering(false);
    }
  };

  const handleApprove = async (metaId: string) => {
    if (!confirm('Bạn có chắc chắn muốn DUYỆT VÀ KÍCH HOẠT bản metadata này?\n\nMetadata mới sẽ chính thức được sử dụng để tối ưu truy xuất chunk trong hệ thống RAG.')) return;
    try {
      setApproving(true);
      const res = await apiRequest(`/api/teacher/documents/${documentId}/metadata/${metaId}/approve`, {
        method: 'POST',
      });
      alert(res.message);
      await fetchMetadata();
      if (onMetadataUpdated) onMetadataUpdated();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi duyệt metadata');
    } finally {
      setApproving(false);
    }
  };

  const handleSaveEdit = async (metaId: string) => {
    try {
      setSavingEdit(true);
      const res = await apiRequest(`/api/teacher/documents/${documentId}/metadata/${metaId}`, {
        method: 'PUT',
        body: JSON.stringify({
          summary: editSummary,
          themes: editThemes.split('\n').map((t) => t.trim()).filter(Boolean),
          characters: editCharacters.split(',').map((c) => c.trim()).filter(Boolean),
          analysis_points: editAnalysisPoints.split('\n').map((a) => a.trim()).filter(Boolean),
          keywords: editKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        }),
      });
      alert(res.message);
      setIsEditing(false);
      await fetchMetadata();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu chỉnh sửa metadata');
    } finally {
      setSavingEdit(false);
    }
  };

  const displayMeta = latestMeta || activeMeta;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white w-full max-w-3xl rounded-2xl border border-[#e8e2d5] shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#e8e2d5] flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-[#0f2942]">Metadata tài liệu RAG</h3>
              <p className="text-xs text-slate-500 truncate max-w-md">{documentTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                status === 'Đang sử dụng'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : status === 'Chờ duyệt'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : status === 'Đang xử lý'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {status}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
              <span>Đang tải thông tin metadata...</span>
            </div>
          ) : (
            <>
              {/* Job Progress Notice */}
              {activeJob && (activeJob.status === 'pending' || activeJob.status === 'processing') && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Tác vụ phân tích metadata đang chạy ({activeJob.progress_pct}%)...</span>
                  </div>
                  <span className="text-[10px] text-blue-600 font-mono">ID: {activeJob.id.slice(0, 8)}</span>
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="text-[11px] text-slate-500">
                  {displayMeta ? (
                    <span>
                      Phiên bản: <strong>v{displayMeta.version}</strong> • Phương thức: <strong>{displayMeta.generation_method}</strong> • Cập nhật:{' '}
                      {new Date(displayMeta.updated_at || displayMeta.created_at).toLocaleString('vi-VN')}
                    </span>
                  ) : (
                    <span>Tài liệu chưa có metadata phân tích ngữ nghĩa.</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={triggering || (activeJob && activeJob.status === 'processing')}
                    onClick={handleTriggerRegeneration}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>{displayMeta ? '↻ Tạo lại metadata' : 'Tạo metadata'}</span>
                  </button>

                  {displayMeta && displayMeta.status !== 'active' && (
                    <button
                      disabled={approving}
                      onClick={() => handleApprove(displayMeta.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Duyệt & Kích hoạt</span>
                    </button>
                  )}

                  {displayMeta && !isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Chỉnh sửa nháp</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Metadata Details view or edit */}
              {displayMeta ? (
                isEditing ? (
                  /* Edit Form */
                  <div className="space-y-3 bg-[#fbf9f4] p-4 rounded-xl border border-[#e8e2d5]">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Tóm tắt ngắn gọn:</label>
                      <textarea
                        rows={3}
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Chủ đề chính (mỗi dòng một chủ đề):</label>
                      <textarea
                        rows={3}
                        value={editThemes}
                        onChange={(e) => setEditThemes(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Nhân vật đề cập (ngăn cách bởi dấu phẩy):</label>
                      <input
                        type="text"
                        value={editCharacters}
                        onChange={(e) => setEditCharacters(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Luận điểm phân tích (mỗi dòng một ý):</label>
                      <textarea
                        rows={3}
                        value={editAnalysisPoints}
                        onChange={(e) => setEditAnalysisPoints(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Từ khóa tìm kiếm (ngăn cách bởi dấu phẩy):</label>
                      <input
                        type="text"
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(displayMeta.id)}
                        className="px-4 py-1.5 rounded-lg bg-[#0f2942] text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Lưu thay đổi</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Read View */
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200">
                      <span className="font-bold text-[#0f2942] block mb-1">Tóm tắt tài liệu:</span>
                      <p className="text-slate-700 leading-relaxed">{displayMeta.summary || 'Chưa có tóm tắt.'}</p>
                    </div>

                    {/* Themes & Characters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-800 flex items-center gap-1 mb-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-600" />
                          Chủ đề chính ({displayMeta.themes?.length || 0}):
                        </span>
                        {displayMeta.themes && displayMeta.themes.length > 0 ? (
                          <ul className="list-disc list-inside space-y-1 text-slate-600">
                            {displayMeta.themes.map((th: string, i: number) => (
                              <li key={i}>{th}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-400 italic">Chưa xác định</span>
                        )}
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-800 flex items-center gap-1 mb-1.5">
                          <Tag className="w-3.5 h-3.5 text-amber-600" />
                          Nhân vật đề cập ({displayMeta.characters?.length || 0}):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {displayMeta.characters && displayMeta.characters.length > 0 ? (
                            displayMeta.characters.map((ch: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                {ch}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">Không có nhân vật cụ thể</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Keywords */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800 flex items-center gap-1 mb-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        Từ khóa tìm kiếm phục vụ RAG:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {displayMeta.keywords && displayMeta.keywords.length > 0 ? (
                          displayMeta.keywords.map((kw: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono text-[11px]">
                              {kw}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">Chưa có từ khóa</span>
                        )}
                      </div>
                    </div>

                    {/* Q&A Pairs */}
                    {displayMeta.qa_pairs && displayMeta.qa_pairs.length > 0 && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-800 flex items-center gap-1 mb-2">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                          Câu hỏi - Đáp án trích từ tài liệu ({displayMeta.qa_pairs.length}):
                        </span>
                        <div className="space-y-2">
                          {displayMeta.qa_pairs.map((qa: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                              <span className="font-bold text-[#0f2942] block">Q: {qa.question}</span>
                              <p className="text-slate-600 italic">A: {qa.answer_snippet}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <p>Tài liệu này chưa được tạo metadata hỗ trợ truy xuất.</p>
                  <p className="text-[11px] text-slate-500">
                    Bấm <strong>"Tạo metadata"</strong> để hệ thống phân tích tóm tắt, chủ đề, nhân vật và từ khóa.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
