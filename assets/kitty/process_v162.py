"""
木木工作台 · 枝枝喵资源抠图脚本 v162
依赖：Pillow 12.x + numpy + scipy
全部图来自用户给的 13 张新原图（image#1~#13）+ 沿用 v161 钱袋图做 finance。
硬性约束：猫必须居中、原比例（不拉伸）、不引入页面 bug。

映射（按用户指定）：
  image#1  ac3f0f8e → 头像/图标/logo/splash（同一张 Kitty 抠出）
  image#2  d9e8c0b1 → mood-great
  image#3  7b12ad16 → mood-ok
  image#4  5043a86b → mood-tired
  image#5  e62ffb2f → mood-over
  image#6  ac4de100 → section-meals
  image#7  9dc0b4b0 → section-review
  image#8  cb685878 → section-travel
  image#9  1d9316e0 → section-plan（手机截图带黑边，需去黑条）
  image#10 6daa5ad2 → section-sport
  image#11 b71a201e → section-study
  image#12 40858d3f → section-work
  image#13 2ed2566e → section-growth
  finance  97d06965（旧 v161 钱袋图，用户未提供新版）

处理：去手机黑条 → 找内白底区 → 自适应去背景（白/角点色）→ trim → 居中方形适配。
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC_DIR = r"C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a"
OUT_DIR = r"D:/mumu-workbench/assets/kitty/png"

SRC = {
    "avatar":     "ac3f0f8edf92156db2b6d7b62e36870f.jpg",   # image#1
    "mood_great": "d9e8c0b19ccea2790488426a77b8be00.jpg",   # image#2
    "mood_ok":    "7b12ad1627630db4bd2efa9f3d7f94f5.jpg",   # image#3
    "mood_tired": "5043a86be1d3268322ccb6db559b6537.jpg",   # image#4
    "mood_over":  "e62ffb2f39b94bd85b81c0d20a3f334e.jpg",   # image#5
    "sec_meals":  "ac4de100910138f234e626af15826fb4.jpg",  # image#6
    "sec_review": "9dc0b4b0323d3a2403e2657d82c792a5.jpg",  # image#7
    "sec_travel": "cb68587809e447c0f1b08f4285f1d2dc.jpg",   # image#8
    "sec_plan":   "1d9316e08fb3cfc82c771306c8dd7024.jpg",   # image#9（手机截图带黑边）
    "sec_sport":  "6daa5ad29f3b07aacee8a604c2020a5a.jpg",   # image#10
    "sec_study":  "b71a201eb2e5bdd94b804a6d3b1b7438.jpg",   # image#11
    "sec_work":   "40858d3f1a725cf2d6a86b1c7dc355b3.jpg",   # image#12
    "sec_growth": "2ed2566e5fd590e588eaf2ca290f7864.jpg",  # image#13
    "sec_finance":"97d069657d6b69b96bb454b94c1241d5.jpg",   # 旧 v161 钱袋图
}


def find_phone_bars(arr):
    """检测手机截图的黑条段，返回「主体区内边界」=(top, bot)"""
    h = arr.shape[0]
    means = arr[:, :, :3].mean(axis=(1, 2))
    segs = []
    i = 0
    while i < h:
        if means[i] < 8:
            j = i
            while j < h and means[j] < 8:
                j += 1
            if j - i >= 5:
                segs.append((i, j))
            i = j
        else:
            i += 1
    if len(segs) < 2:
        return 0, h
    return segs[1][1], segs[-2][0]


def find_inner_body(arr, top, bot, white_thr=180, min_run=40):
    """在主体区内找真正白底区（跳过内黑条/标题栏）"""
    means = arr[top:bot, :, :3].mean(axis=(1, 2))
    segs = []
    i = 0
    while i < len(means):
        if means[i] > white_thr:
            j = i
            while j < len(means) and means[j] > white_thr:
                j += 1
            if j - i >= min_run:
                segs.append((top + i, top + j))
            i = j
        else:
            i += 1
    if not segs:
        return top, bot
    return segs[0][0], segs[-1][1]


def bg_color(arr):
    """取四角小块的中值作为背景色候选（更鲁棒，不假设一定白）"""
    h, w = arr.shape[:2]
    pts = []
    for (yy, xx) in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        y0, y1 = max(0, yy - 6), min(h, yy + 6)
        x0, x1 = max(0, xx - 6), min(w, xx + 6)
        pts.append(arr[y0:y1, x0:x1].reshape(-1, 3))
    allp = np.concatenate(pts, axis=0).astype(np.int16)
    # 用最常见（众数近似）的颜色：先按亮度排序取偏亮的一端更安全？
    # 直接取四角中值
    med = np.median(allp, axis=0).astype(np.int16)
    return med


def remove_bg(img_rgb, white_tol=14, color_tol=24):
    """自适应去背景：近白 或 近角点背景色 都透明"""
    arr = np.array(img_rgb.convert("RGB")).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    bg = bg_color(arr)
    is_white = (r >= 255 - white_tol) & (g >= 255 - white_tol) & (b >= 255 - white_tol)
    is_cbg = (np.abs(r - bg[0]) <= color_tol) & (np.abs(g - bg[1]) <= color_tol) & (np.abs(b - bg[2]) <= color_tol)
    is_bg = is_white | is_cbg
    h, w = arr.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(arr, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.where(is_bg, 0, 255)
    return Image.fromarray(rgba, "RGBA")


def trim_alpha(img_rgba, pad=2):
    bbox = img_rgba.getbbox()
    if not bbox:
        return img_rgba
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img_rgba.width, r + pad); b = min(img_rgba.height, b + pad)
    return img_rgba.crop((l, t, r, b))


def remove_bg_solid(img_rgb, color_tol=30):
    """洪水填充保留实心猫：从四角漫延只剔「与背景同色且连通到角」的像素，
    猫身即使与背景同为白/浅色，只要被自身轮廓包住就不会被漫延到 → 身体保留实心。"""
    arr = np.array(img_rgb.convert("RGB")).astype(np.int16)
    h, w = arr.shape[:2]
    bg = bg_color(arr)
    dist = np.sqrt(((arr - bg).astype(np.int32) ** 2).sum(axis=2))
    is_bg = dist <= color_tol
    seed = np.zeros((h, w), dtype=bool)
    for (yy, xx) in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        seed[yy, xx] = True
    cur = seed & is_bg
    while True:
        grown = ndimage.binary_dilation(cur) & is_bg
        if grown.sum() == cur.sum():
            break
        cur = grown
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(arr, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.where(cur, 0, 255)
    return Image.fromarray(rgba, "RGBA")


def add_outline(img_rgba, color=(17, 17, 17, 255), width=2):
    """给猫描一圈细边，白猫在白底上也清晰（贴纸感）。"""
    a = np.array(img_rgba)
    am = a[:, :, 3] > 0
    dilated = ndimage.binary_dilation(am, iterations=width)
    edge = dilated & ~am
    a[edge, 0] = color[0]; a[edge, 1] = color[1]; a[edge, 2] = color[2]; a[edge, 3] = color[3]
    return Image.fromarray(a, "RGBA")


def fit_square(img_rgba, size, bg=(255, 255, 255, 0), zoom=1.0):
    canvas = Image.new("RGBA", (size, size), bg)
    iw, ih = img_rgba.size
    if iw == 0 or ih == 0:
        return canvas
    s = min(size / iw, size / ih) * zoom
    nw, nh = max(1, int(iw * s)), max(1, int(ih * s))
    inner = img_rgba.resize((nw, nh), Image.LANCZOS)
    canvas.paste(inner, ((size - nw) // 2, (size - nh) // 2), inner)
    return canvas


def stats(canvas):
    """返回 (coverage, offcenter) 用于数值自检：猫占比 / 偏离中心度"""
    a = np.array(canvas)
    alpha = a[:, :, 3]
    tot = canvas.width * canvas.height
    cov = alpha.sum() / (255.0 * tot)
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return cov, 1.0
    cx, cy = (xs.min() + xs.max()) / 2.0, (ys.min() + ys.max()) / 2.0
    oc = max(abs(cx - canvas.width / 2) / (canvas.width / 2),
             abs(cy - canvas.height / 2) / (canvas.height / 2))
    return cov, oc


def process_single(path, out_size, name, zoom=1.0):
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    t, b = find_phone_bars(arr)
    t2, b2 = find_inner_body(arr, t, b)
    sub = arr[t2:b2, :, :]
    sub_img = Image.fromarray(sub)
    rgba = remove_bg(sub_img)
    rgba = trim_alpha(rgba, pad=2)
    out = fit_square(rgba, out_size, zoom=zoom)
    out.save(os.path.join(OUT_DIR, name), "PNG", optimize=True)
    cov, oc = stats(out)
    flag = ""
    if cov < 0.03:
        flag = "  ⚠️覆盖率过低(可能没抠到猫)"
    elif cov > 0.92:
        flag = "  ⚠️覆盖率过高(可能整块未去背景)"
    if oc > 0.25:
        flag += "  ⚠️偏离中心"
    print(f"  ✓ {name}  src[{t}:{b}|inner {t2}:{b2}]  size={out.size}  coverage={cov:.2f} offcenter={oc:.2f}{flag}")
    return out


def process_mood_solid(path, out_size, name, zoom=0.9):
    """状态图实心化：保留猫身实心（不被当背景抠空）+ 描黑边，留边距塞进圆框。"""
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    t, b = find_phone_bars(arr)
    t2, b2 = find_inner_body(arr, t, b)
    sub = arr[t2:b2, :, :]
    sub_img = Image.fromarray(sub)
    rgba = remove_bg_solid(sub_img)            # 实心保留（白身也不被抠空）
    rgba = add_outline(rgba, color=(17, 17, 17, 255), width=2)
    rgba = trim_alpha(rgba, pad=2)
    out = fit_square(rgba, out_size, zoom=zoom)
    out.save(os.path.join(OUT_DIR, name), "PNG", optimize=True)
    cov, oc = stats(out)
    flag = ""
    if cov < 0.03:
        flag = "  ⚠️覆盖率过低(可能没抠到猫)"
    elif cov > 0.95:
        flag = "  ⚠️覆盖率过高(可能整块未去背景)"
    if oc > 0.25:
        flag += "  ⚠️偏离中心"
    print(f"  ✓ {name}(实心)  size={out.size}  coverage={cov:.2f} offcenter={oc:.2f}{flag}")
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    # A. 头像/图标/logo 来自 image#1：实心去背（保留白身）+ 描黑边，zoom 放大
    print("=== A. 头像/图标/logo（来自 image#1，实心+描边，zoom 1.18）===")
    Z = 1.18
    av = Image.open(SRC_DIR + "/" + SRC["avatar"]).convert("RGB")
    arr = np.array(av); t, b = find_phone_bars(arr); t2, b2 = find_inner_body(arr, t, b)
    sub = Image.fromarray(arr[t2:b2, :, :])
    rgba = remove_bg_solid(sub); rgba = trim_alpha(rgba, pad=2); rgba = add_outline(rgba, width=2)
    for (sz, nm) in [(180, "apple-touch-180.png"), (192, "icon-192.png"),
                     (512, "icon-512.png"), (64, "logo-64.png"), (42, "avatar-42.png")]:
        out = fit_square(rgba, sz, zoom=Z)
        out.save(os.path.join(OUT_DIR, nm), "PNG", optimize=True)
        cov, oc = stats(out)
        print(f"  ✓ {nm}  size={out.size}  coverage={cov:.2f} offcenter={oc:.2f}")
    # maskable 安全区：内缩 0.6 居中（同样实心+描边+放大）
    inner = fit_square(rgba, int(512 * 0.6), zoom=Z)
    inner.save(os.path.join(OUT_DIR, "icon-maskable-512.png"), "PNG", optimize=True)
    print(f"  ✓ icon-maskable-512.png (安全区内缩0.6, zoom={Z}) {inner.size}")
    # splash：保留上一版墨镜西装猫（用户要求入场动画用旧版），不从 #1 重生成
    import shutil
    V161_SPLASH = os.path.join(OUT_DIR + "-v161", "splash-kitty.png")
    if os.path.exists(V161_SPLASH):
        shutil.copy(V161_SPLASH, os.path.join(OUT_DIR, "splash-kitty.png"))
        print("  ✓ splash-kitty.png 沿用 v161 旧版猫（未重新生成）")
    else:
        process_single(SRC_DIR + "/" + SRC["avatar"], 600, "splash-kitty.png")

    # B. 4 状态图（image#2~#5）
    print("\n=== B. 4 状态图（image#2~#5）===")
    # great/ok/over：原 remove_bg 把白身当背景抠空→空心猫看着不完整；改实心+描边（同头像），留边距塞进圆框
    process_mood_solid(SRC_DIR + "/" + SRC["mood_great"], 240, "mood-great.png", zoom=0.9)
    process_mood_solid(SRC_DIR + "/" + SRC["mood_ok"],    240, "mood-ok.png",    zoom=0.9)
    # tired（有点累）：用户确认看着没问题，保留原透明抠图
    process_single(SRC_DIR + "/" + SRC["mood_tired"], 240, "mood-tired.png")
    process_mood_solid(SRC_DIR + "/" + SRC["mood_over"],  240, "mood-over.png",  zoom=0.9)

    # C. 9 板块图（image#6~#13 + finance 沿用钱袋）
    print("\n=== C. 9 板块图 ===")
    process_single(SRC_DIR + "/" + SRC["sec_meals"],  240, "section-meals.png")
    process_single(SRC_DIR + "/" + SRC["sec_review"], 240, "section-review.png")
    process_single(SRC_DIR + "/" + SRC["sec_travel"], 240, "section-travel.png")
    process_single(SRC_DIR + "/" + SRC["sec_plan"],   240, "section-plan.png")
    process_single(SRC_DIR + "/" + SRC["sec_sport"],  240, "section-sport.png")
    process_single(SRC_DIR + "/" + SRC["sec_study"],  240, "section-study.png")
    process_single(SRC_DIR + "/" + SRC["sec_work"],   240, "section-work.png")
    process_single(SRC_DIR + "/" + SRC["sec_growth"], 240, "section-growth.png")
    process_single(SRC_DIR + "/" + SRC["sec_finance"],240, "section-finance.png")

    print("\n✅ v162 抠图完成（13 新图 + 钱袋，全部居中、原比例、透明底）")


if __name__ == "__main__":
    main()
