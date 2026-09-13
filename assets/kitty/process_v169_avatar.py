"""
v169 侧栏头像(留白版)：把猫缩到画布 ~75%，四周留白边，让猫在 42px 边框内留出透气空间。
仅替换 assets/kitty/png/logo-64.png 和 avatar-42.png；其余资源(favicon/手机图标/splash)不动。
"""
from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import binary_dilation

SRC = r'C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a/c8eb1a05e82bafd53f6dae1b0f10462f.jpg'
OUT_DIR = r'D:/mumu-workbench/assets/kitty/png'

# 源图视觉估测：完整露出猫头(蝴蝶结+墨镜)+ 西装上半身
CROP = (560, 270, 1085, 870)  # (left, top, right, bottom)

def remove_white_bg(img):
    """剔白底：flood-fill 4 角，连通到 4 角的纯白剔为透明；猫身被轮廓包住故保留实心。"""
    rgb = np.array(img.convert('RGB'))
    h, w = rgb.shape[:2]
    mask = np.ones((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)

    def is_white(px):
        return px[0] > 235 and px[1] > 235 and px[2] > 235

    for sy, sx in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        if is_white(rgb[sy, sx]) and not visited[sy, sx]:
            stack = [(sy, sx)]
            while stack:
                y, x = stack.pop()
                if y < 0 or y >= h or x < 0 or x >= w or visited[y, x]:
                    continue
                if not is_white(rgb[y, x]):
                    continue
                visited[y, x] = True
                mask[y, x] = False
                stack.extend([(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)])
    rgba = np.dstack([rgb, mask.astype(np.uint8) * 255])
    return Image.fromarray(rgba, 'RGBA')

def add_outline(img, color=(0, 0, 0, 255), width=2):
    """给非透明区域描 2px 黑边"""
    arr = np.array(img)
    if arr.shape[2] == 3:
        alpha = np.ones((arr.shape[0], arr.shape[1]), dtype=bool)
    else:
        alpha = arr[:, :, 3] > 16
    grown = binary_dilation(alpha, iterations=width)
    outline = grown & ~binary_dilation(alpha, iterations=width - 1) if width > 1 else grown & ~alpha
    # 更稳：直接 grown & ~alpha 就是 width px 的环
    outline = grown & ~alpha
    out = arr.copy()
    out[outline] = color
    return Image.fromarray(out, 'RGBA')

def fit_with_margin(cat_rgba, canvas_size, fill_ratio=0.72, bg=(255, 255, 255, 255)):
    """把猫按 fill_ratio 等比缩放到画布中央，四周留白"""
    cw, ch = cat_rgba.size
    target = int(canvas_size * fill_ratio)
    scale = min(target / cw, target / ch)
    new_w = max(1, int(round(cw * scale)))
    new_h = max(1, int(round(ch * scale)))
    cat_resized = cat_rgba.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), bg)
    off_x = (canvas_size - new_w) // 2
    off_y = (canvas_size - new_h) // 2
    canvas.alpha_composite(cat_resized, (off_x, off_y))
    return canvas

def make_avatar(canvas_size, out_name):
    src = Image.open(SRC).convert('RGB')
    cropped = src.crop(CROP)
    cutout = remove_white_bg(cropped)
    cutout = add_outline(cutout, color=(0, 0, 0, 255), width=2)
    final = fit_with_margin(cutout, canvas_size, fill_ratio=0.62)
    final.save(f'{OUT_DIR}/{out_name}', 'PNG')
    print(f'{out_name}: {final.size}, mode={final.mode}')

if __name__ == '__main__':
    make_avatar(64, 'logo-64.png')
    make_avatar(42, 'avatar-42.png')
    print('done')