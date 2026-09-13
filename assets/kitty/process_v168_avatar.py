"""
v168: 用 c8eb1a05...jpg 抠新版头像
猫+西装+墨镜+笔记本场景。仅做 logo-64 (侧栏 36×36 显示) 与 avatar-42 (备用)。
流程：去白底 → trim → 智能选猫头区域（视觉检测后用 hard-coded bbox）→ 居中方形适配 → 2px 黑边
"""
from PIL import Image
import os, sys

SRC = r'C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a/c8eb1a05e82bafd53f6dae1b0f10462f.jpg'
OUT_DIR = r'D:/mumu-workbench/assets/kitty/png'

# 视觉估测：猫咪+西装+墨镜，主要形象居中偏左上；想抠成 36×36 头像，必须裁到头部+身体上半部
# 原图 1482x1279。从猫头开始（带耳朵+蝴蝶结）到西装胸口，约：
#   x: 580..1075 (495w)
#   y: 290..880 (590h)
# 但为了 36px 显示时更可识别，裁更紧：猫+西装上半身
CROP_BOX = (560, 270, 1085, 870)  # (left, top, right, bottom)

WHITE_THR = 245  # RGB > this treated as background

def dewhte_bg(img):
    """Flood-fill from 4 corners: turn white pixels (and near-white) connected to corners to alpha=0."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    visited = [[False] * h for _ in range(w)]
    from collections import deque
    q = deque()
    # Seed from all four edges: any white-ish pixel
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = px[x, y]
            if r >= WHITE_THR and g >= WHITE_THR and b >= WHITE_THR and not visited[x][y]:
                visited[x][y] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, a = px[x, y]
            if r >= WHITE_THR and g >= WHITE_THR and b >= WHITE_THR and not visited[x][y]:
                visited[x][y] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        # Make transparent
        px[x, y] = (r, g, b, 0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                nr, ng, nb, na = px[nx, ny]
                if nr >= WHITE_THR and ng >= WHITE_THR and nb >= WHITE_THR:
                    visited[nx][ny] = True
                    q.append((nx, ny))
    return img


def add_outline(img, color=(0, 0, 0, 255), thickness=2):
    """给非透明边缘外扩 n px 描边。"""
    from PIL import ImageDraw, ImageFilter
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    # 二值化 mask
    alpha = img.split()[-1]
    mask = alpha.point(lambda v: 255 if v > 8 else 0)
    # 扩张 N 次
    grown = mask.filter(ImageFilter.MaxFilter(2 * thickness + 1))
    outline_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(outline_layer).bitmap((0, 0), grown, fill=color)
    # outline 在 figure 之下，所以 alpha_composite
    combined = Image.alpha_composite(outline_layer, img)
    return combined


def crop_to_square_padded(img, size, bg=(255, 255, 255, 255)):
    """把不规则 alpha 图按内容 bbox 裁出，缩放到 size×size，居中,加 bg 底色。"""
    a = img.split()[-1]
    bbox = a.getbbox()
    if not bbox:
        # 全透明：fallback
        return Image.new('RGBA', (size, size), bg)
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    # 内容比例不变：取较长边为方形
    side = max(cw, ch)
    # 居中放在方形画布
    canvas = Image.new('RGBA', (side, side), (255, 255, 255, 0))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
    # 描边后再缩
    canvas = add_outline(canvas, color=(0, 0, 0, 255), thickness=2)
    # 缩放到目标大小，使用 LANCZOS
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    im0 = Image.open(SRC).convert('RGB')
    print('orig size:', im0.size)
    # 1. 裁剪预设区域
    cropped = im0.crop(CROP_BOX)
    print('cropped size:', cropped.size)
    # 2. 去白
    nobg = dewhte_bg(cropped)
    # 3. 居中方形 + 描边 + 缩放
    for size, fname in [(64, 'logo-64.png'), (42, 'avatar-42.png')]:
        out_path = os.path.join(OUT_DIR, fname)
        icon = crop_to_square_padded(nobg, size)
        # 4. 加白底（侧栏是黑边框白底圆形裁切）
        bg = Image.new('RGBA', icon.size, (255, 255, 255, 255))
        bg.alpha_composite(icon)
        bg.convert('RGB').save(out_path)
        print('saved', out_path, '->', os.path.getsize(out_path), 'bytes')
    # DEBUG 预览：把方形 256 渲染看效果
    debug = crop_to_square_padded(nobg, 256)
    debug_path = os.path.join(OUT_DIR, '_v168_avatar_preview.png')
    Image.new('RGBA', debug.size, (220, 220, 220, 255)).alpha_composite(debug).convert('RGB').save(debug_path)
    print('preview saved:', debug_path)


if __name__ == '__main__':
    main()
