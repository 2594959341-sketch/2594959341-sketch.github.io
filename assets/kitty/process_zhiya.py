# 枝丫(zhiya)主题资源生成 —— 复刻 icon.svg 的绿芽形象
# 绿芽 = 白圆角方块 + 绿色(#7CB390)竖茎 + 两片旋转椭圆叶
# 生成到 assets/kitty/zhiya/ 下 7 个 PNG（版本 mumu-v167）
import os
from PIL import Image, ImageDraw

GREEN = (0x7C, 0xB3, 0x90, 255)
OUT = os.path.join(os.path.dirname(__file__), 'zhiya')
os.makedirs(OUT, exist_ok=True)

# 在 512 坐标系下的绿芽几何（来自 icon.svg）
STEM = dict(x=246, y=196, w=20, h=200, r=10)          # 竖茎
LEAF1 = dict(cx=198, cy=252, rx=48, ry=27, angle=-35)  # 左叶
LEAF2 = dict(cx=314, cy=226, rx=48, ry=27, angle=35)   # 右叶


def draw_sprout(size, rounded=True, full_bleed_bg=False):
    """在 size×size 画布上绘制绿芽。rounded=白圆角方块；full_bleed_bg=整块白底(无圆角，用于maskable/apple-touch)。"""
    s = size / 512.0
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def rr(x, y, w, h, r):
        d.rounded_rectangle([x * s, y * s, (x + w) * s, (y + h) * s], radius=r * s, fill=GREEN)

    # 背景
    if full_bleed_bg:
        d.rectangle([0, 0, size, size], fill=(255, 255, 255, 255))
    elif rounded:
        rad = 112 * s
        d.rounded_rectangle([0, 0, size, size], radius=rad, fill=(255, 255, 255, 255))
    # 否则透明背景（目前未用）

    # 竖茎
    rr(STEM['x'], STEM['y'], STEM['w'], STEM['h'], STEM['r'])

    # 叶片：在独立透明层画椭圆 -> 绕中心旋转 -> 合成
    for L in (LEAF1, LEAF2):
        leaf = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        ld = ImageDraw.Draw(leaf)
        bx0, by0 = (L['cx'] - L['rx']) * s, (L['cy'] - L['ry']) * s
        bx1, by1 = (L['cx'] + L['rx']) * s, (L['cy'] + L['ry']) * s
        ld.ellipse([bx0, by0, bx1, by1], fill=GREEN)
        leaf = leaf.rotate(L['angle'], center=(L['cx'] * s, L['cy'] * s), resample=Image.BICUBIC, expand=False)
        img = Image.alpha_composite(img, leaf)
    return img


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path, 'PNG')
    print('wrote', path, img.size)


# 1) logo-64 / avatar-42 / icon-192 / icon-512 —— 白圆角方块 + 绿芽
save(draw_sprout(64), 'logo-64.png')
save(draw_sprout(42), 'avatar-42.png')
save(draw_sprout(192), 'icon-192.png')
save(draw_sprout(512), 'icon-512.png')
# 2) maskable / apple-touch —— 整块白底(无圆角)，保证被圆形遮罩裁切后仍是白底绿芽
save(draw_sprout(512, rounded=False, full_bleed_bg=True), 'icon-maskable-512.png')
save(draw_sprout(180, rounded=False, full_bleed_bg=True), 'apple-touch-180.png')
# 3) splash —— 600x600 白圆角方块 + 绿芽（与旧版 splash-kitty.png 尺寸接近）
save(draw_sprout(600), 'splash.png')

print('zhiya resources done')
