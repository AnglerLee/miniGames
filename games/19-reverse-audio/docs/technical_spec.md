# 19-reverse-audio 기술 명세서

## 개요

리버스 오디오 게임은 Web Audio API를 활용하여 오디오를 역재생하고, 사용자가 속도를 조절하며 원래 음성을 찾아내는 게임입니다.

## 핵심 기술

### 1. localStorage 기반 오디오 저장

#### 저장 방식
- **MediaRecorder API**로 음성 녹음
- **Blob**을 **Base64**로 인코딩
- **localStorage**에 저장

```javascript
// 녹음 → Base64 변환 → 저장
const reader = new FileReader();
reader.onloadend = () => {
    const base64Audio = reader.result; // data:audio/webm;base64,xxxxx
    localStorage.setItem(`reverseAudio_${questionId}`, base64Audio);
};
reader.readAsDataURL(recordedBlob);
```

#### 로드 방식
- localStorage에서 Base64 문자열 읽기
- Base64 → ArrayBuffer 디코딩
- AudioContext로 AudioBuffer 생성

```javascript
async function loadAudioFromLocalStorage(questionId) {
    const audioData = localStorage.getItem(`reverseAudio_${questionId}`);
    
    // Base64 디코딩
    const binaryString = atob(audioData.split(',')[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // AudioBuffer로 변환
    return await audioCtx.decodeAudioData(bytes.buffer);
}
```

### 2. 버퍼 역재생 알고리즘

오디오 버퍼의 샘플 데이터를 역순으로 재배열하여 역재생 효과를 구현합니다.

```javascript
function reverseBuffer(buffer) {
    const numChannels = buffer.numberOfChannels;
    const newBuffer = audioCtx.createBuffer(
        numChannels,
        buffer.length,
        buffer.sampleRate
    );
    
    for (let c = 0; c < numChannels; c++) {
        const oldData = buffer.getChannelData(c);
        const newData = newBuffer.getChannelData(c);
        
        // 샘플 역순 배치
        for (let i = 0; i < buffer.length; i++) {
            newData[i] = oldData[buffer.length - 1 - i];
        }
    }
    
    return newBuffer;
}
```

### 3. 속도 조절 재생

`playbackRate`를 사용하여 재생 속도를 조절합니다.

```javascript
function playBuffer(buffer, rate) {
    const source = audioCtx.createBufferSource();
    let playBuffer = buffer;
    let playRate = Math.abs(rate);
    const isReverse = rate < 0;
    
    // 음수 속도 = 역재생
    if (isReverse) {
        playBuffer = reverseBuffer(buffer);
    }
    
    source.buffer = playBuffer;
    source.playbackRate.value = playRate; // 속도 조절
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    source.start();
}
```

## 데이터 구조

### localStorage 키 구조

```
reverseAudio_settings                 // 난이도별 설정 (JSON)
reverseAudio_questions_0              // 쉬움 문제 목록 (JSON 배열)
reverseAudio_questions_1              // 보통 문제 목록
reverseAudio_questions_2              // 어려움 문제 목록
reverseAudio_q_0_1234567890          // 개별 오디오 (Base64)
reverseAudio_q_1_1234567891
...
```

### 설정 데이터 형식

```json
{
    "0": { "questions": 3, "maxHints": 3 },
    "1": { "questions": 5, "maxHints": 2 },
    "2": { "questions": 7, "maxHints": 1 }
}
```

### 문제 목록 데이터 형식

```json
[
    { "id": "q_0_1234567890", "answer": "사과" },
    { "id": "q_0_1234567891", "answer": "바나나" }
]
```

## 기술적 고려사항

### localStorage 용량 제한
- 브라우저별 5-10MB 제한
- Base64 인코딩으로 약 33% 크기 증가
- 녹음 시간 5초 제한 권장 (약 50-100KB per 문제)

### 브라우저 호환성
- **AudioContext**: 모든 최신 브라우저 지원
- **MediaRecorder**: Chrome, Firefox, Edge 지원
- **atob/btoa**: 모든 브라우저 지원

### 성능 최적화
- 오디오 디코딩은 비동기 처리 (`async/await`)
- 재생 중 버퍼 재사용으로 메모리 절약
- 사용하지 않는 AudioSource 정리

## 참고 자료

- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [localStorage - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
