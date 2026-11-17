import type { CatMemeAsset, ShortItem, SpoilerTrigger } from './types';

export const DEFAULT_WATCHLIST: string[] = [
  '오징어 게임',
  '기묘한 이야기',
  '눈물의 여왕',
  '범죄도시',
  '롤드컵'
];

export const DEFAULT_THRESHOLD = 0.70;

export const CAT_MEMES: CatMemeAsset[] = [
  {
    id: 'cat_meme_laptop_01',
    src: '/memes/cat_meme_laptop_01.jpg',
    caption: '스포일러 방어 완료! 대신 야근하는 부장 고양이 보고 가세요 😎'
  },
  {
    id: 'cat_meme_blanket_02',
    src: '/memes/cat_meme_blanket_02.jpg',
    caption: '마음의 평화 충전 중... 이불 밖은 스포일러가 위험해요 🐱'
  }
];

export const SPOILER_TRIGGERS: SpoilerTrigger[] = [
  { word: '결말', weight: 0.34 },
  { word: '사망', weight: 0.38 },
  { word: '죽음', weight: 0.35 },
  { word: '죽는', weight: 0.35 },
  { word: '범인', weight: 0.36 },
  { word: '흑막', weight: 0.36 },
  { word: '정체', weight: 0.30 },
  { word: '배신', weight: 0.30 },
  { word: '반전', weight: 0.28 },
  { word: '최종화', weight: 0.32 },
  { word: '마지막 화', weight: 0.32 },
  { word: '엔딩', weight: 0.30 },
  { word: '탈락', weight: 0.32 },
  { word: '우승', weight: 0.34 },
  { word: '역전', weight: 0.24 },
  { word: '확정', weight: 0.22 },
  { word: '검거', weight: 0.26 },
  { word: '체포', weight: 0.28 },
  { word: '스포', weight: 0.40 },
  { word: '요약', weight: 0.16 }
];

export const PRESET_SHORTS: ShortItem[] = [
  {
    id: 'yt_short_001',
    channel: '@seoul_foodie',
    emoji: '🍜',
    bgGradient: 'from-amber-950 via-slate-900 to-stone-950',
    title: '성수동 웨이팅 1시간 라멘집 솔직 리뷰 #성수맛집 #브이로그',
    ocr: '오늘의 점심 메뉴는 특제 돈코츠 라멘!',
    stt: '안녕하세요, 오늘은 성수동에서 제일 핫한 라멘집에 와봤습니다. 국물이 정말 진하네요!'
  },
  {
    id: 'yt_short_002',
    channel: '@drama_review_kr',
    emoji: '🦑',
    bgGradient: 'from-rose-950 via-slate-900 to-fuchsia-950',
    title: '[오징어 게임] 최종화 결말 해석! 456번의 마지막 선택 #오징어게임 #결말',
    ocr: '충격 반전! 결국 456번 성기훈이 마지막 게임에서 사망?!',
    stt: '여러분 오징어 게임 마지막 화에서 프론트맨의 정체가 드러나며 결국 기훈이 탈락하게 됩니다.'
  },
  {
    id: 'yt_short_003',
    channel: '@ai_dev_tips',
    emoji: '💻',
    bgGradient: 'from-sky-950 via-slate-900 to-indigo-950',
    title: '파이썬 3줄로 데이터 전처리 끝내는 꿀팁 #코딩 #AI빅데이터',
    ocr: '판다스(Pandas) 결측치 한 번에 정리하기',
    stt: '데이터 분석할 때 매번 반복되는 결측치 처리, 이 메서드 하나면 바로 해결됩니다.'
  },
  {
    id: 'yt_short_004',
    channel: '@cinema_spoiler_tv',
    emoji: '🎬',
    bgGradient: 'from-violet-950 via-slate-900 to-purple-950',
    title: '범죄도시 빌런 최후 1분 요약 #범죄도시 #명장면',
    ocr: '결국 마석도 펀치 한 방에 검거되는 최종 흑막 범인!',
    stt: '범죄도시 이번 시리즈에서 진짜 배신자 범인은 형사 팀장이었고 결국 엔딩에서 체포됩니다.'
  },
  {
    id: 'yt_short_005',
    channel: '@esports_highlight',
    emoji: '🏆',
    bgGradient: 'from-emerald-950 via-slate-900 to-teal-950',
    title: '롤드컵 결승전 마지막 5세트 넥서스 파괴 순간! #롤드컵 #우승',
    ocr: '기적의 역전 우승! 최종 스코어 3:2 확정 순간',
    stt: '방금 끝난 롤드컵 결승 5세트에서 바론 스틸 이후 그대로 우승을 확정지었습니다!'
  }
];
