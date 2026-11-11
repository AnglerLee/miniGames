// 보물 공개 방식. 설정 화면에서 고르고, 본부 콘솔의 개봉 화면에서 보여 준다.

export const REWARD_TYPES = [
  { id: 'combo', icon: '🔢', name: '자물쇠 번호', label: '자물쇠 번호', placeholder: '예: 7 2 4' },
  { id: 'place', icon: '📍', name: '숨긴 장소', label: '간식을 숨긴 곳', placeholder: '예: 세탁기 안' },
  { id: 'key', icon: '🗝️', name: '열쇠 위치', label: '열쇠를 둔 곳', placeholder: '예: 책장 맨 위 칸 사전 뒤' },
  { id: 'text', icon: '✏️', name: '자유 문구', label: '공개할 문구', placeholder: '예: 엄마에게 암호 "초코"를 말하면 간식 지급' },
];

export const rewardType = (id) => REWARD_TYPES.find((t) => t.id === id) || REWARD_TYPES[3];
