"""
v199 · 首页娱乐卡换图 · 枝枝喵戴耳机拿手柄（蓝头箍/红蝴蝶结）
- 轻微上下留白裁剪（保险去微信黑边）
- 去白底（v164 铁律）
- 2px 黑色描边（v164 铁律）
- 适配到 320x320，存为 section-fun.png 替换 v197 的航天员图
"""
import os
from PIL import Image, ImageFilter
import numpy as np

SRC = r"C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a/71d2964a5eb67cdeeba7a3767bcf527e.jpg"
OUT_DIR = r"D:/mumu-workbench/assets/kitty/png"


def remove_white_bg(img_rgb, tol=14):
    arr = np.array(img_rgb).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    is_white = (r >= 255 - tol) & (g >= 255 - tol) & (b >= 255 - tol)
    h, w = arr.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(arr, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.where(is_white, 0, 255)
    return Image.fromarray(rgba, "RGBA")


def trim_alpha(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def add_outline(img, size=2, color=(0, 0, 0, 255)):
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    alpha = img.split()[3]
    expanded = alpha.filter(ImageFilter.MaxFilter(size * 2 + 1))
    exp_arr = np.array(expanded)
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[exp_arr > 0] = [color[0], color[1], color[2], 255]
    orig_arr = np.array(img)
    mask = orig_arr[:, :, 3] > 0
    arr[mask] = orig_arr[mask]
    return Image.fromarray(arr, "RGBA")


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


print("=== v199 · 娱乐首页图（戴耳机拿手柄 kitty）→ section-fun.png ===")
img = Image.open(SRC).convert("RGB")
w, h = img.size
print(f"  原图: {w}x{h}")

# 1) 上下轻微裁剪去微信黑边（保险）
top = int(h * 0.02)
bot = int(h * 0.98)
img = img.crop((0, top, w, bot))
print(f"  裁手机壳后: {img.size}")

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