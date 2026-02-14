from PIL import Image, ImageDraw, ImageFont
import os

def get_font(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except:
        return ImageFont.load_default()

def get_font_r(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except:
        return ImageFont.load_default()

# ============ THEME PALETTES ============
def create_theme_palettes():
    themes = {
        "mystery": {
            "name": "미스테리 탐정단",
            "icon": "🔍",
            "colors": {
                "Primary": "#1A237E",
                "Secondary": "#CFB53B", 
                "Background": "#0D0D1A",
                "Card BG": "#1A1A30",
                "Text": "#E8E8F0",
                "Accent": "#FFD700",
                "Success": "#2ECC71",
                "Error": "#E74C3C"
            },
            "mood": "어두운 서재, 탐정 분위기"
        },
        "pirate": {
            "name": "해적 보물섬",
            "icon": "🏴‍☠️",
            "colors": {
                "Primary": "#8B4513",
                "Secondary": "#20B2AA",
                "Background": "#1A0F00",
                "Card BG": "#2A1A05",
                "Text": "#F5E6C8",
                "Accent": "#FFD700",
                "Success": "#2ECC71",
                "Error": "#E74C3C"
            },
            "mood": "고지도, 바다, 모험 분위기"
        },
        "space": {
            "name": "우주 탐험대",
            "icon": "🚀",
            "colors": {
                "Primary": "#0D47A1",
                "Secondary": "#00E676",
                "Background": "#050510",
                "Card BG": "#0A1628",
                "Text": "#E0E8FF",
                "Accent": "#00E676",
                "Success": "#00E676",
                "Error": "#FF5252"
            },
            "mood": "우주, 네온, SF 분위기"
        },
        "magic": {
            "name": "마법학교 비밀",
            "icon": "🧙",
            "colors": {
                "Primary": "#4A148C",
                "Secondary": "#FFD700",
                "Background": "#0D0520",
                "Card BG": "#1A0A35",
                "Text": "#E8D8FF",
                "Accent": "#FFD700",
                "Success": "#76FF03",
                "Error": "#FF6E40"
            },
            "mood": "마법, 판타지, 신비 분위기"
        },
        "dino": {
            "name": "공룡시대 발굴단",
            "icon": "🦕",
            "colors": {
                "Primary": "#33691E",
                "Secondary": "#FF8F00",
                "Background": "#0F1208",
                "Card BG": "#1A2210",
                "Text": "#E8F0D8",
                "Accent": "#FF8F00",
                "Success": "#69F0AE",
                "Error": "#FF5252"
            },
            "mood": "정글, 발굴, 탐험 분위기"
        },
    }
    
    W, H = 900, 360
    
    for tid, theme in themes.items():
        img = Image.new("RGB", (W, H), "#1A1A2E")
        draw = ImageDraw.Draw(img)
        
        # Header
        draw.rounded_rectangle([0, 0, W, 60], radius=0, fill=theme["colors"]["Primary"])
        draw.text((20, 14), f"{theme['icon']}  {theme['name']}", fill="#FFFFFF", font=get_font(22))
        draw.text((W-250, 20), theme["mood"], fill="#FFFFFFAA", font=get_font_r(12))
        
        # Color swatches
        colors = theme["colors"]
        x = 20
        y = 80
        swatch_w = 95
        swatch_h = 95
        gap = 10
        
        for i, (name, color) in enumerate(colors.items()):
            col = i % 8
            cx = x + col * (swatch_w + gap)
            cy = y
            
            draw.rounded_rectangle([cx, cy, cx+swatch_w, cy+swatch_h], radius=12, fill=color, outline="#444466", width=1)
            
            # Color hex text
            brightness = sum(int(color[i:i+2], 16) for i in (1, 3, 5)) / 3
            text_color = "#000000" if brightness > 128 else "#FFFFFF"
            draw.text((cx+8, cy+swatch_h-35), color, fill=text_color, font=get_font(11))
            
            # Name
            draw.text((cx+8, cy+8), name, fill=text_color, font=get_font_r(10))
        
        # Button previews
        y2 = 200
        draw.text((20, y2), "버튼 스타일 미리보기", fill="#888899", font=get_font_r(11))
        
        # Primary button
        btn_color = theme["colors"]["Accent"]
        draw.rounded_rectangle([20, y2+25, 200, y2+70], radius=28, fill=btn_color)
        brightness = sum(int(btn_color[i:i+2], 16) for i in (1, 3, 5)) / 3
        tc = "#000" if brightness > 128 else "#FFF"
        draw.text((60, y2+37), "모험 시작!", fill=tc, font=get_font(14))
        
        # Secondary button
        draw.rounded_rectangle([220, y2+25, 400, y2+70], radius=28, fill=theme["colors"]["Card BG"], outline=theme["colors"]["Secondary"], width=2)
        draw.text((270, y2+37), "힌트 보기", fill=theme["colors"]["Secondary"], font=get_font(14))
        
        # Card preview
        draw.rounded_rectangle([420, y2+10, 700, y2+85], radius=16, fill=theme["colors"]["Card BG"], outline=theme["colors"]["Primary"], width=1)
        draw.text((440, y2+22), "미션 카드 미리보기", fill=theme["colors"]["Accent"], font=get_font(12))
        draw.text((440, y2+48), "단서를 모아 보물상자를 열어라!", fill=theme["colors"]["Text"], font=get_font_r(11))
        
        # Background sample
        draw.rounded_rectangle([720, y2+10, 880, y2+85], radius=12, fill=theme["colors"]["Background"], outline="#444466", width=1)
        draw.text((735, y2+35), "Background", fill=theme["colors"]["Text"], font=get_font_r(11))
        
        # Progress bar sample
        y3 = y2 + 100
        draw.text((20, y3), "진행도 바:", fill="#888899", font=get_font_r(11))
        draw.rounded_rectangle([120, y3, 400, y3+16], radius=8, fill=theme["colors"]["Card BG"])
        draw.rounded_rectangle([120, y3, 280, y3+16], radius=8, fill=theme["colors"]["Success"])
        
        draw.text((420, y3), "타이머 바:", fill="#888899", font=get_font_r(11))
        draw.rounded_rectangle([520, y3, 800, y3+16], radius=8, fill=theme["colors"]["Card BG"])
        draw.rounded_rectangle([520, y3, 700, y3+16], radius=8, fill=theme["colors"]["Error"])
        
        img.save(f"/home/claude/assets/themes/theme_{tid}.png")
        print(f"Theme {tid} created")


# ============ COMPONENT LIBRARY ============
def create_component_library():
    W, H = 900, 1400
    img = Image.new("RGB", (W, H), "#F5F7FA")
    draw = ImageDraw.Draw(img)
    
    # Title
    draw.rectangle([0, 0, W, 50], fill="#1B4332")
    draw.text((20, 12), "UI 컴포넌트 라이브러리 (Component Library)", fill="#FFFFFF", font=get_font(20))
    
    y = 70
    
    # --- BUTTONS ---
    draw.text((20, y), "1. 버튼 (Buttons)", fill="#333333", font=get_font(16))
    y += 30
    
    # Primary
    draw.text((20, y+8), "Primary:", fill="#666666", font=get_font_r(11))
    draw.rounded_rectangle([120, y, 300, y+48], radius=24, fill="#FFD700")
    draw.text((160, y+12), "모험 시작!", fill="#000000", font=get_font(15))
    
    # Secondary  
    draw.text((320, y+8), "Secondary:", fill="#666666", font=get_font_r(11))
    draw.rounded_rectangle([430, y, 610, y+48], radius=24, fill="#F5F7FA", outline="#2ECC71", width=2)
    draw.text((480, y+12), "힌트 보기", fill="#2ECC71", font=get_font(15))
    
    # Danger
    draw.text((630, y+8), "Danger:", fill="#666666", font=get_font_r(11))
    draw.rounded_rectangle([720, y, 880, y+48], radius=24, fill="#E74C3C")
    draw.text((765, y+12), "건너뛰기", fill="#FFFFFF", font=get_font(15))
    
    y += 70
    # Small buttons
    draw.text((20, y+4), "Small:", fill="#666666", font=get_font_r(11))
    draw.rounded_rectangle([120, y, 240, y+36], radius=18, fill="#3498DB")
    draw.text((150, y+8), "다음 미션", fill="#FFFFFF", font=get_font(12))
    
    draw.text((260, y+4), "Icon btn:", fill="#666666", font=get_font_r(11))
    draw.rounded_rectangle([360, y, 408, y+36], radius=18, fill="#252550")
    draw.text((373, y+6), "⏸", fill="#FFFFFF", font=get_font(16))
    
    draw.rounded_rectangle([420, y, 468, y+36], radius=18, fill="#252550")
    draw.text((433, y+6), "🔊", fill="#FFFFFF", font=get_font(16))
    
    y += 60
    draw.line([(20, y), (W-20, y)], fill="#DDDDDD", width=1)
    y += 20
    
    # --- CARDS ---
    draw.text((20, y), "2. 카드 (Cards)", fill="#333333", font=get_font(16))
    y += 30
    
    # Mission card
    draw.rounded_rectangle([20, y, 280, y+160], radius=16, fill="#1A1A3E", outline="#FFD700", width=2)
    draw.text((40, y+10), "MISSION 3", fill="#FFD700", font=get_font(14))
    draw.line([(40, y+35), (260, y+35)], fill="#333366")
    draw.rounded_rectangle([110, y+45, 190, y+95], radius=12, fill="#252550")
    draw.text((138, y+55), "🎮", fill="#FFF", font=get_font(24))
    draw.text((85, y+105), "이모지 퀴즈", fill="#FFFFFF", font=get_font(12))
    draw.text((60, y+125), "미니게임 | 보통 | 60초", fill="#8888AA", font=get_font_r(10))
    
    # Clue card
    draw.rounded_rectangle([300, y, 560, y+160], radius=16, fill="#1A1A3E")
    draw.text((320, y+10), "단서 카드", fill="#FFD700", font=get_font(14))
    draw.rounded_rectangle([310, y+35, 550, y+145], radius=12, fill="#252550")
    draw.text((350, y+60), "🔑", fill="#FFF", font=get_font(30))
    draw.text((400, y+65), "\"X 표시를 찾아라\"", fill="#FFD700", font=get_font_r(12))
    draw.text((320, y+110), "미션 3 클리어 보상", fill="#8888AA", font=get_font_r(10))
    
    # Hint card
    draw.rounded_rectangle([580, y, 880, y+160], radius=16, fill="#1A1A3E", outline="#4ECDC4", width=2)
    draw.text((600, y+10), "💡 힌트 1/3", fill="#4ECDC4", font=get_font(14))
    draw.line([(600, y+35), (860, y+35)], fill="#333366")
    draw.text((600, y+55), "\"물이 차갑게", fill="#FFFFFF", font=get_font_r(14))
    draw.text((600, y+78), " 잠드는 곳을", fill="#FFFFFF", font=get_font_r(14))
    draw.text((600, y+101), " 열어보아라.\"", fill="#FFFFFF", font=get_font_r(14))
    # Dots
    for i in range(3):
        color = "#4ECDC4" if i == 0 else "#333355"
        draw.ellipse([700+i*20, y+130, 712+i*20, y+142], fill=color)
    
    y += 180
    draw.line([(20, y), (W-20, y)], fill="#DDDDDD", width=1)
    y += 20
    
    # --- INPUT FIELDS ---
    draw.text((20, y), "3. 입력 필드 (Input Fields)", fill="#333333", font=get_font(16))
    y += 30
    
    # Text input
    draw.text((20, y+8), "Text:", fill="#666666", font=get_font_r(11))
    draw.rounded_rectangle([100, y, 400, y+44], radius=12, fill="#252550", outline="#444488", width=1)
    draw.text((115, y+12), "정답을 입력하세요...", fill="#555577", font=get_font_r(13))
    
    # PIN input
    draw.text((430, y+8), "PIN:", fill="#666666", font=get_font_r(11))
    for i in range(4):
        draw.ellipse([510+i*40, y+12, 530+i*40, y+32], fill="#FFD700" if i < 2 else None, outline="#888888", width=2)
    
    y += 60
    # Number input
    draw.text((20, y+8), "Number:", fill="#666666", font=get_font_r(11))
    for i in range(3):
        draw.rounded_rectangle([120+i*60, y, 168+i*60, y+44], radius=10, fill="#FFFFFF", outline="#CCCCCC", width=1)
        draw.text((136+i*60, y+10), str([7,2,4][i]), fill="#333333", font=get_font(16))
    
    y += 65
    draw.line([(20, y), (W-20, y)], fill="#DDDDDD", width=1)
    y += 20
    
    # --- PROGRESS ---
    draw.text((20, y), "4. 진행도 표시 (Progress Indicators)", fill="#333333", font=get_font(16))
    y += 30
    
    # Step indicator
    draw.text((20, y), "Mission Steps:", fill="#666666", font=get_font_r(11))
    y += 20
    steps = 6
    for i in range(steps):
        cx = 60 + i * 130
        if cx > W - 60: break
        if i < 3:
            draw.ellipse([cx-14, y, cx+14, y+28], fill="#2ECC71")
            draw.text((cx-5, y+4), "✓", fill="#FFF", font=get_font(12))
        elif i == 3:
            draw.ellipse([cx-16, y-2, cx+16, y+30], fill="#FFD700")
            draw.text((cx-5, y+4), str(i+1), fill="#000", font=get_font(13))
        else:
            draw.ellipse([cx-14, y, cx+14, y+28], outline="#888888", width=2)
            draw.text((cx-5, y+5), str(i+1), fill="#888888", font=get_font(12))
        if i < steps-1:
            ncx = 60 + (i+1) * 130
            if ncx <= W - 60:
                color = "#2ECC71" if i < 3 else "#444444"
                draw.line([(cx+16, y+14), (ncx-16, y+14)], fill=color, width=2)
    
    y += 50
    # Timer bar
    draw.text((20, y), "Timer Bar:", fill="#666666", font=get_font_r(11))
    draw.rounded_rectangle([140, y, 600, y+14], radius=7, fill="#1A1A2E")
    draw.rounded_rectangle([140, y, 440, y+14], radius=7, fill="#27AE60")
    draw.text((610, y-2), "0:42", fill="#666666", font=get_font_r(12))
    
    y += 30
    draw.rounded_rectangle([140, y, 600, y+14], radius=7, fill="#1A1A2E")
    draw.rounded_rectangle([140, y, 260, y+14], radius=7, fill="#E74C3C")
    draw.text((610, y-2), "0:15 (!)", fill="#E74C3C", font=get_font_r(12))
    
    y += 35
    draw.line([(20, y), (W-20, y)], fill="#DDDDDD", width=1)
    y += 20
    
    # --- MODALS ---
    draw.text((20, y), "5. 모달 (Modals & Feedback)", fill="#333333", font=get_font(16))
    y += 30
    
    # Success modal
    draw.rounded_rectangle([20, y, 280, y+140], radius=16, fill="#0D2A0D", outline="#2ECC71", width=2)
    draw.text((80, y+10), "🎉 클리어!", fill="#2ECC71", font=get_font(18))
    draw.text((100, y+45), "A 등급", fill="#FFD700", font=get_font(16))
    draw.rounded_rectangle([50, y+80, 250, y+115], radius=8, fill="#252550")
    draw.text((70, y+88), "📜 단서 획득!", fill="#FFD700", font=get_font_r(12))
    
    # Fail modal
    draw.rounded_rectangle([300, y, 560, y+140], radius=16, fill="#2A0D0D", outline="#E74C3C", width=2)
    draw.text((360, y+10), "⏰ 시간 초과!", fill="#E74C3C", font=get_font(18))
    draw.text((330, y+45), "아깝다! 다시 도전해봐!", fill="#FFFFFF", font=get_font_r(12))
    draw.rounded_rectangle([320, y+80, 430, y+115], radius=8, fill="#E74C3C")
    draw.text((340, y+88), "재도전", fill="#FFF", font=get_font(12))
    draw.rounded_rectangle([440, y+80, 540, y+115], radius=8, fill="#333355")
    draw.text((455, y+88), "건너뛰기", fill="#AAA", font=get_font_r(11))
    
    # Toast
    draw.rounded_rectangle([600, y, 880, y+50], radius=12, fill="#2ECC71")
    draw.text((620, y+14), "✓ 설정이 저장되었습니다", fill="#FFFFFF", font=get_font(12))
    
    draw.rounded_rectangle([600, y+65, 880, y+115], radius=12, fill="#E74C3C")
    draw.text((620, y+80), "✕ 정답이 아닙니다!", fill="#FFFFFF", font=get_font(12))
    
    y += 160
    draw.line([(20, y), (W-20, y)], fill="#DDDDDD", width=1)
    y += 20
    
    # --- ICONS ---
    draw.text((20, y), "6. 아이콘 & 뱃지 (Icons & Badges)", fill="#333333", font=get_font(16))
    y += 30
    
    # Mission type icons
    types = [("🎮", "미니게임", "#3498DB"), ("🔎", "물건찾기", "#2ECC71"), 
             ("🏆", "최종미션", "#FFD700"), ("💡", "힌트", "#4ECDC4"),
             ("🔒", "잠금", "#E74C3C"), ("🔓", "해제", "#27AE60")]
    for i, (icon, label, color) in enumerate(types):
        cx = 40 + i * 140
        if cx > W - 60: break
        draw.rounded_rectangle([cx-25, y, cx+25, y+50], radius=12, fill=color)
        draw.text((cx-10, y+8), icon, fill="#FFF", font=get_font(22))
        draw.text((cx-25, y+56), label, fill="#666666", font=get_font_r(10))
    
    y += 80
    # Grade badges
    grades = [("S", "#FFD700"), ("A", "#2ECC71"), ("B", "#3498DB"), ("C", "#E67E22"), ("F", "#E74C3C")]
    draw.text((20, y), "등급:", fill="#666666", font=get_font_r(11))
    for i, (grade, color) in enumerate(grades):
        cx = 100 + i * 60
        draw.rounded_rectangle([cx, y-5, cx+40, y+30], radius=8, fill=color)
        draw.text((cx+12, y+1), grade, fill="#FFF" if grade != "S" else "#000", font=get_font(16))
    
    y += 50
    draw.line([(20, y), (W-20, y)], fill="#DDDDDD", width=1)
    y += 20
    
    # --- SPACING & SIZING ---
    draw.text((20, y), "7. 간격 & 크기 규격 (Spacing & Sizing)", fill="#333333", font=get_font(16))
    y += 30
    
    specs = [
        "터치 영역 최소 크기: 48 x 48 px",
        "버튼 높이: Primary 56px / Secondary 44px / Small 36px",
        "카드 라운딩: 16px (일반) / 20px (미션 카드) / 28px (버튼)",
        "간격 (Spacing): 8px / 12px / 16px / 24px / 32px",
        "폰트 크기: Title 24px / Body 16px / Caption 12px / Label 11px",
        "아이콘 크기: 24px (일반) / 32px (강조) / 48px (미션 타입)",
        "화면 좌우 패딩: 20px",
        "카드 내부 패딩: 16px",
    ]
    for spec in specs:
        draw.text((30, y), "•  " + spec, fill="#555555", font=get_font_r(12))
        y += 22
    
    img.save("/home/claude/assets/components/component_library.png")
    print("Component library created")


# ============ ICON SET ============
def create_icon_set():
    W, H = 900, 500
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([0, 0, W, 40], fill="#2E4057")
    draw.text((20, 8), "게임 아이콘 세트 (Game Icon Set)", fill="#FFFFFF", font=get_font(18))
    
    # Minigame icons
    draw.text((20, 55), "미니게임 아이콘 (20종)", fill="#333333", font=get_font(13))
    games = [
        ("😎", "#FF6B6B"), ("🃏", "#4ECDC4"), ("⚖️", "#A78BFA"),
        ("🔊", "#FB923C"), ("🧩", "#60A5FA"), ("🎯", "#F472B6"),
        ("⚡", "#FBBF24"), ("⌨️", "#34D399"), ("🏃", "#818CF8"),
        ("👁️", "#F87171"), ("🎨", "#38BDF8"), ("🔐", "#C084FC"),
        ("🎵", "#FB7185"), ("📝", "#4ADE80"), ("🔗", "#67E8F9"),
        ("📊", "#FCA5A5"), ("🎯", "#A3E635"), ("🧮", "#FCD34D"),
        ("🧱", "#6EE7B7"), ("🔮", "#D8B4FE"),
    ]
    names = [
        "이모지퀴즈", "메모리매칭", "균형잡기", "소리유지", "슬라이드퍼즐",
        "패턴따라", "반응속도", "타이핑", "미로탈출", "숨은그림",
        "색상분류", "암호해독", "리듬게임", "단어찾기", "연결퍼즐",
        "순서맞추기", "타겟슈팅", "계산챌린지", "블록쌓기", "구슬탈출",
    ]
    
    for i, ((icon, color), name) in enumerate(zip(games, names)):
        row = i // 10
        col = i % 10
        x = 20 + col * 88
        y = 80 + row * 100
        draw.rounded_rectangle([x, y, x+78, y+60], radius=12, fill=color)
        draw.text((x+25, y+12), icon, fill="#FFFFFF", font=get_font(24))
        draw.text((x+5, y+65), name, fill="#666666", font=get_font_r(9))
    
    # Theme icons
    y_base = 295
    draw.text((20, y_base), "테마 아이콘 (5종)", fill="#333333", font=get_font(13))
    theme_icons = [
        ("🔍", "미스테리", "#1A237E"),
        ("🏴‍☠️", "해적", "#4E342E"),
        ("🚀", "우주", "#0D47A1"),
        ("🧙", "마법학교", "#4A148C"),
        ("🦕", "공룡시대", "#33691E"),
    ]
    for i, (icon, name, color) in enumerate(theme_icons):
        x = 20 + i * 170
        draw.rounded_rectangle([x, y_base+25, x+150, y_base+100], radius=16, fill=color)
        draw.text((x+15, y_base+40), icon, fill="#FFF", font=get_font(32))
        draw.text((x+60, y_base+48), name, fill="#FFFFFF", font=get_font(15))
        draw.text((x+60, y_base+72), color, fill="#FFFFFFBB", font=get_font_r(10))
    
    # UI action icons
    y_base2 = 410
    draw.text((20, y_base2), "UI 액션 아이콘", fill="#333333", font=get_font(13))
    ui_icons = [
        ("⚙️", "설정"), ("⏸", "일시정지"), ("🔊", "사운드 ON"),
        ("🔇", "사운드 OFF"), ("←", "뒤로"), ("✕", "닫기"),
        ("💡", "힌트"), ("🗺", "미션맵"), ("📦", "단서함"),
        ("🏆", "결과"),
    ]
    for i, (icon, name) in enumerate(ui_icons):
        x = 20 + i * 88
        draw.rounded_rectangle([x, y_base2+25, x+78, y_base2+60], radius=8, fill="#F0F0F0", outline="#DDDDDD", width=1)
        draw.text((x+25, y_base2+30), icon, fill="#333", font=get_font(18))
        draw.text((x+10, y_base2+65), name, fill="#888888", font=get_font_r(9))
    
    img.save("/home/claude/assets/icons/icon_set.png")
    print("Icon set created")


# ============ SCREEN FLOW DIAGRAM ============
def create_flow_diagram():
    W, H = 1200, 600
    img = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(img)
    
    draw.rectangle([0, 0, W, 40], fill="#2D6A4F")
    draw.text((20, 8), "화면 전환 흐름도 (Screen Flow Diagram)", fill="#FFFFFF", font=get_font(18))
    
    screens = [
        (80, 100, "S01\n메인 진입", "#3498DB"),
        (80, 300, "S02\n관리자\n인증", "#9B59B6"),
        (280, 300, "S03\n관리자\n대시보드", "#9B59B6"),
        (280, 100, "S04\n스토리\n인트로", "#2ECC71"),
        (480, 100, "S05\n미션 허브", "#E67E22"),
        (680, 50, "S06\n미니게임\n플레이", "#E74C3C"),
        (680, 200, "S07\n물건 찾기\n미션", "#27AE60"),
        (950, 130, "S08\n최종\n보물상자", "#FFD700"),
    ]
    
    for x, y, text, color in screens:
        draw.rounded_rectangle([x, y, x+140, y+100], radius=14, fill=color)
        lines = text.split("\n")
        for i, line in enumerate(lines):
            f = get_font(12) if i == 0 else get_font_r(11)
            bbox = draw.textbbox((0,0), line, font=f)
            tw = bbox[2] - bbox[0]
            draw.text((x + (140-tw)//2, y + 15 + i*22), line, fill="#FFFFFF", font=f)
    
    # Arrows
    arrows = [
        (220, 150, 280, 150, "게임 시작"),
        (150, 200, 150, 300, "관리자 진입\n(롱프레스)"),
        (220, 350, 280, 350, "PIN 인증"),
        (420, 150, 480, 150, "인트로 끝"),
        (620, 120, 680, 80, "미니게임\n미션"),
        (620, 160, 680, 230, "물건찾기\n미션"),
        (820, 80, 860, 80, ""),
        (820, 230, 860, 230, ""),
        (860, 80, 860, 230, ""),
        (860, 155, 950, 155, "모든 미션\n완료"),
    ]
    
    # Simple arrow drawing
    connections = [
        ((220, 150), (280, 150), "게임 시작"),
        ((150, 200), (150, 300), "관리자\n(롱프레스)"),
        ((220, 350), (280, 350), "PIN 인증"),
        ((420, 150), (480, 150), "인트로 후"),
        ((620, 130), (680, 80), "미니게임"),
        ((620, 170), (680, 230), "물건찾기"),
        ((820, 100), (950, 160), ""),
        ((820, 250), (950, 190), ""),
    ]
    
    for (x1, y1), (x2, y2), label in connections:
        draw.line([(x1, y1), (x2, y2)], fill="#666666", width=2)
        # Arrow head
        draw.polygon([(x2, y2), (x2-8, y2-5), (x2-8, y2+5)], fill="#666666")
        if label:
            mx, my = (x1+x2)//2, (y1+y2)//2
            for i, line in enumerate(label.split("\n")):
                draw.text((mx-30, my-18+i*14), line, fill="#333333", font=get_font_r(9))
    
    # Loop back arrow from S06/S07 to S05
    draw.text((620, 340), "클리어 →", fill="#27AE60", font=get_font_r(10))
    draw.text((680, 340), "미션 허브로 복귀", fill="#27AE60", font=get_font_r(10))
    draw.rounded_rectangle([610, 330, 830, 360], radius=8, outline="#27AE60", width=1)
    
    # Legend
    draw.text((20, 500), "범례:", fill="#333333", font=get_font(12))
    legend = [("플레이어 화면", "#3498DB"), ("관리자 화면", "#9B59B6"), 
              ("게임 화면", "#E67E22"), ("최종 화면", "#FFD700")]
    for i, (label, color) in enumerate(legend):
        x = 90 + i * 200
        draw.rounded_rectangle([x, 498, x+20, 518], radius=4, fill=color)
        draw.text((x+28, 501), label, fill="#666666", font=get_font_r(11))
    
    # Data flow note
    draw.text((20, 540), "데이터 흐름: S03에서 localStorage에 설정 저장 → S04~S08에서 읽어 게임 진행", fill="#999999", font=get_font_r(11))
    draw.text((20, 560), "미션 클리어 시마다 S05(미션 허브)로 복귀, 전체 클리어 시 S08(보물상자)로 이동", fill="#999999", font=get_font_r(11))
    
    img.save("/home/claude/assets/components/screen_flow.png")
    print("Screen flow diagram created")


create_theme_palettes()
create_component_library()
create_icon_set()
create_flow_diagram()
print("\nAll assets created!")
