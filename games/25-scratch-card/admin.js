// 복권 긁기 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
(function () {
    'use strict';

    const PHOTO_KEY = 'scratch_bg_image'; // 게임이 읽는 사진. JSON 이 아니라 data URL 문자열 그대로 저장한다
    const h = AdminKit.h;

    // 사진은 localStorage 에 들어가므로 줄여서 저장한다. 그래도 넘치면 더 작게 다시 해 본다
    const STEPS = [[1280, 0.82], [1024, 0.78], [800, 0.72], [640, 0.65]];

    /** 긴 변이 maxSide 를 넘지 않게 줄인 JPEG data URL */
    function shrink(source, sw, sh, maxSide, quality) {
        const scale = Math.min(1, maxSide / Math.max(sw, sh));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sw * scale));
        canvas.height = Math.max(1, Math.round(sh * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // 투명한 그림이 검게 나오지 않도록
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', quality);
    }

    /** 사진(이미지나 비디오 화면)을 줄여서 저장한다. 저장하지 못하면 false. 실패해도 전에 있던 사진은 남는다 */
    function storePhoto(source, sw, sh) {
        if (!sw || !sh) return false;
        for (const [maxSide, quality] of STEPS) {
            try {
                localStorage.setItem(PHOTO_KEY, shrink(source, sw, sh, maxSide, quality));
                return true;
            } catch (e) {
                /* 용량 초과: 더 작게 다시 */
            }
        }
        return false;
    }

    function readPhoto() {
        let url = null;
        try {
            url = localStorage.getItem(PHOTO_KEY);
        } catch (e) {
            return null;
        }
        if (url && url.charAt(0) === '"') {
            try {
                url = JSON.parse(url);
            } catch (e) {
                /* 그대로 쓴다 */
            }
        }
        return typeof url === 'string' && url ? url : null;
    }

    function fileToImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('읽을 수 없는 사진'));
            };
            img.src = url;
        });
    }

    /** 사진 올리기·미리보기·지우기 */
    function renderPhoto(form, api) {
        const badge = h('span', { class: 'sc-badge' });
        const img = h('img', { alt: '사진 미리보기' });
        const preview = h('div', { class: 'sc-preview' }, [
            img,
            h('div', { class: 'sc-empty', html: '<b>🏆</b>사진이 없어요<br>기본 축하 그림이 나옵니다' }),
        ]);
        const albumInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
        const cameraInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
        // 아래 "저장하기"·"초기화" 버튼과 헷갈리지 않게 이 묶음만의 클래스를 쓴다
        const cameraBtn = h('button', { type: 'button', class: 'btn sc-pick', text: '📸 직접 촬영' });
        const albumBtn = h('button', { type: 'button', class: 'btn sc-pick', text: '🖼️ 앨범에서 고르기' });
        const removeBtn = h('button', { type: 'button', class: 'btn sc-remove', text: '사진 지우기' });

        // 지우기는 두 번 눌러야 한다
        let armed = false;
        let armTimer = null;
        function disarm() {
            armed = false;
            clearTimeout(armTimer);
            removeBtn.textContent = '사진 지우기';
        }

        function paint() {
            const url = readPhoto();
            preview.classList.toggle('has', !!url);
            if (url) img.src = url;
            else img.removeAttribute('src');
            badge.className = 'sc-badge ' + (url ? 'on' : 'off');
            badge.textContent = url ? `사진 설정됨 · 약 ${Math.max(1, Math.round((url.length * 0.75) / 1024))}KB` : '기본 그림 사용 중';
            removeBtn.disabled = !url;
            disarm();
        }

        function saved(ok) {
            paint();
            api.toast(ok ? '사진을 저장했어요' : '저장 공간이 모자라 사진을 저장하지 못했어요');
        }

        async function onFile(input) {
            const file = input.files && input.files[0];
            input.value = '';
            if (!file) return;
            try {
                const picture = await fileToImage(file);
                saved(storePhoto(picture, picture.naturalWidth, picture.naturalHeight));
            } catch (e) {
                api.toast('이 사진은 읽을 수 없어요. 다른 사진을 골라 주세요');
            }
        }
        albumInput.addEventListener('change', () => onFile(albumInput));
        cameraInput.addEventListener('change', () => onFile(cameraInput));
        albumBtn.addEventListener('click', () => albumInput.click());

        // 직접 촬영: 브라우저 카메라를 열고, 쓸 수 없으면 휴대폰의 카메라 앱으로 넘긴다
        const video = h('video', { autoplay: true, playsinline: true });
        video.muted = true;
        const modal = h('div', { class: 'sc-camera' }, [
            video,
            h('div', { class: 'sc-camera-bar' }, [
                h('button', { type: 'button', class: 'sc-close', text: '닫기', onclick: closeCamera }),
                h('button', { type: 'button', class: 'sc-shutter', 'aria-label': '찍기', onclick: takePhoto }),
            ]),
        ]);
        document.body.appendChild(modal);
        let stream = null;

        function closeCamera() {
            if (stream) stream.getTracks().forEach((track) => track.stop());
            stream = null;
            video.srcObject = null;
            modal.classList.remove('on');
        }

        function takePhoto() {
            if (!stream || !video.videoWidth) return;
            const ok = storePhoto(video, video.videoWidth, video.videoHeight);
            closeCamera();
            saved(ok);
        }

        cameraBtn.addEventListener('click', async () => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                cameraInput.click();
                return;
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                });
                video.srcObject = stream;
                modal.classList.add('on');
            } catch (e) {
                api.toast('카메라를 열 수 없어요. 앨범에서 골라 주세요');
            }
        });

        removeBtn.addEventListener('click', () => {
            if (!armed) {
                armed = true;
                removeBtn.textContent = '한 번 더 누르면 지워요';
                armTimer = setTimeout(disarm, 3000);
                return;
            }
            try {
                localStorage.removeItem(PHOTO_KEY);
            } catch (e) {
                /* 저장소를 쓸 수 없는 환경 */
            }
            paint();
            api.toast('사진을 지웠어요');
        });

        const box = h('div', { class: 'sc-photo-box' }, [
            badge,
            preview,
            h('div', { class: 'sc-photo-btns' }, [cameraBtn, albumBtn, removeBtn]),
            albumInput,
            cameraInput,
            h('small', {
                class: 'ak-help',
                text: '황금 복권을 다 긁으면 이 사진이 나옵니다. 보물을 숨긴 곳을 찍어 두세요. 사진은 고르는 즉시 저장되고, 아래 "초기화"를 눌러도 지워지지 않습니다.',
            }),
        ]);
        const title = h('h2', { class: 'form-section-title', text: '📷 보물 단서 사진' });
        const note = form.querySelector('.ak-note');
        const anchor = note ? note.nextSibling : form.firstChild;
        form.insertBefore(title, anchor);
        form.insertBefore(box, anchor);
        paint();
    }

    AdminKit.page({
        title: '복권 긁기 설정',
        storageKey: 'scratch_card_settings',
        recordId: 'game25',
        note: '복권 세 장을 차례로 긁는 게임입니다. 일반 복권(3×3) → 꽝이 숨은 고급 복권(4×4) → 황금 복권. 살짝 긁어 엿보고 같은 그림 3개만 끝까지 긁어야 동전이 남습니다. 황금 복권을 다 긁으면 아래에 올린 사진이 나옵니다.',
        presets: [
            { coinSlack: 1.8, stageTime: 50, bombs: 3, lives: 3, goldTime: 20, revealRatio: 70 },
            { coinSlack: 1.2, stageTime: 40, bombs: 4, lives: 3, goldTime: 14, revealRatio: 80 },
            { coinSlack: 0.8, stageTime: 32, bombs: 5, lives: 2, goldTime: 11, revealRatio: 88 }
        ],
        fields: [
            { key: 'coinSlack', label: '🪙 동전 여유 (칸)', min: 0.3, max: 4, step: 0.1, help: '정답 3칸을 다 긁고도 남는 엿보기용 동전. 고급 복권은 1.6배' },
            { key: 'stageTime', label: '⏱️ 복권 시간 (초)', min: 15, max: 120, step: 1, help: '일반 복권의 제한 시간. 고급 복권은 1.5배' },
            { key: 'bombs', label: '💣 꽝 개수', min: 1, max: 6, step: 1, help: '고급 복권에 숨는 꽝의 수' },
            { key: 'lives', label: '❤️ 하트 수', min: 1, max: 5, step: 1, help: '꽝을 터뜨리면 하나씩 줄고, 다 잃으면 실패' },
            { key: 'goldTime', label: '🏆 황금 복권 시간 (초)', min: 5, max: 60, step: 1, help: '사진을 긁어 여는 제한 시간' },
            { key: 'revealRatio', label: '🖼️ 황금 복권 공개 비율 (%)', min: 30, max: 95, step: 1, help: '이만큼 긁으면 사진이 모두 열립니다' }
        ],
        onRender: renderPhoto
    });
})();
