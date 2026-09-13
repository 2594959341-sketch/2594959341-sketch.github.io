"""
v166 状态图重做脚本（仅处理 4 张 mood 图）
新 3 张是微信图查看器的手机截图(1200x2670 白底)，先按密度提取猫图区，再走标准管线。
tired (5043a86b) 是正方形 251x254 原图，单独处理。

管线：
  - 微信截图：按"非白行密度"找猫图区域 → 去白底 → 实心去背 → trim → 描黑边 → 居中方形 240 (zoom=0.78)
  - 原图（tired）：去手机黑条 → 自适应去白底 → 实心去背 → trim → 描黑边 → 居中方形 240 (zoom=0.78)
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage
from collections import deque

SRC_DIR = r"C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a"
OUT_DIR = r"D:/mumu-workbench/assets/kitty/png"

MOODS_SCREENSHOT = [
    ("mood-great.png", "ff7170193caa212015761741c5602b9e.jpg"),  # 抱心行走
    ("mood-ok.png",    "523dfcb09bdb63aad388de0ef5850ede.jpg"),  # 呆萌站立
    ("mood-over.png",  "f4c4d85cb5f794ebebcc72b5ed8f439b.jpg"),  # 闭眼 NO!
]
MOODS_DIRECT = [
    ("mood-tired.png", "5043a86be1d3268322ccb6db559b6537.jpg"),  # 用户已确认 OK 的旧版
]

# ---------- 提取工具 ----------

def find_phone_bars(arr):
    """去手机外黑条（仅当顶部/底部是真黑边时有效）"""
    h, w, _ = arr.shape
    is_black = (arr.mean(axis=2) < 18).all(axis=1)
    t = b = 0
    for i in range(min(60, h)):
        if is_black[i]: t = i + 1
        else: break
    for i in range(h - 1, max(h - 60, t) - 1, -1):
        if is_black[i]: b = h - 1 - i
        else: break
    return t, h - b

def find_inner_body(arr, t, b):
    h, w, _ = arr.shape
    sub = arr[t:b, :, :]
    is_white = (sub.min(axis=2) > 235).all(axis=1)
    rows = np.where(is_white)[0]
    if len(rows) == 0: return t, b
    top = t + rows[0]; bot = t + rows[-1] + 1
    top = max(t, top - 4); bot = min(b, bot + 4)
    return top, bot

def find_kitty_in_screenshot(arr):
    """白底手机截图：找密度最高的连续行段（猫图区），再裁左右"""
    h, w, _ = arr.shape
    nonwhite_per_row = (arr.min(axis=2) < 235).sum(axis=1)
    # 阈值：行内 >2.5% 列宽的非白像素算"图"
    thresh = max(15, w * 0.025)
    is_image_row = nonwhite_per_row > thresh
    # 找最长连续 run
    runs = []
    in_run = False; start = 0
    for i, v in enumerate(is_image_row):
        if v and not in_run: start = i; in_run = True
        elif not v and in_run: runs.append((start, i)); in_run = False
    if in_run: runs.append((start, len(is_image_row)))
    if not runs: return 0, h, 0, w
    top, bot = max(runs, key=lambda x: x[1] - x[0])
    # 行段内找左右
    sub = arr[top:bot, :, :]
    nonwhite_per_col = (sub.min(axis=2) < 235).sum(axis=0)
    cols = np.where(nonwhite_per_col > max(5, (bot - top) * 0.02))[0]
    if len(cols) == 0: return top, bot, 0, w
    left, right = cols[0], cols[-1] + 1
    # 留 10px 边
    pad = 10
    top = max(0, top - pad); bot = min(h, bot + pad)
    left = max(0, left - pad); right = min(w, right + pad)
    return top, bot, left, right

def remove_bg_solid(img_rgb, white_tol=14):
    """洪水填充：只剔连通到四角的真背景，保留被轮廓包住的实心白猫"""
    arr = np.array(img_rgb).astype(np.int32)
    h, w, _ = arr.shape
    if h == 0 or w == 0: return img_rgb.convert("RGBA")
    bg = arr[0, 0]
    dist = np.sqrt(((arr - bg) ** 2).astype(np.int64).sum(axis=2))
    seeds = [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]
    visited = np.zeros((h, w), dtype=bool)
    mask = np.zeros((h, w), dtype=bool)
    for sy, sx in seeds:
        if visited[sy, sx]: continue
        dq = deque([(sy, sx)])
        while dq:
            y, x = dq.popleft()
            if y < 0 or y >= h or x < 0 or x >= w: continue
            if visited[y, x]: continue
            visited[y, x] = True
            if dist[y, x] > white_tol * 3: continue
            mask[y, x] = True
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                dq.append((y + dy, x + dx))
    out = np.array(img_rgb.convert("RGBA"))
    out[mask, 3] = 0
    return Image.fromarray(out)

def trim_alpha(img_rgba, pad=2):
    bbox = img_rgba.getbbox()
    if not bbox: return img_rgba
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img_rgba.width, r + pad); b = min(img_rgba.height, b + pad)
    return img_rgba.crop((l, t, r, b))

def add_outline(img_rgba, color=(0, 0, 0, 255), width=2):
    a = np.array(img_rgba)
    alpha = a[:, :, 3]
    if not alpha.any(): return img_rgba
    struct = np.ones((3, 3), dtype=bool)
    dilated = ndimage.binary_dilation(alpha > 0, structure=struct, iterations=width).astype(np.uint8) * 255
    new_alpha = np.maximum(alpha, dilated)
    new_rgb = np.zeros_like(a[:, :, :3])
    new_rgb[:, :] = color[:3]
    out = np.zeros_like(a)
    out[:, :, :3] = np.where(alpha[:, :, None] > 0, a[:, :, :3], new_rgb)
    out[:, :, 3] = new_alpha
    return Image.fromarray(out)

def fit_square(img_rgba, size, zoom=1.0, bg=(255, 255, 255, 0)):
    canvas = Image.new("RGBA", (size, size), bg)
    iw, ih = img_rgba.size
    if iw == 0 or ih == 0: return canvas
    s = min(size / iw, size / ih) * zoom
    nw, nh = max(1, int(iw * s)), max(1, int(ih * s))
    inner = img_rgba.resize((nw, nh), Image.LANCZOS)
    canvas.paste(inner, ((size - nw) // 2, (size - nh) // 2), inner)
    return canvas

def process_screenshot(path, out_name, size=240, zoom=0.78):
    im = Image.open(os.path.join(SRC_DIR, path)).convert("RGB")
    arr = np.array(im)
    h, w, _ = arr.shape
    t, bot, l, r = find_kitty_in_screenshot(arr)
    sub = arr[t:bot, l:r, :]
    print(f"  → kitty region in {out_name}: y=[{t}-{bot}] x=[{l}-{r}] (out of {h}x{w})")
    rgba = remove_bg_solid(Image.fromarray(sub), white_tol=14)
    rgba = trim_alpha(rgba, pad=2)
    rgba = add_outline(rgba, color=(0, 0, 0, 255), width=2)
    out = fit_square(rgba, size, zoom=zoom)
    out.save(os.path.join(OUT_DIR, out_name), "PNG", optimize=True)
    report(out, out_name)

def process_direct(path, out_name, size=240, zoom=0.78):
    im = Image.open(os.path.join(SRC_DIR, path)).convert("RGB")
    arr = np.array(im)
    t, b = find_phone_bars(arr)
    t2, b2 = find_inner_body(arr, t, b)
    sub = arr[t2:b2, :, :]
    rgba = remove_bg_solid(Image.fromarray(sub), white_tol=14)
    rgba = trim_alpha(rgba, pad=2)
    rgba = add_outline(rgba, color=(0, 0, 0, 255), width=2)
    out = fit_square(rgba, size, zoom=zoom)
    out.save(os.path.join(OUT_DIR, out_name), "PNG", optimize=True)
    report(out, out_name)

def report(out, out_name):
    a = np.array(out)
    cov = a[:, :, 3].sum() / (255.0 * a.shape[0] * a.shape[1])
    ys, xs = np.where(a[:, :, 3] > 20)
    if len(ys) == 0:
        print(f"  ✗ {out_name:18s}  EMPTY")
        return
    h, w = a.shape[:2]; cy, cx = h / 2, w / 2
    offcy = (ys.mean() - cy) / h
    offcx = (xs.mean() - cx) / w
    bh = ys.max() - ys.min(); bw = xs.max() - xs.min()
    # 透明洞占猫面积比（应有内容但透明）— 检测"空心"程度
    # 计算 bbox 内的总像素 vs 非透明像素
    bbox_pixels = bh * bw
    bbox_opaque = ((a[ys.min():ys.max()+1, xs.min():xs.max()+1, 3]) > 20).sum()
    hollow = 1 - bbox_opaque / max(bbox_pixels, 1)
    print(f"  ✓ {out_name:18s}  cov={cov:.2f}  catBox={bh}x{bw}/{w} ({bw/w:.0%}×{bh/h:.0%})  offcenter=({offcy:+.2f},{offcx:+.2f})  hollow={hollow:.0%}")

print("=== 手机截图类（great/ok/over）===")
for name, src in MOODS_SCREENSHOT:
    process_screenshot(src, name, size=240, zoom=0.78)

print("\n=== 原图类（tired）===")
for name, src in MOODS_DIRECT:
    process_direct(src, name, size=240, zoom=0.78)

print("\nDONE.")