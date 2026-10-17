import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send, Sparkles, BookOpen,
  Trash2, ShieldCheck, Info, FileText, ChevronDown, ChevronUp, Loader2,
  HelpCircle, UserCheck, ListOrdered, CheckSquare, MessageSquareText, Compass,
  MessageSquarePlus, CheckCircle2, AlertCircle
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Work, ChatMessage, LearningMode, QuotaInfo, User } from '../types.js';
import { apiRequest } from '../api/client.js';
import { getWorkSuggestions } from '../utils/suggestions.js';

interface StudentChatProps {
  works: Work[];
  quota: QuotaInfo | null;
  onRefreshQuota: () => void;
  currentUser?: User | null;
}

export const StudentChat: React.FC<StudentChatProps> = ({ works, quota, onRefreshQuota, currentUser }) => {
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [learningMode, setLearningMode] = useState<LearningMode>('qa');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openCitationIdx, setOpenCitationIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-select first active work
  useEffect(() => {
    if (works.length > 0 && !selectedWorkId) {
      setSelectedWorkId(works[0].id);
    }
  }, [works, selectedWorkId]);

  // Session-based chat storage key for active account and work
  const sessionKey = useMemo(() => {
    return `chat_session_${currentUser?.id || 'guest'}_${selectedWorkId || 'default'}`;
  }, [currentUser?.id, selectedWorkId]);

  // Load message history for the current session only
  useEffect(() => {
    if (!sessionKey) return;
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}
    setMessages([]);
  }, [sessionKey]);

  // Save messages to current session storage
  useEffect(() => {
    if (!sessionKey) return;
    try {
      if (messages.length > 0) {
        sessionStorage.setItem(sessionKey, JSON.stringify(messages));
      } else {
        sessionStorage.removeItem(sessionKey);
      }
    } catch {}
  }, [messages, sessionKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activeWork = works.find(w => w.id === selectedWorkId);

  // Dynamic suggestions tailored to the active literary work & mode
  const suggestions = useMemo(() => {
    return getWorkSuggestions(activeWork, learningMode);
  }, [activeWork, learningMode]);

  const learningModeConfigs = [
    { id: 'qa', label: 'Hỏi đáp tác phẩm', shortLabel: 'Hỏi đáp', icon: HelpCircle, desc: 'Giải đáp thấu đáo dựa trên tài liệu' },
    { id: 'character_analysis', label: 'Phân tích nhân vật', shortLabel: 'Nhân vật', icon: UserCheck, desc: '4 bước: Luận điểm - Dẫn chứng - Phân tích - Nhận xét' },
    { id: 'outline', label: 'Gợi ý dàn ý', shortLabel: 'Dàn ý', icon: ListOrdered, desc: 'Mở - Thân - Kết (cô không viết thay cả bài)' },
    { id: 'reading_comprehension', label: 'Luyện đọc hiểu', shortLabel: 'Đọc hiểu', icon: Compass, desc: 'Hỏi và chờ em trả lời từng câu một' },
    { id: 'essay_feedback', label: 'Góp ý bài viết', shortLabel: 'Góp ý bài', icon: MessageSquareText, desc: 'Giữ nguyên văn phong và cảm xúc của em' },
    { id: 'prep_and_review', label: 'Soạn bài & Ôn tập', shortLabel: 'Soạn & Ôn', icon: CheckSquare, desc: 'Theo mục tiêu bài học thầy cô giao' },
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

    // Reset textarea height on mobile
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Generate unique idempotency key
    const idempotencyKey = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    const recentHistory = messages.slice(-6).map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    try {
      const res = await apiRequest<{
        answer: string;
        citations: Array<{ fileName: string; sourceText?: string }>;
        isNoSource: boolean;
        toolActuallyUsed: boolean;
        modelUsed?: string;
        isLiveAi?: boolean;
        isCached?: boolean;
        verification?: any;
      }>('/api/student/ask', {
        method: 'POST',
        body: JSON.stringify({
          workId: selectedWorkId,
          question: textToSend,
          learningMode,
          idempotencyKey,
          history: recentHistory,
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
        isCached: res.isCached,
        verification: res.verification,
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

  const handleNewSession = () => {
    if (messages.length > 0 && !confirm('Em có muốn bắt đầu một phiên trò chuyện mới cho tác phẩm này? Khung chat sẽ được làm mới về ban đầu.')) {
      return;
    }
    setMessages([]);
    try {
      sessionStorage.removeItem(sessionKey);
    } catch {}
  };

  const handleClearHistory = async () => {
    if (!confirm('Em có chắc chắn muốn xóa tin nhắn trong phiên trò chuyện này?')) return;
    setMessages([]);
    try {
      sessionStorage.removeItem(sessionKey);
      await apiRequest('/api/student/history', { method: 'DELETE' });
    } catch {}
  };

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2 sm:py-5 flex flex-col h-[calc(100dvh-4rem)] sm:h-[calc(100vh-4.75rem)] min-h-0">
      {/* Top Banner: Work selector & Disclaimers */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-xs border border-[#e8e2d5] mb-2 sm:mb-3 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-800" />
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="work-select" className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tác phẩm đang học:
            </label>
            <select
              id="work-select"
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="mt-0.5 block w-full sm:w-72 font-bold text-[#0f2942] text-xs sm:text-sm bg-transparent border-none focus:ring-0 cursor-pointer p-0 truncate"
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
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-600 bg-[#fbf9f4] px-2.5 py-1.5 rounded-xl border border-[#e8e2d5]/70 shrink-0">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span className="truncate sm:whitespace-normal">Cô trả lời chuẩn theo tài liệu giáo viên đã cấp.</span>
        </div>
      </div>

      {/* Learning Mode Switcher: Mobile Swipeable Strip + Desktop Grid */}
      <div className="shrink-0 mb-2 sm:mb-3">
        {/* Mobile Horizontal Scrollable Pills */}
        <div className="sm:hidden flex overflow-x-auto no-scrollbar gap-1.5 pb-1 -mx-2 px-2 snap-x">
          {learningModeConfigs.map((m) => {
            const Icon = m.icon;
            const isSelected = learningMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setLearningMode(m.id as LearningMode)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap snap-start shrink-0 border transition-all ${
                  isSelected
                    ? 'bg-[#0f2942] text-white border-[#0f2942] shadow-xs'
                    : 'bg-white hover:bg-amber-50/60 text-[#1c2530] border-[#e8e2d5]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`} />
                <span>{m.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop 6-Column Grid */}
        <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {learningModeConfigs.map((m) => {
            const Icon = m.icon;
            const isSelected = learningMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setLearningMode(m.id as LearningMode)}
                title={m.desc}
                className={`p-2 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#0f2942] text-white border-[#0f2942] shadow-xs'
                    : 'bg-white hover:bg-amber-50/50 text-[#1c2530] border-[#e8e2d5]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold truncate">{m.label}</span>
                </div>
                <span className={`text-[10px] truncate mt-1 ${isSelected ? 'text-amber-200' : 'text-slate-400'}`}>
                  {m.desc.split(':')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Messages Scroll Area */}
      <div className="flex-1 min-h-0 bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 overflow-y-auto shadow-xs border border-[#e8e2d5] space-y-3 sm:space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center py-6 sm:py-10 px-2 sm:px-4">
            <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 mb-2.5 sm:mb-3 shadow-inner">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-amber-700" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#0f2942]">Chào em! Cô Dương đây</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mt-1 mb-4 sm:mb-6">
              Em đang cùng cô tìm hiểu tác phẩm <strong>"{activeWork?.title}"</strong> {activeWork?.author ? `của tác giả ${activeWork.author}` : ''}. Bấm vào câu hỏi gợi ý bên dưới hoặc tự gõ câu hỏi để bắt đầu nhé:
            </p>

            {/* Dynamic Quick Starters for Active Work */}
            <div className="w-full max-w-xl">
              <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Gợi ý cho tác phẩm "{activeWork?.title || 'bài học'}"
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s)}
                    className="text-xs p-2.5 sm:p-3 rounded-xl bg-[#fbf9f4] hover:bg-amber-50 text-[#0f2942] border border-[#e8e2d5] transition-all hover:border-amber-300 hover:shadow-xs flex items-start gap-2"
                  >
                    <span className="text-amber-700 font-bold shrink-0">✦</span>
                    <span className="line-clamp-2 leading-relaxed">{s}</span>
                  </button>
                ))}
              </div>
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
                className={`max-w-[92%] sm:max-w-[80%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#0f2942] text-white rounded-tr-xs shadow-xs'
                    : msg.isNoSource
                    ? 'bg-amber-50/90 text-amber-950 border border-amber-200 rounded-tl-xs'
                    : 'bg-[#fbf9f4] text-[#1c2530] border border-[#e8e2d5] rounded-tl-xs shadow-2xs'
                }`}
              >
                {/* Message Body with Safe Sanitized Markdown */}
                <div
                  className="prose-cu-duong text-xs sm:text-sm"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(marked.parse(msg.text) as string),
                  }}
                />

                {/* Grounding Citations Panel */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200/60">
                    <button
                      onClick={() => setOpenCitationIdx(openCitationIdx === idx ? null : idx)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#0f2942] hover:text-amber-800 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Căn cứ tài liệu giáo viên ({msg.citations.length})</span>
                      {openCitationIdx === idx ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {openCitationIdx === idx && (
                      <div className="mt-2 space-y-1.5">
                        {/* Source Files */}
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="bg-white/90 p-2 sm:p-2.5 rounded-xl border border-emerald-100 text-[11px] sm:text-xs text-slate-700"
                          >
                            <div className="font-semibold text-emerald-900 flex items-center gap-1 truncate">
                              <FileText className="w-3 h-3 text-emerald-700 shrink-0" />
                              <span className="truncate">{c.fileName}</span>
                            </div>
                            {c.sourceText && (
                              <p className="mt-1 text-[10px] sm:text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded-lg border-l-2 border-emerald-500 break-words">
                                "{c.sourceText}"
                              </p>
                            )}
                          </div>
                        ))}

                        {/* Verified Claims (ALCE Breakdown) */}
                        {msg.verification && msg.verification.results && msg.verification.results.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-emerald-100/60 space-y-1">
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                              Mức độ xác thực từng nhận định:
                            </div>
                            {msg.verification.results.map((r: any, rIdx: number) => (
                              <div
                                key={rIdx}
                                className={`p-1.5 rounded-lg text-[10px] border flex flex-col gap-0.5 ${
                                  r.is_verified
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium truncate">{r.claim.substring(0, 60)}...</span>
                                  <span
                                    className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                      r.is_verified
                                        ? 'bg-emerald-200/60 text-emerald-800'
                                        : 'bg-amber-200/60 text-amber-800'
                                    }`}
                                  >
                                    {r.badge_label}
                                  </span>
                                </div>
                                {r.rejection_reason && (
                                  <span className="text-[9px] text-amber-700 italic">
                                    Lưu ý: {r.rejection_reason}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Model & Verification Badges */}
                {msg.sender === 'ai' && !msg.text.startsWith('Lỗi:') && (
                  <div className="mt-2 pt-2 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {msg.isLiveAi ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Google Gemini ({msg.modelUsed || 'Live'})
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-900/80 font-medium bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/60" title="Chế độ phân tích tài liệu bài học trực tiếp">
                          <BookOpen className="w-3 h-3 text-amber-700" />
                          {msg.modelUsed || 'Tài liệu giáo viên (Ngoại tuyến)'}
                        </span>
                      )}
                      {msg.isCached && (
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                          Cache hit
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {msg.verification ? (
                        msg.verification.isFullyVerified ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            AI đã đối chiếu nhận định với nguồn
                          </span>
                        ) : msg.verification.isPartial ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Một số ý chưa đủ căn cứ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Chưa đủ căn cứ
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {msg.isNoSource ? 'Chưa đủ căn cứ' : 'RAG Grounded ✓'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-amber-100 flex items-center justify-center text-amber-900 shrink-0">
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-amber-800" />
            </div>
            <div className="bg-[#fbf9f4] p-2.5 sm:p-3 rounded-2xl rounded-tl-xs border border-[#e8e2d5] text-xs text-slate-600 flex items-center gap-2">
              <span>Cô đang tra cứu tài liệu bài học và suy ngẫm câu trả lời...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Dynamic Suggestions Carousel when Chat has messages (Fast Thumb Tap on Mobile) */}
      {messages.length > 0 && (
        <div className="shrink-0 mt-1.5 mb-1 px-1">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 snap-x">
            <span className="text-[10px] font-semibold text-slate-400 uppercase shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Gợi ý:
            </span>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white hover:bg-amber-50 text-[#0f2942] border border-[#e8e2d5] hover:border-amber-300 shrink-0 whitespace-nowrap snap-start shadow-2xs transition-colors"
              >
                💬 {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Action & Input Area */}
      <div className="mt-1.5 shrink-0 bg-white rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-xs border border-[#e8e2d5]">
        {/* Helper Line: Current Mode & Clear History */}
        <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] sm:text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 truncate">
            <span>Chế độ:</span>
            <strong className="text-[#0f2942] truncate font-semibold">
              {learningModeConfigs.find(m => m.id === learningMode)?.label}
            </strong>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleNewSession}
              title="Bắt đầu phiên trò chuyện mới (làm mới khung chat)"
              className="flex items-center gap-1 text-[#0f2942] hover:text-amber-800 font-semibold transition-colors px-2 py-0.5 rounded-md hover:bg-amber-50"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-amber-700" />
              <span>Phiên mới</span>
            </button>
            <button
              onClick={handleClearHistory}
              title="Xóa tin nhắn trong phiên này"
              className="flex items-center gap-1 text-slate-400 hover:text-red-600 transition-colors px-1.5 py-0.5 rounded-md hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Xóa</span>
            </button>
          </div>
        </div>

        {/* Input Form with Responsive Touch Area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-1.5 sm:gap-2"
        >
          <textarea
            ref={textareaRef}
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
                ? `Nhập nhân vật em muốn phân tích 4 bước...`
                : learningMode === 'outline'
                ? `Nhập đề bài em muốn cô gợi ý dàn ý...`
                : `Hỏi cô về bài học "${activeWork?.title}"...`
            }
            className="flex-1 bg-[#fbf9f4] rounded-xl px-3 py-2 text-base sm:text-sm text-[#1c2530] border border-[#e8e2d5] focus:outline-none focus:ring-2 focus:ring-[#0f2942]/20 resize-none min-h-[44px] max-h-24 sm:max-h-32"
            maxLength={1000}
          />

          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            aria-label="Gửi câu hỏi"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#0f2942] text-white hover:bg-[#1e3a5f] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold flex items-center justify-center shrink-0 shadow-xs active:scale-95"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
};
