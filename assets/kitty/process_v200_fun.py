"""
v200 · 首页娱乐卡换图 · 蓝头箍+手柄 kitty（新版）
- 四边各裁 4%：去掉微信看图可能的黑/白 letterbox 边（v199 右侧黑线根因）
- 去白底（v164 铁律）：白色本体透明，只留黑色描边 + 彩色
- 2px 黑色描边（v164 铁律）
- 适配到 320x320，存为 section-fun.png 替换 v199 图
纯 PIL 实现（环境无 numpy）。
"""
import os
from PIL import Image, ImageFilter

SRC = r"C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a/bd397ca1b0ef7744ebef9d32009410d6.jpg"
OUT_DIR = r"D:/mumu-workbench/assets/kitty/png"


def remove_white_bg(img_rgb, tol=14):
    px = img_rgb.load()
    w, h = img_rgb.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    thr = 255 - tol
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= thr and g >= thr and b >= thr:
                opx[x, y] = (r, g, b, 0)
            else:
                opx[x, y] = (r, g, b, 255)
    return out


def trim_alpha(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def add_outline(img, size=2, color=(0, 0, 0, 255)):
    """v164 铁律：2px 黑边。用 MaxFilter 膨胀 alpha，得到本体外部一圈黑色。"""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    alpha = img.split()[3]
    expanded = alpha.filter(ImageFilter.MaxFilter(size * 2 + 1))
    expanded_mask = expanded.point(lambda a: 255 if a > 0 else 0)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(color, mask=expanded_mask)          # 膨胀区域填黑（含本体内部，下面会被本体盖回）
    return Image.alpha_composite(out, img)         # 本体叠回：只在本体外围留黑边


def fit_size(img, tw, th, pad=0, bg=(0, 0, 0, 0)):
    w, h = img.size
    if w == 0 or h == 0:
        return img
    tw_, th_ = tw - 2 * pad, th - 2 * pad
    s = min(tw_ / w, th_ / h)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    resized = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), bg)
    canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2), resized)
    return canvas


print("=== v200 · 娱乐首页图（蓝头箍+手柄 kitty）→ section-fun.png ===")
img = Image.open(SRC).convert("RGB")
w, h = img.size
print(f"  原图: {w}x{h}")

# 1) 四边各裁 4%：干掉微信看图的黑/白 letterbox（右侧黑线根因）
m = 0.04
img = img.crop((int(w * m), int(h * m), int(w * (1 - m)), int(h * (1 - m))))
print(f"  裁边后: {img.size}")

# 2) 去白底 + 紧裁
rgba = remove_white_bg(img)
trimmed = trim_alpha(rgba)
print(f"  抠图 bbox: {trimmed.size}")

# 3) 2px 黑色描边
outlined = add_outline(trimmed, size=2)
print(f"  加描边后: {outlined.size}")

# 4) 适配到 320x320
final = fit_size(outlined, 320, 320, pad=10)
p = os.path.join(OUT_DIR, "section-fun.png")
final.save(p, "PNG", optimize=True)
print(f"  ✓ section-fun.png {final.size} {os.path.getsize(p)} B")
