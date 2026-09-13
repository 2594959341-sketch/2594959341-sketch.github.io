"""
木木工作台 · 枝枝喵资源抠图脚本 v2
依赖：Pillow 12.x + numpy（已装在 default venv）
"""
import os
from PIL import Image
import numpy as np

SRC_DIR = r"C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a"
OUT_DIR = r"D:/mumu-workbench/assets/kitty/png"
SRC = {
    "1":  SRC_DIR + "/c36650dc18278a8bf254b0d44a8cf266.jpg",  # 像素 kitty 抱书 → 头像/侧栏
    "2":  SRC_DIR + "/2c4162fbb5b22670a6964ef7da741921.jpg",  # 西装墨镜 kitty → splash
    "3":  SRC_DIR + "/917f20ccfc1d16ddf6ffe51935b3b444.jpg",  # 综合食物
    "4":  SRC_DIR + "/fb87189dc5626b99833d16adf4545d27.jpg",  # 麦当劳
    "5":  SRC_DIR + "/97d069657d6b69b96bb454b94c1241d5.jpg",  # 综合物品
    "6":  SRC_DIR + "/cdde4fdcabd9c984bff36f6e9e2d221f.jpg",  # 钱袋
    "7":  SRC_DIR + "/7156f40e281591b1de2109a5ea9865d2.jpg",  # 早安/睡/起
    "8":  SRC_DIR + "/f57ff7033986747c396e4240d736c7f9.jpg",  # 表情 kitty 5×10
    "10": SRC_DIR + "/6e81a60b727b4f1b2c7c7c5c8c326fab.jpg",  # 蓝衣小猫 7×8
}

# ---- 工具函数 ----

def remove_white_bg(img_rgb, white_tol=12):
    """白底/近白底 → 透明"""
    arr = np.array(img_rgb).astype(np.int16)
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    is_white = (r >= 255 - white_tol) & (g >= 255 - white_tol) & (b >= 255 - white_tol)
    h, w = arr.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:,:,:3] = np.clip(arr, 0, 255).astype(np.uint8)
    rgba[:,:,3] = np.where(is_white, 0, 255)
    return Image.fromarray(rgba, "RGBA")

def trim_alpha(img_rgba):
    bbox = img_rgba.getbbox()
    if not bbox: return img_rgba
    return img_rgba.crop(bbox)

def fit_size(img, tw, th, pad=0, bg=(255,255,255,0)):
    """fit 模式缩放到 tw×th，留白"""
    w, h = img.size
    if w == 0 or h == 0: return img
    tw_, th_ = tw - 2*pad, th - 2*pad
    s = min(tw_ / w, th_ / h)
    nw, nh = max(1, int(w*s)), max(1, int(h*s))
    resized = img.resize((nw, nh), Image.LANCZOS)
    bg_mode = "RGBA" if (len(bg) >= 4 and bg[3] < 255) or img.mode == "RGBA" else "RGB"
    canvas = Image.new(bg_mode, (tw, th), bg)
    if canvas.mode == img.mode:
        canvas.paste(resized, ((tw - nw)//2, (th - nh)//2))
    elif canvas.mode == "RGB" and img.mode == "RGBA":
        canvas.paste(resized, ((tw - nw)//2, (th - nh)//2), resized)
    return canvas

def fill_size(img, tw, th, pad=0, bg=(255,255,255,255)):
    """cover 模式填满 tw×th（裁切溢出）"""
    w, h = img.size
    if w == 0 or h == 0: return img
    tw_, th_ = tw - 2*pad, th - 2*pad
    s = max(tw_ / w, th_ / h)
    nw, nh = max(1, int(w*s)), max(1, int(h*s))
    resized = img.resize((nw, nh), Image.LANCZOS)
    x = max(0, min((nw - tw_)//2, nw - tw_))
    y = max(0, min((nh - th_)//2, nh - th_))
    cropped = resized.crop((x, y, x + tw_, y + th_))
    bg_mode = "RGBA" if (len(bg) >= 4 and bg[3] < 255) or cropped.mode == "RGBA" else "RGB"
    canvas = Image.new(bg_mode, (tw, th), bg)
    if canvas.mode == cropped.mode:
        canvas.paste(cropped, (0, 0))
    elif canvas.mode == "RGB" and cropped.mode == "RGBA":
        canvas.paste(cropped, (0, 0), cropped)
    return canvas

def save(img, name, fmt="PNG"):
    p = os.path.join(OUT_DIR, name)
    os.makedirs(OUT_DIR, exist_ok=True)
    img.save(p, fmt, optimize=True)
    print(f"  ✓ {name}  {img.size}  {os.path.getsize(p)} B")

# ---- 单图：跳过手机状态栏（仅用于手机竖图） ----
def load_portrait(k, top_skip=0.18, bot_skip=0.05):
    img = Image.open(SRC[k]).convert("RGB")
    w, h = img.size
    if h > w:
        # 竖图：跳过状态栏
        y0, y1 = int(h*top_skip), int(h*(1-bot_skip))
        img = img.crop((0, y0, w, y1))
    return img

# ---- 主流程 ----

print("\n=== 1. 图1 像素 kitty 抱书 → 头像/icon/侧栏 ===")
img1 = load_portrait("1")
img1_rgba = trim_alpha(remove_white_bg(img1))
print(f"  抠图尺寸: {img1_rgba.size}")
save(fit_size(img1_rgba, 512, 512, pad=20), "icon-512.png")
save(fit_size(img1_rgba, 192, 192, pad=8), "icon-192.png")
save(fit_size(img1_rgba, 512, 512, pad=120), "icon-maskable-512.png")
save(fit_size(img1_rgba, 180, 180, pad=8), "apple-touch-180.png")
save(fit_size(img1_rgba, 42, 42, pad=2), "avatar-42.png")
save(fit_size(img1_rgba, 64, 64, pad=2), "logo-64.png")

print("\n=== 2. 图2 西装墨镜 kitty → splash 中央 ===")
img2 = load_portrait("2")
img2_rgba = trim_alpha(remove_white_bg(img2))
print(f"  抠图尺寸: {img2_rgba.size}")
save(fit_size(img2_rgba, 320, 320, pad=8), "splash-kitty.png")

print("\n=== 3. 图6 钱袋 kitty → 理财页装饰 ===")
img6 = load_portrait("6")
img6_rgba = trim_alpha(remove_white_bg(img6))
print(f"  抠图尺寸: {img6_rgba.size}")
save(fit_size(img6_rgba, 240, 240, pad=10), "finance-hero.png")

print("\n=== 4. 横向贴纸图 → banner 不抠 ===")
for k, name in [("3","banner-food.png"), ("4","banner-mc.png"),
                ("5","banner-mix.png"), ("7","banner-greet.png")]:
    img = Image.open(SRC[k]).convert("RGB")
    save(fill_size(img, 480, 240, bg=(255,255,255)), name, fmt="PNG")

def slice_grid(src_key, rows, cols, out_dir, prefix, fmt_size=80, pad=2):
    """智能纵横：宽 > 高 → cols 行数 cols×rows; 否则转置"""
    img = Image.open(SRC[src_key]).convert("RGB")
    w, h = img.size
    if w < h:  # 竖图，交换 rows/cols
        rows, cols = cols, rows
    cw, ch = w // cols, h // rows
    print(f"  原图 {w}x{h}, 网格 {cols}列×{rows}行, 每格 {cw}x{ch}")
    idx = 0
    os.makedirs(out_dir, exist_ok=True)
    for r in range(rows):
        for c in range(cols):
            cell = img.crop((c*cw, r*ch, (c+1)*cw, (r+1)*ch))
            cell = trim_alpha(remove_white_bg(cell))
            cell = fit_size(cell, fmt_size, fmt_size, pad=pad)
            cell.save(os.path.join(out_dir, f"{prefix}-{idx:02d}.png"), "PNG", optimize=True)
            idx += 1
    print(f"  共 {idx} 张")
    return idx

print("\n=== 5. 图8 表情 kitty → 5×10 切 ===")
n8 = slice_grid("8", rows=5, cols=10, out_dir=os.path.join(OUT_DIR, "mood"), prefix="mood")
print(f"  → /mood/mood-00.png 至 mood-{n8-1:02d}.png")

print("\n=== 6. 图10 蓝衣小猫 → 7×8 切 ===")
n10 = slice_grid("10", rows=7, cols=8, out_dir=os.path.join(OUT_DIR, "mood10"), prefix="mood")
print(f"  → /mood10/mood-00.png 至 mood-{n10-1:02d}.png")

print("\n=== 7. 图7 早安/起/睡 → 5×4 切 ===")
n7 = slice_grid("7", rows=5, cols=4, out_dir=os.path.join(OUT_DIR, "mood7"), prefix="greet")
print(f"  → /mood7/greet-00.png 至 greet-{n7-1:02d}.png")

print("\n=== ALL DONE ===")
