import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Sparkles, BookOpen,
  Trash2, ShieldCheck, Info, FileText, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Work, ChatMessage, LearningMode, QuotaInfo } from '../types.js';
import { apiRequest } from '../api/client.js';

interface StudentChatProps {
  works: Work[];
  quota: QuotaInfo | null;
  onRefreshQuota: () => void;
}

export const StudentChat: React.FC<StudentChatProps> = ({ works, quota, onRefreshQuota }) => {
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [learningMode, setLearningMode] = useState<LearningMode>('qa');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saveLocalHistory, setSaveLocalHistory] = useState(true);
  const [openCitationIdx, setOpenCitationIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first active work
  useEffect(() => {
    if (works.length > 0 && !selectedWorkId) {
      setSelectedWorkId(works[0].id);
    }
  }, [works]);

  // Load message history from backend on initial mount
  useEffect(() => {
    if (!saveLocalHistory) return;
    apiRequest<{ history: any[] }>('/api/student/history')
      .then((data) => {
        if (data.history && data.history.length > 0) {
          const loaded: ChatMessage[] = [];
          for (const item of data.history.reverse()) {
            let citations = [];
            try {
              citations = item.citations_meta ? JSON.parse(item.citations_meta) : [];
            } catch {}
            loaded.push({
              id: item.id,
              sender: 'ai',
              text: item.response_text || 'Đã lưu phản hồi',
              citations,
              isNoSource: item.status === 'no_source',
              timestamp: new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            });
          }
          setMessages(loaded);
        }
      })
      .catch(() => {});
  }, [saveLocalHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activeWork = works.find(w => w.id === selectedWorkId);

  const learningModeConfigs = [
    { id: 'qa', label: 'Hỏi đáp tác phẩm', desc: 'Giải đáp thấu đáo dựa trên tài liệu' },
    { id: 'character_analysis', label: 'Phân tích nhân vật', desc: '4 bước: Luận điểm - Dẫn chứng - Phân tích - Nhận xét' },
    { id: 'outline', label: 'Gợi ý dàn ý', desc: 'Mở - Thân - Kết (cô không viết thay cả bài)' },
    { id: 'reading_comprehension', label: 'Luyện đọc hiểu', desc: 'Hỏi và chờ em trả lời từng câu một' },
    { id: 'essay_feedback', label: 'Góp ý bài viết', desc: 'Giữ nguyên văn phong và cảm xúc của em' },
    { id: 'prep_and_review', label: 'Soạn bài & Ôn tập', desc: 'Theo mục tiêu bài học thầy cô giao' },
  ];

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || question).trim();
    if (!textToSend || isLoading || !selectedWorkId) return;

    if (quota && !quota.isUnlimited && quota.remaining <= 0) {
      alert('Em đã sử dụng hết lượt hỏi hôm nay. Hãy ôn lại bài hoặc xin giáo viên cấp thêm lượt nhé!');
      return;
    }

    const clientMsg: ChatMessage = {
      id: `client_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, clientMsg]);
    setQuestion('');
    setIsLoading(true);

    // Generate unique idempotency key
    const idempotencyKey = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    try {
      const res = await apiRequest<{
        answer: string;
        citations: Array<{ fileName: string; sourceText?: string }>;
        isNoSource: boolean;
        toolActuallyUsed: boolean;
        modelUsed?: string;
        isLiveAi?: boolean;
      }>('/api/student/ask', {
        method: 'POST',
        body: JSON.stringify({
          workId: selectedWorkId,
          question: textToSend,
          learningMode,
          idempotencyKey,
        }),
      });

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: res.answer,
        citations: res.citations || [],
        isNoSource: res.isNoSource,
        toolActuallyUsed: res.toolActuallyUsed,
        modelUsed: res.modelUsed,
        isLiveAi: res.isLiveAi,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, aiMsg]);
      onRefreshQuota();
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: `Lỗi: ${err.message || 'Không thể kết nối máy chủ'}. Lượt hỏi của em được bảo toàn nguyên vẹn.`,
        isNoSource: true,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Em có chắc chắn muốn xóa toàn bộ lịch sử hỏi đáp của tài khoản này trên thiết bị?')) return;
    try {
      await apiRequest('/api/student/history', { method: 'DELETE' });
      setMessages([]);
    } catch (err: any) {
      alert(err.message || 'Không thể xóa lịch sử');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Banner: Work selector & Disclaimers */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#e8e2d5] mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="work-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tác phẩm đang học:
              </label>
            </div>
            <select
              id="work-select"
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="mt-0.5 block w-full sm:w-64 font-bold text-[#0f2942] text-sm bg-transparent border-none focus:ring-0 cursor-pointer p-0"
            >
              {works.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} ({w.author} - Lớp {w.grade})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* AI Pedagogical Disclaimer */}
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-[#fbf9f4] px-3 py-1.5 rounded-xl border border-[#e8e2d5]/60">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Cô là trợ lý AI học tập, đồng hành và trả lời theo tài liệu giáo viên cung cấp.</span>
        </div>
      </div>

      {/* Learning Mode Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        {learningModeConfigs.map((m) => (
          <button
            key={m.id}
            onClick={() => setLearningMode(m.id as LearningMode)}
            title={m.desc}
            className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
              learningMode === m.id
                ? 'bg-[#0f2942] text-white border-[#0f2942] shadow-xs'
                : 'bg-white hover:bg-amber-50/50 text-[#1c2530] border-[#e8e2d5]'
            }`}
          >
            <span className="text-xs font-bold truncate">{m.label}</span>
            <span className={`text-[10px] truncate mt-0.5 ${learningMode === m.id ? 'text-amber-200' : 'text-slate-400'}`}>
              {m.desc.split(':')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Chat Messages Scroll Area */}
      <div className="flex-1 bg-white rounded-2xl p-4 sm:p-6 overflow-y-auto shadow-xs border border-[#e8e2d5] space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 mb-3 shadow-inner">
              <Sparkles className="w-8 h-8 text-amber-700" />
            </div>
            <h3 className="text-base font-bold text-[#0f2942]">Chào em! Cô Dương đây</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-6">
              Em đang cùng cô tìm hiểu tác phẩm <strong>"{activeWork?.title}"</strong>. Hãy chọn chế độ học hoặc bấm câu hỏi gợi ý bên dưới để bắt đầu nhé:
            </p>

            {/* Quick Starters */}
            <div className="flex flex-wrap gap-2 justify-center max-w-xl">
              {[
                'Phân tích vẻ đẹp nhân vật anh thanh niên',
                'Chiếc máy đo gió của anh thanh niên được bọc bằng gì trong tài liệu?',
                'Gợi ý dàn ý bài văn nghị luận tác phẩm',
                'Ý nghĩa nhan đề tác phẩm là gì?',
              ].map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[#f4efe6] hover:bg-amber-100 text-[#0f2942] border border-[#e8e2d5] transition-colors"
                >
                  💬 {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  {msg.sender === 'user' ? 'Em' : 'Cô Dương AI'}
                </span>
                <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#0f2942] text-white rounded-tr-xs shadow-xs'
                    : msg.isNoSource
                    ? 'bg-amber-50/90 text-amber-950 border border-amber-200 rounded-tl-xs'
                    : 'bg-[#fbf9f4] text-[#1c2530] border border-[#e8e2d5] rounded-tl-xs shadow-2xs'
                }`}
              >
                {/* Message Body with Safe Sanitized Markdown */}
                <div
                  className="prose-cu-duong text-sm"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(marked.parse(msg.text) as string),
                  }}
                />

                {/* Grounding Citations Panel */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60">
                    <button
                      onClick={() => setOpenCitationIdx(openCitationIdx === idx ? null : idx)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#0f2942] hover:text-amber-800 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Căn cứ tài liệu giáo viên ({msg.citations.length})
                      {openCitationIdx === idx ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {openCitationIdx === idx && (
                      <div className="mt-2 space-y-1.5">
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 text-xs text-slate-700"
                          >
                            <div className="font-semibold text-emerald-900 flex items-center gap-1">
                              <FileText className="w-3 h-3 text-emerald-700" />
                              {c.fileName}
                            </div>
                            {c.sourceText && (
                              <p className="mt-1 text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded-lg border-l-2 border-emerald-500">
                                "{c.sourceText}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Model Badge */}
                {msg.sender === 'ai' && !msg.text.startsWith('Lỗi:') && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {msg.modelUsed ? `Google Gemini AI (${msg.modelUsed})` : 'Google Gemini AI'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {msg.isNoSource ? 'Chưa đủ căn cứ' : 'RAG Grounded ✓'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center text-amber-900">
              <Loader2 className="w-4 h-4 animate-spin text-amber-800" />
            </div>
            <div className="bg-[#fbf9f4] p-3 rounded-2xl rounded-tl-xs border border-[#e8e2d5] text-xs text-slate-600 flex items-center gap-2">
              <span>Cô đang tra cứu tài liệu bài học và suy ngẫm câu trả lời...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Action & Input Area */}
      <div className="mt-3 bg-white rounded-2xl p-2.5 sm:p-3 shadow-xs border border-[#e8e2d5]">
        <div className="flex items-center justify-between px-2 mb-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-600">
              Chế độ hiện tại: <strong className="text-[#0f2942]">{learningModeConfigs.find(m => m.id === learningMode)?.label}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 cursor-pointer hover:text-slate-700">
              <input
                type="checkbox"
                checked={saveLocalHistory}
                onChange={(e) => setSaveLocalHistory(e.target.checked)}
                className="rounded text-[#0f2942] w-3 h-3"
              />
              <span>Lưu trên máy này</span>
            </label>
            <button
              onClick={handleClearHistory}
              title="Xóa lịch sử trên thiết bị này"
              className="hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Xóa lịch sử
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              learningMode === 'qa'
                ? `Hỏi cô về nhân vật, chi tiết, nhan đề trong "${activeWork?.title}"...`
                : learningMode === 'character_analysis'
                ? `Nhập nhân vật và khía cạnh em muốn phân tích 4 bước...`
                : learningMode === 'outline'
                ? `Nhập đề bài em muốn cô gợi ý dàn ý...`
                : `Nhập nội dung tương tác với cô...`
            }
            className="flex-1 bg-[#fbf9f4] rounded-xl px-3 py-2 text-sm text-[#1c2530] border border-[#e8e2d5] focus:outline-none focus:ring-2 focus:ring-[#0f2942]/20 resize-none"
            maxLength={1000}
          />

          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="px-4 py-3 rounded-xl bg-[#0f2942] text-white hover:bg-[#1e3a5f] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold flex items-center justify-center shrink-0 shadow-xs"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};
