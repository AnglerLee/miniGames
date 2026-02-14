from PIL import Image, ImageDraw, ImageFont
import os

W, H = 390, 844  # iPhone-like dimensions
BG = "#0F0F2E"
CARD_BG = "#1A1A3E"
ACCENT = "#FFD700"
TEXT = "#FFFFFF"
TEXT_SUB = "#8888AA"
GREEN = "#2ECC71"
RED = "#E74C3C"
BLUE = "#3498DB"
PURPLE = "#9B59B6"

def get_font(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except:
        return ImageFont.load_default()

def get_font_regular(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except:
        return ImageFont.load_default()

def draw_phone_frame(draw):
    # Status bar
    draw.rectangle([0, 0, W, 44], fill="#0A0A1E")
    draw.text((20, 12), "9:41", fill=TEXT, font=get_font(14))
    draw.text((W-60, 12), "100%", fill=TEXT, font=get_font(14))
    # Bottom bar
    draw.rectangle([0, H-34, W, H], fill="#0A0A1E")
    draw.rounded_rectangle([W//2-67, H-20, W//2+67, H-14], radius=3, fill="#666666")

def draw_button(draw, x, y, w, h, text, color=ACCENT, text_color="#000000", radius=28):
    draw.rounded_rectangle([x, y, x+w, y+h], radius=radius, fill=color)
    f = get_font(16)
    bbox = draw.textbbox((0,0), text, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((x + (w-tw)//2, y + (h-th)//2), text, fill=text_color, font=f)

def draw_card(draw, x, y, w, h, fill=CARD_BG, radius=16):
    draw.rounded_rectangle([x, y, x+w, y+h], radius=radius, fill=fill)

def draw_icon_circle(draw, cx, cy, r, color, symbol=""):
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)
    if symbol:
        f = get_font(int(r*1.2))
        bbox = draw.textbbox((0,0), symbol, font=f)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text((cx - tw//2, cy - th//2 - 2), symbol, fill="#FFFFFF", font=f)

# ============ S01: Main Entry ============
def create_s01():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_phone_frame(draw)
    
    # Gear icon (admin)
    draw.ellipse([16, 56, 48, 88], outline=TEXT_SUB, width=2)
    draw.text((24, 62), "⚙", fill=TEXT_SUB, font=get_font(16))
    
    # Logo area
    draw.text((W//2 - 80, 140), "HOME", fill=ACCENT, font=get_font(36))
    draw.text((W//2 - 120, 185), "TREASURE", fill=TEXT, font=get_font(36))
    draw.text((W//2 - 60, 230), "HUNT", fill=ACCENT, font=get_font(36))
    draw.text((W//2 - 90, 280), "집에서 시작되는 모험", fill=TEXT_SUB, font=get_font_regular(14))
    
    # Key visual area
    draw_card(draw, 45, 320, 300, 260, fill="#151535")
    # Treasure chest illustration
    draw.rounded_rectangle([120, 370, 270, 470], radius=8, fill="#8B4513")
    draw.rounded_rectangle([130, 350, 260, 380], radius=6, fill="#A0522D")
    draw.ellipse([180, 420, 210, 450], fill=ACCENT)
    draw.text((125, 490), "Theme Visual Area", fill=TEXT_SUB, font=get_font_regular(12))
    
    # Player select
    draw_card(draw, 95, 620, 200, 40, fill="#252550")
    draw.rounded_rectangle([95, 620, 195, 660], radius=20, fill=ACCENT)
    draw.text((130, 630), "1인", fill="#000000", font=get_font(14))
    draw.text((240, 630), "2인", fill=TEXT_SUB, font=get_font(14))
    
    # Start button
    draw_button(draw, 45, 690, 300, 56, "🗺  모험 시작!", ACCENT, "#000000")
    
    # Continue button (faded)
    draw_button(draw, 95, 760, 200, 40, "이어하기", "#333355", TEXT_SUB, 20)
    
    # Labels
    draw.text((10, H-58), "S01 - 메인 진입 화면", fill="#555577", font=get_font_regular(10))
    
    img.save("/home/claude/assets/wireframes/S01_main.png")
    print("S01 created")

# ============ S02: Admin Auth ============
def create_s02():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_phone_frame(draw)
    
    # Back arrow
    draw.text((20, 60), "←", fill=TEXT, font=get_font(20))
    
    # Title
    draw.text((W//2 - 60, 120), "관리자 인증", fill=TEXT, font=get_font(20))
    draw.text((W//2 - 80, 155), "PIN 4자리를 입력하세요", fill=TEXT_SUB, font=get_font_regular(12))
    
    # PIN dots
    for i in range(4):
        cx = W//2 - 60 + i * 40
        if i < 2:
            draw.ellipse([cx-10, 210, cx+10, 230], fill=ACCENT)
        else:
            draw.ellipse([cx-10, 210, cx+10, 230], outline=TEXT_SUB, width=2)
    
    # Keypad
    keys = [["1","2","3"],["4","5","6"],["7","8","9"],["⌫","0","✓"]]
    for row_i, row in enumerate(keys):
        for col_i, key in enumerate(row):
            x = 65 + col_i * 100
            y = 320 + row_i * 90
            color = "#252550"
            if key == "✓":
                color = "#1A6B3C"
            elif key == "⌫":
                color = "#4A2030"
            draw.rounded_rectangle([x, y, x+70, y+70], radius=35, fill=color)
            f = get_font(24)
            bbox = draw.textbbox((0,0), key, font=f)
            tw = bbox[2] - bbox[0]
            draw.text((x + (70-tw)//2, y + 20), key, fill=TEXT, font=f)
    
    # Error message area
    draw_card(draw, 65, 700, 260, 40, fill="#3A1525")
    draw.text((100, 710), "⚠ PIN이 일치하지 않습니다", fill=RED, font=get_font_regular(12))
    
    draw.text((10, H-58), "S02 - 관리자 인증 화면", fill="#555577", font=get_font_regular(10))
    img.save("/home/claude/assets/wireframes/S02_admin_auth.png")
    print("S02 created")

# ============ S03: Admin Dashboard ============
def create_s03():
    img = Image.new("RGB", (W, H), "#F5F7FA")
    draw = ImageDraw.Draw(img)
    draw_phone_frame(draw)
    
    # Top bar
    draw.rectangle([0, 44, W, 100], fill="#FFFFFF")
    draw.text((20, 60), "← 게임 설정", fill="#333333", font=get_font(18))
    
    # Preset cards (horizontal scroll)
    draw.text((20, 115), "스토리 프리셋", fill="#333333", font=get_font(14))
    presets = [("🔍", "미스테리\n탐정단", "#1A237E"), ("🏴‍☠️", "해적\n보물섬", "#4E342E"),
               ("🚀", "우주\n탐험대", "#0D47A1"), ("🧙", "마법학교\n비밀", "#4A148C"),
               ("🦕", "공룡시대\n발굴단", "#33691E")]
    for i, (icon, name, color) in enumerate(presets):
        x = 15 + i * 80
        draw.rounded_rectangle([x, 140, x+72, 220], radius=12, fill=color)
        if i == 1:  # selected
            draw.rounded_rectangle([x-2, 138, x+74, 222], radius=13, outline=ACCENT, width=3)
        draw.text((x+10, 148), icon, fill=TEXT, font=get_font(20))
        lines = name.split("\n")
        for j, line in enumerate(lines):
            draw.text((x+8, 178+j*14), line, fill="#FFFFFF", font=get_font_regular(10))
    
    # Mission timeline
    draw.text((20, 240), "미션 타임라인", fill="#333333", font=get_font(14))
    draw.text((310, 242), "+ 추가", fill=BLUE, font=get_font_regular(12))
    
    missions = [
        ("🎮", "이모지 퀴즈", "미니게임 | 보통 | 60초"),
        ("🔎", "숨겨진 메모 찾기", "물건찾기 | 힌트 3단계"),
        ("🎮", "메모리 매칭", "미니게임 | 어려움 | 90초"),
        ("🔎", "비밀 쪽지 발견", "물건찾기 | 힌트 3단계"),
        ("🎮", "균형 잡기", "미니게임 | 보통 | 45초"),
        ("🎮", "암호 해독", "미니게임 | 어려움 | 120초"),
    ]
    for i, (icon, name, desc) in enumerate(missions):
        y = 270 + i * 64
        if y > 640: break
        draw.rounded_rectangle([20, y, W-20, y+56], radius=12, fill="#FFFFFF")
        # Drag handle
        draw.text((30, y+18), "≡", fill="#CCCCCC", font=get_font(18))
        # Number
        draw_icon_circle(draw, 75, y+28, 14, BLUE if icon=="🎮" else GREEN, str(i+1))
        draw.text((98, y+12), name, fill="#333333", font=get_font(13))
        draw.text((98, y+32), desc, fill="#999999", font=get_font_regular(10))
        # Delete
        draw.text((W-50, y+15), "✕", fill="#CCCCCC", font=get_font(16))
    
    # Bottom settings
    draw.rectangle([0, 660, W, 700], fill="#EEEEEE")
    draw.text((20, 670), "비밀번호:", fill="#333333", font=get_font(12))
    for i, n in enumerate(["7", "2", "4"]):
        draw.rounded_rectangle([120+i*50, 662, 158+i*50, 696], radius=8, fill="#FFFFFF", outline="#CCCCCC")
        draw.text((132+i*50, 670), n, fill="#333333", font=get_font(16))
    
    # Save button
    draw_button(draw, 20, 720, W-40, 50, "💾  설정 저장", "#2196F3", "#FFFFFF", 12)
    
    draw.text((10, H-58), "S03 - 관리자 대시보드", fill="#555577", font=get_font_regular(10))
    img.save("/home/claude/assets/wireframes/S03_admin_dashboard.png")
    print("S03 created")

# ============ S04: Story Intro ============
def create_s04():
    img = Image.new("RGB", (W, H), "#0A0A1E")
    draw = ImageDraw.Draw(img)
    draw_phone_frame(draw)
    
    # Atmospheric background gradient effect
    for y in range(100, 500):
        alpha = int(30 * (1 - abs(y - 300) / 200))
        color = f"#{alpha:02x}{alpha:02x}{alpha+20:02x}"
        draw.line([(0, y), (W, y)], fill=color)
    
    # Story card
    draw.rounded_rectangle([30, 200, W-30, 550], radius=20, fill="#0D0D30", outline="#333366", width=1)
    
    # Theme icon
    draw.text((W//2-15, 220), "🏴‍☠️", fill=TEXT, font=get_font(30))
    draw.text((W//2-60, 270), "해적 보물섬", fill=ACCENT, font=get_font(22))
    
    # Typewriter text effect
    story_lines = [
        "아빠의 서랍에서 오래된",
        "보물 지도를 발견했다!",
        "",
        "전설의 해적 '붉은 수염' 선장이",
        "이 집 어딘가에 보물을",
        "숨겨두었다는 전설...",
        "",
        "지도에 표시된 경로를 따라",
        "미션을 해결하고,",
        "보물상자의 자물쇠를 열어라!",
    ]
    y = 310
    for i, line in enumerate(story_lines):
        if i < 8:  # show typed portion
            draw.text((55, y), line, fill=TEXT if line else TEXT, font=get_font_regular(14))
        else:
            draw.text((55, y), line, fill="#333355", font=get_font_regular(14))
        if line:
            y += 24
        else:
            y += 12
    
    # Cursor blink
    draw.rectangle([55 + 14*6, y-24, 55 + 14*6 + 2, y-24+18], fill=ACCENT)
    
    # Skip button
    draw.text((W//2-25, 600), "건너뛰기", fill=TEXT_SUB, font=get_font_regular(12))
    
    # Start button (will fade in after text complete)
    draw_button(draw, 60, 680, W-120, 52, "⚓  항해 시작!", ACCENT, "#000000")
    
    draw.text((10, H-58), "S04 - 스토리 인트로 화면", fill="#555577", font=get_font_regular(10))
    img.save("/home/claude/assets/wireframes/S04_story_intro.png")
    print("S04 created")

# ============ S05: Mission Hub ============
def create_s05():
    img = Image.new("RGB", (W, H), "#0A0A1E")
    draw = ImageDraw.Draw(img)
    draw_phone_frame(draw)
    
    # Top bar
    draw.rectangle([0, 44, W, 100], fill="#111133")
    draw.text((20, 55), "🏴‍☠️", fill=TEXT, font=get_font(18))
    draw.text((50, 58), "해적 보물섬", fill=ACCENT, font=get_font(16))
    draw.text((W-80, 58), "🔊  32:15", fill=TEXT_SUB, font=get_font_regular(12))
    
    # Progress bar
    draw.text((20, 112), "진행도", fill=TEXT_SUB, font=get_font_regular(11))
    steps = 6
    completed = 3
    for i in range(steps):
        cx = 40 + i * (W-80) // (steps-1)
        if i < completed:
            draw.ellipse([cx-12, 138, cx+12, 162], fill=GREEN)
            draw.text((cx-4, 143), "✓", fill=TEXT, font=get_font(11))
        elif i == completed:
            draw.ellipse([cx-14, 136, cx+14, 164], fill=ACCENT)
            draw.text((cx-5, 142), str(i+1), fill="#000", font=get_font(13))
        else:
            draw.ellipse([cx-12, 138, cx+12, 162], outline=TEXT_SUB, width=2)
            draw.text((cx-5, 143), str(i+1), fill=TEXT_SUB, font=get_font(11))
        if i < steps-1:
            nx = 40 + (i+1) * (W-80) // (steps-1)
            color = GREEN if i < completed else "#333355"
            draw.line([(cx+14, 150), (nx-14, 150)], fill=color, width=2)
    
    # Story text
    draw_card(draw, 20, 185, W-40, 50, fill="#1A1A3E")
    draw.text((35, 198), "🗺 \"이 섬의 4번째 수수께끼를 풀어라!\"", fill=TEXT, font=get_font_regular(12))
    
    # Current mission card
    draw.rounded_rectangle([20, 260, W-20, 500], radius=20, fill="#1A1A3E", outline=ACCENT, width=2)
    draw.text((W//2-50, 278), "MISSION 4", fill=ACCENT, font=get_font(18))
    draw.line([(60, 308), (W-60, 308)], fill="#333366", width=1)
    
    # Mission type icon
    draw.rounded_rectangle([W//2-40, 325, W//2+40, 395], radius=16, fill="#252550")
    draw.text((W//2-12, 342), "🔎", fill=TEXT, font=get_font(32))
    
    draw.text((W//2-70, 415), "숨겨진 보물 쪽지 찾기", fill=TEXT, font=get_font(14))
    draw.text((W//2-60, 440), "집 안 어딘가에 숨겨진", fill=TEXT_SUB, font=get_font_regular(11))
    draw.text((W//2-55, 458), "쪽지를 찾아 정답을 입력!", fill=TEXT_SUB, font=get_font_regular(11))
    
    draw_button(draw, 80, 490, W-160, 48, "🔍  도전!", ACCENT, "#000000")
    
    # Clue collection
    draw.text((20, 560), "수집한 단서", fill=TEXT_SUB, font=get_font_regular(11))
    for i in range(3):
        x = 20 + i * 75
        draw.rounded_rectangle([x, 585, x+65, 645], radius=10, fill="#252550")
        draw.text((x+20, 598), "🔑" if i==0 else ("📜" if i==1 else "🧩"), font=get_font(20))
        draw.text((x+10, 628), f"단서 {i+1}", fill=TEXT_SUB, font=get_font_regular(9))
    # Locked clue slots
    for i in range(3, 6):
        x = 20 + i * 75
        if x + 65 > W - 20: break
        draw.rounded_rectangle([x, 585, x+65, 645], radius=10, fill="#151530", outline="#333355", width=1)
        draw.text((x+22, 605), "?", fill="#333355", font=get_font(18))
    
    draw.text((10, H-58), "S05 - 미션 허브 화면", fill="#555577", font=get_font_regular(10))
    img.save("/home/claude/assets/wireframes/S05_mission_hub.png")
    print("S05 created")

# ============ S06: Minigame Play ============
def create_s06():
    img = Image.new("RGB", (W, H), "#0A0A1E")
    draw = ImageDraw.Draw(img)
    draw_phone_frame(draw)
    
    # Timer bar
    timer_width = int(W * 0.65)
    draw.rectangle([0, 44, W, 56], fill="#1A1A2E")
    draw.rectangle([0, 44, timer_width, 56], fill="#27AE60")
    draw.text((W//2-30, 44), "0:42", fill=TEXT, font=get_font(10))
    
    # Pause button
    draw.rounded_rectangle([W-50, 62, W-18, 90], radius=8, fill="#252550")
    draw.text((W-42, 66), "⏸", fill=TEXT, font=get_font(16))
    
    # Game title
    draw.text((20, 66), "이모지 퀴즈", fill=ACCENT, font=get_font(16))
    draw.text((20, 90), "이 이모지가 뜻하는 것은?", fill=TEXT_SUB, font=get_font_regular(12))
    
    # Emoji quiz area
    draw_card(draw, 30, 120, W-60, 140, fill="#1A1A3E")
    draw.text((W//2-60, 160), "🌊 🦈 🏊", fill=TEXT, font=get_font(40))
    
    # Answer options
    options = ["죠스", "인어공주", "해운대", "니모를 찾아서"]
    colors = ["#2C3E50", "#2C3E50", "#2C3E50", "#2C3E50"]
    for i, (opt, col) in enumerate(zip(options, colors)):
        row = i // 2
        col_i = i % 2
        x = 20 + col_i * (W//2 - 10)
        y = 300 + row * 80
        draw.rounded_rectangle([x, y, x + W//2 - 30, y + 65], radius=14, fill="#252550", outline="#444488", width=1)
        f = get_font(15)
        bbox = draw.textbbox((0,0), opt, font=f)
        tw = bbox[2] - bbox[0]
        draw.text((x + (W//2-30-tw)//2, y + 22), opt, fill=TEXT, font=f)
    
    # Score area
    draw_card(draw, 20, 500, W-40, 50, fill="#1A1A3E")
    draw.text((40, 512), "문제 3/5", fill=TEXT_SUB, font=get_font_regular(12))
    draw.text((W-130, 512), "정답: 2개", fill=GREEN, font=get_font_regular(12))
    
    # ---- Clear Modal (overlaid) ----
    draw.rectangle([0, 550, W, H-34], fill="#0D0D30")
    draw.rounded_rectangle([20, 560, W-20, 790], radius=20, fill="#1A2A1A", outline=GREEN, width=2)
    draw.text((W//2-60, 580), "🎉 클리어!", fill=GREEN, font=get_font(24))
    draw.text((W//2-20, 620), "A등급", fill=ACCENT, font=get_font(18))
    
    # Clue card
    draw.rounded_rectangle([80, 660, W-80, 720], radius=12, fill="#252550")
    draw.text((100, 672), "📜 단서 획득: ", fill=TEXT_SUB, font=get_font_regular(12))
    draw.text((200, 672), "\"X 표시를 찾아라\"", fill=ACCENT, font=get_font_regular(12))
    
    draw_button(draw, 80, 735, W-160, 44, "다음 미션 →", GREEN, TEXT, 12)
    
    draw.text((10, H-58), "S06 - 미니게임 플레이 화면", fill="#555577", font=get_font_regular(10))
    img.save("/home/claude/assets/wireframes/S06_minigame.png")
    print("S06 created")

# ============ S07: Find Object ============
def create_s07():
    img = Image.new("RGB", (W, H), "#0A0A1E")
    draw = ImageDraw.Draw(img)
    draw_phone_frame(draw)
    
    # Top bar
    draw.rectangle([0, 44, W, 100], fill="#111133")
    draw.text((20, 60), "← 미션 허브", fill=TEXT_SUB, font=get_font_regular(12))
    draw.text((W//2-40, 60), "MISSION 4", fill=ACCENT, font=get_font(14))
    
    # Story text
    draw_card(draw, 20, 115, W-40, 60, fill="#1A1A3E")
    draw.text((35, 128), "🗺 이 섬에 숨겨진 지도 조각을 찾아라!", fill=TEXT, font=get_font_regular(12))
    draw.text((35, 150), "해적왕이 남긴 마지막 흔적이 이 집에...", fill=TEXT_SUB, font=get_font_regular(11))
    
    # Hint card with flip style
    draw.rounded_rectangle([30, 200, W-30, 420], radius=20, fill="#1A1A3E", outline=ACCENT, width=2)
    draw.text((W//2-30, 218), "힌트 1", fill=ACCENT, font=get_font(16))
    draw.line([(60, 248), (W-60, 248)], fill="#333366", width=1)
    
    # Hint icon
    draw.text((W//2-15, 270), "💡", fill=TEXT, font=get_font(36))
    
    # Hint text
    hint_lines = ["\"물이 차갑게 잠드는 곳을", "열어보아라.\""]
    y = 330
    for line in hint_lines:
        f = get_font_regular(16)
        bbox = draw.textbbox((0,0), line, font=f)
        tw = bbox[2] - bbox[0]
        draw.text(((W-tw)//2, y), line, fill=TEXT, font=f)
        y += 26
    
    # Hint level indicator
    for i in range(3):
        cx = W//2 - 30 + i * 30
        color = ACCENT if i == 0 else "#333355"
        draw.ellipse([cx-6, 395, cx+6, 407], fill=color)
    
    # More hint button
    draw_button(draw, 80, 445, W-160, 44, "💡 힌트 더보기 (2/3)", "#333366", TEXT_SUB, 12)
    
    # Wrong attempt feedback
    draw_card(draw, 30, 510, W-60, 50, fill="#3A1525")
    draw.text((50, 522), "❌  \"냉장고\"는 정답이 아니에요. 다시 찾아봐!", fill=RED, font=get_font_regular(11))
    
    # Answer input area
    draw.rectangle([0, 600, W, H-34], fill="#111133")
    draw.text((20, 615), "정답을 입력하세요", fill=TEXT_SUB, font=get_font_regular(12))
    draw.rounded_rectangle([20, 645, W-100, 690], radius=12, fill="#252550", outline="#444488", width=1)
    draw.text((35, 658), "정답 입력...", fill="#555577", font=get_font_regular(13))
    draw_button(draw, W-80, 645, 60, 45, "확인", GREEN, TEXT, 12)
    
    # Attempt counter
    draw.text((20, 705), "시도: 1/3", fill=TEXT_SUB, font=get_font_regular(10))
    draw.text((150, 705), "(3회 오답 시 추가 힌트 자동 공개)", fill=TEXT_SUB, font=get_font_regular(10))
    
    draw.text((10, H-58), "S07 - 물건 찾기 미션 화면", fill="#555577", font=get_font_regular(10))
    img.save("/home/claude/assets/wireframes/S07_find_object.png")
    print("S07 created")

# ============ S08: Treasure Box ============
def create_s08():
    img = Image.new("RGB", (W, H), "#0A0A1E")
    draw = ImageDraw.Draw(img)
    draw_phone_frame(draw)
    
    # Celebration header
    draw.text((W//2 - 90, 60), "🎉 모든 미션 완료! 🎉", fill=ACCENT, font=get_font(18))
    
    # Confetti dots
    import random
    random.seed(42)
    for _ in range(40):
        x = random.randint(0, W)
        y = random.randint(44, 250)
        size = random.randint(3, 8)
        color = random.choice(["#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#FB923C"])
        draw.ellipse([x, y, x+size, y+size], fill=color)
    
    # Treasure box visual
    draw.rounded_rectangle([80, 120, W-80, 320], radius=24, fill="#5D3A1A")
    draw.rounded_rectangle([90, 100, W-90, 140], radius=12, fill="#7B4B1E")
    draw.rounded_rectangle([W//2-30, 180, W//2+30, 240], radius=8, fill="#333333")
    # Lock
    draw.ellipse([W//2-15, 195, W//2+15, 225], fill=ACCENT)
    draw.text((W//2-6, 198), "🔒", fill=TEXT, font=get_font(16))
    # Box stripes
    draw.line([(100, 200), (W-100, 200)], fill="#4A2A0A", width=2)
    draw.line([(100, 260), (W-100, 260)], fill="#4A2A0A", width=2)
    
    draw.text((W//2-80, 280), "보물상자를 열어봐!", fill=ACCENT, font=get_font(14))
    
    # Lock unlock game area
    draw_card(draw, 30, 340, W-60, 200, fill="#1A1A3E")
    draw.text((W//2-60, 355), "🔓 자물쇠 해제", fill=ACCENT, font=get_font(14))
    draw.text((W//2-80, 380), "다이얼을 돌려 맞춰보세요!", fill=TEXT_SUB, font=get_font_regular(11))
    
    # 3 dials
    for i in range(3):
        cx = W//2 - 80 + i * 80
        draw.ellipse([cx-28, 410, cx+28, 466], fill="#252550", outline=ACCENT, width=2)
        draw.text((cx-8, 424), str([7,2,4][i]), fill=ACCENT, font=get_font(22))
        # Up/down arrows
        draw.text((cx-6, 395), "▲", fill=TEXT_SUB, font=get_font(10))
        draw.text((cx-6, 470), "▼", fill=TEXT_SUB, font=get_font(10))
    
    draw_button(draw, 100, 500, W-200, 30, "열기!", ACCENT, "#000000", 8)
    
    # Password reveal area
    draw.rounded_rectangle([30, 560, W-30, 740], radius=20, fill="#0D2A0D", outline=GREEN, width=2)
    draw.text((W//2-90, 575), "🎊 보물상자가 열렸어! 🎊", fill=GREEN, font=get_font(16))
    
    # Big numbers reveal
    draw.text((W//2-8, 610), "비밀번호", fill=TEXT_SUB, font=get_font_regular(11))
    numbers = ["7", "2", "4"]
    for i, n in enumerate(numbers):
        cx = W//2 - 80 + i * 80
        draw.rounded_rectangle([cx-28, 640, cx+28, 700], radius=12, fill="#1A3A1A")
        draw.text((cx-14, 646), n, fill=ACCENT, font=get_font(40))
    
    draw.text((W//2-105, 712), "👆 이 숫자로 진짜 보물상자를 열어봐!", fill=TEXT, font=get_font_regular(12))
    
    draw.text((10, H-58), "S08 - 최종 보물상자 화면", fill="#555577", font=get_font_regular(10))
    img.save("/home/claude/assets/wireframes/S08_treasure_box.png")
    print("S08 created")

# Run all
create_s01()
create_s02()
create_s03()
create_s04()
create_s05()
create_s06()
create_s07()
create_s08()
print("All wireframes created!")
