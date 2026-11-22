"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2, X, SlidersHorizontal } from "lucide-react";
import type { KeywordRule } from "@/types/video";

interface KeywordSettingsModalProps {
  open: boolean;
  keywords: KeywordRule[];
  threshold: number;
  onClose: () => void;
  onToggleKeyword: (id: string) => void;
  onAddKeyword: (term: string) => void;
  onRemoveKeyword: (id: string) => void;
  onChangeThreshold: (nextThreshold: number) => void;
}

export default function KeywordSettingsModal({
  open,
  keywords,
  threshold,
  onClose,
  onToggleKeyword,
  onAddKeyword,
  onRemoveKeyword,
  onChangeThreshold,
}: KeywordSettingsModalProps) {
  const [newTerm, setNewTerm] = useState("");

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newTerm.trim();
    if (!trimmed) return;
    onAddKeyword(trimmed);
    setNewTerm("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="차단 키워드 및 민감도 설정"
        className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-[#ffffff] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#0f172a]" />
            <h2 className="text-sm font-bold text-[#0f172a]">
              차단 키워드 및 민감도 설정
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="설정 창 닫기"
            className="p-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Sensitivity Slider */}
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0f172a]">
                차단 임계치 (민감도)
              </span>
              <span className="font-bold text-[#0f172a] tabular-nums">
                {threshold}% 이상일 때 차단
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={100}
              step={5}
              value={threshold}
              onChange={(e) => onChangeThreshold(Number(e.target.value))}
              onInput={(e) =>
                onChangeThreshold(Number((e.target as HTMLInputElement).value))
              }
              className="w-full cursor-pointer"
              aria-label="스포일러 차단 임계치 조절"
            />
            <div className="flex items-center justify-between gap-1 text-[11px] tabular-nums">
              {[
                [40, "40% (엄격)"],
                [55, "55%"],
                [70, "70% (기본)"],
                [85, "85%"],
                [100, "100% (여유)"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChangeThreshold(Number(val))}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                    threshold === Number(val)
                      ? "bg-[#0f172a] text-[#ffffff] font-semibold"
                      : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Add Keyword Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="보호할 작품·인물·대회명 추가 (예: 흑백요리사)"
              className="flex-1 rounded-lg border border-[#e2e8f0] bg-[#ffffff] px-3 py-2 text-xs text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#0f172a]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-[#ffffff] px-3.5 py-2 text-xs font-semibold transition shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              추가
            </button>
          </form>

          {/* Keyword List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#475569]">
                등록된 보호 키워드 ({keywords.filter((k) => k.enabled).length}/
                {keywords.length} 활성)
              </span>
              <span className="text-[11px] text-[#64748b]">
                켜고 끄기로 즉시 반영
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-[#e2e8f0] rounded-lg border border-[#e2e8f0]">
              {keywords.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#64748b]">
                  등록된 차단 키워드가 없습니다. 위 입력창에서 추가해 보세요.
                </div>
              ) : (
                keywords.map((kw) => (
                  <div
                    key={kw.id}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-[#ffffff] hover:bg-[#f8fafc]"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleKeyword(kw.id)}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <span
                        className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                          kw.enabled ? "bg-[#0f172a]" : "bg-[#cbd5e1]"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-[#ffffff] transition-transform ${
                            kw.enabled ? "translate-x-3" : "translate-x-0"
                          }`}
                        />
                      </span>
                      <span
                        className={`text-xs font-medium truncate ${
                          kw.enabled
                            ? "text-[#0f172a]"
                            : "text-[#94a3b8] line-through"
                        }`}
                      >
                        {kw.term}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveKeyword(kw.id)}
                      aria-label={`${kw.term} 키워드 삭제`}
                      className="p-1 text-[#94a3b8] hover:text-[#dc2626] rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-[#ffffff] px-4 py-2 text-xs font-semibold transition cursor-pointer"
          >
            적용 후 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
