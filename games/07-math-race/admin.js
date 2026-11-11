// 계산 레이스 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '계산 레이스 설정',
    storageKey: 'math_race_settings',
    recordId: 'game07',
    note: '라이벌과 3랩(덧셈·뺄셈 → 곱셈 → 빈칸 채우기)을 겨루는 계산 경주입니다. 랩마다 라이벌보다 먼저 결승선을 지나야 하고, 지면 그 랩부터 다시 합니다. 다시 할 때마다 라이벌이 조금씩 느려집니다.',
    presets: [
        { rivalSpeed: 85, lapQuestions: 6, numberLevel: 1 },
        { rivalSpeed: 100, lapQuestions: 7, numberLevel: 2 },
        { rivalSpeed: 115, lapQuestions: 8, numberLevel: 3 }
    ],
    fields: [
        { key: 'rivalSpeed', label: '🏎️ 라이벌 속도 (%)', min: 50, max: 200, step: 5, help: '100이 기준입니다. 높을수록 라이벌이 빨리 달립니다' },
        { key: 'lapQuestions', label: '🏁 랩당 문제 수', min: 4, max: 12, step: 1, help: '한 랩의 길이. 보스 문제 1개를 포함하고, 빨리 맞히면 더 적게 풀고 들어옵니다' },
        {
            key: 'numberLevel',
            label: '🔢 수의 범위',
            type: 'select',
            options: [[1, '1단계 · 쉬운 수'], [2, '2단계 · 두 자리와 구구단'], [3, '3단계 · 큰 수']],
            help: '1단계: 두 자리 ± 한 자리, 2~5단. 2단계: 두 자리 덧셈·뺄셈, 구구단, 나눗셈. 3단계: 세 자리 뺄셈, 두 자리 곱셈'
        }
    ]
});
