/* ===== theme-manager.js - Theme Management ===== */

const ThemeManager = {
    current: null,

    themes: {
        mystery: {
            id: 'mystery',
            name: '미스테리 탐정단',
            icon: '🔍',
            description: '비밀 금고를 찾아라!',
            primary: '#2E4057',
            accent: '#FFD700'
        },
        pirate: {
            id: 'pirate',
            name: '해적 보물섬',
            icon: '🏴‍☠️',
            description: '블랙비어드의 보물 지도를 복원하라!',
            primary: '#8B4513',
            accent: '#FFD700'
        },
        space: {
            id: 'space',
            name: '우주 탐험대',
            icon: '🚀',
            description: '외계인 메시지를 해독하라!',
            primary: '#1e3a8a',
            accent: '#00D4FF'
        },
        magic: {
            id: 'magic',
            name: '마법학교 비밀',
            icon: '🔮',
            description: '마법 시험을 통과해 봉인을 풀어라!',
            primary: '#7c3aed',
            accent: '#FF6B9D'
        },
        dino: {
            id: 'dino',
            name: '공룡시대 발굴단',
            icon: '🦖',
            description: '화석 단서로 타임캡슐을 해독하라!',
            primary: '#15803d',
            accent: '#FF8C42'
        },
        jungle: {
            id: 'jungle',
            name: '정글 탐험대',
            icon: '🌴',
            description: '정글 속 황금 신전을 찾아라!',
            primary: '#2d5016',
            accent: '#4CAF50'
        },
        ocean: {
            id: 'ocean',
            name: '심해 탐험대',
            icon: '🐚',
            description: '아틀란티스의 비밀을 밝혀라!',
            primary: '#0d47a1',
            accent: '#00BCD4'
        },
        ninja: {
            id: 'ninja',
            name: '닌자 수련관',
            icon: '🥷',
            description: '비밀 두루마리를 지켜라!',
            primary: '#1a1a2e',
            accent: '#F44336'
        },
        haunted: {
            id: 'haunted',
            name: '유령의 집',
            icon: '👻',
            description: '유령 저택에서 탈출하라!',
            primary: '#2d1b4e',
            accent: '#9b59b6'
        }
    },

    apply(themeId) {
        const theme = this.themes[themeId];
        if (!theme) return;
        this.current = themeId;
        document.documentElement.setAttribute('data-theme', themeId);
    },

    getTheme(themeId) {
        return this.themes[themeId] || this.themes.mystery;
    },

    getAllThemes() {
        return Object.values(this.themes);
    },

    getCurrentTheme() {
        return this.themes[this.current] || this.themes.mystery;
    }
};
