'use client';

import React from 'react';

interface ApiGuideModalProps {
  open: boolean;
  onClose: () => void;
  capabilities: {
    youtube_data_api_v3: boolean;
    gemini_stage4: boolean;
    openai_stage4: boolean;
  } | null;
}

export default function ApiGuideModal({ open, onClose, capabilities }: ApiGuideModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">🔌 외부 API 연동 상태 및 배포 설정 가이드</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            닫기 ✕
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs text-slate-300 max-h-[75vh] overflow-y-auto">
          <p className="leading-relaxed text-slate-300">
            이 웹 앱은 <strong className="text-white">API 키가 없어도</strong> YouTube oEmbed + 공개 자막 파서 + 온디바이스 4단계 엔진으로 즉시 동작합니다. 아래 키를 <code className="mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">.env.local</code> 또는 Vercel 환경 변수에 추가하면 실시간 검색과 멀티모달 AI 추론이 활성화됩니다.
          </p>

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white mono">YOUTUBE_API_KEY</div>
                <div className="text-slate-400 mt-0.5">
                  실시간 유튜브 쇼츠 키워드 검색 + 설명란·태그·조회수 수집
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] shrink-0 ${
                  capabilities?.youtube_data_api_v3
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {capabilities?.youtube_data_api_v3 ? '연결됨' : 'oEmbed/파서 폴백'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white mono">GEMINI_API_KEY</div>
                <div className="text-slate-400 mt-0.5">
                  Stage 4에서 Gemini 2.0 Flash로 텍스트 + 썸네일 이미지 멀티모달 판정 및 근거 생성
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] shrink-0 ${
                  capabilities?.gemini_stage4
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {capabilities?.gemini_stage4 ? '연결됨' : '온디바이스 폴백'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white mono">OPENAI_API_KEY</div>
                <div className="text-slate-400 mt-0.5">
                  Gemini 미설정 시 Stage 4에서 GPT-4o-mini 문맥 추론 대체 사용
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] shrink-0 ${
                  capabilities?.openai_stage4
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {capabilities?.openai_stage4 ? '연결됨' : '미설정'}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-400 mb-1.5">
              .env.local / Vercel Environment Variables 예시
            </div>
            <pre className="mono text-[11px] p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 overflow-x-auto">
{`YOUTUBE_API_KEY=AIzaSy...
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-...`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
