// 사진 고르기: 파일 입력 → 줄이기 → IndexedDB 저장. 용의자 사진과 쪽지 힌트 사진이 함께 쓴다.

import { photos, shrinkImage } from '../shared/store.js';
import { h, toast } from '../shared/dom.js';

let told = false;

/**
 * 사진 고르는 버튼. 파일을 고르면 줄여서 key 로 저장하고 onSaved(key) 를 부른다.
 * 저장이 안 되는 브라우저면 한 번만 알리고 조용히 넘어간다 (사진은 없어도 게임이 된다).
 */
export function photoButton({ key, label, maxSide, onSaved, capture = true, testId }) {
  const input = h('input', {
    type: 'file',
    accept: 'image/*',
    capture: capture ? 'environment' : null,
    'data-photo-input': testId || key,
    onChange: async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      try {
        const blob = await shrinkImage(file, maxSide);
        await photos.put(key, blob);
        onSaved(key);
      } catch (e) {
        if (!told) {
          told = true;
          toast('이 브라우저에서는 사진을 저장할 수 없어요. 그림으로 진행할게요.', 'bad', 3200);
        }
      }
    },
  });
  return h('label', { class: 'btn small ghost file-btn' }, label, input);
}

/** 저장된 사진 미리보기 (없으면 아무것도 그리지 않는다) */
export function photoThumb(key) {
  const img = h('img', { class: 'thumb', alt: '', hidden: true });
  if (key) {
    photos.url(key).then((url) => {
      if (url) {
        img.src = url;
        img.hidden = false;
      }
    });
  }
  return img;
}
