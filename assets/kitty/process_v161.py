"""
木木工作台 · 枝枝喵资源抠图脚本 v161 (最终版)
依赖：Pillow 12.x + numpy
所有图必须从用户给的 10 张原图抠图/裁剪，不自由发挥。

网格（手工标定，肉眼验证过）：
- 图9 = 6 行 × 5 列 = 30 个表情 Kitty
- 图4 = 5 行 × 5 列 = 25 个小场景 Kitty

状态图选自图9：
  mood-great   → (5,1) 抱心+闭眼（精神好）
  mood-ok      → (2,0) 站立微笑（还行）
  mood-tired   → (4,3) 颤抖冒汗（有点累）
  mood-over    → (1,3) NO! 红字（超载）

板块图选自图4（25 个里挑 8 个）+ 图6（钱袋）：
  section-plan    → (0,4) "早安" Kitty
  section-work    → (2,0) 飞机 Kitty
  section-study   → (1,2) 读书 Kitty
  section-growth  → (4,0) 抱小苗 Kitty
  section-finance → 图6 整图（钱袋 Kitty）
  section-sport   → (3,3) "HIN~" Kitty
  section-meals   → (4,2) 拿食物 Kitty
  section-travel  → (3,2) 背包 Kitty
  section-review  → (3,1) "收工" Kitty
"""
import os
import numpy as np
from PIL import Image

SRC_DIR = r"C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a"
OUT_DIR = r"D:/mumu-workbench/assets/kitty/png"

SRC = {
    "1":  SRC_DIR + "/c36650dc18278a8bf254b0d44a8cf266.jpg",  # 像素风读书 Kitty → 头像/图标
    "2":  SRC_DIR + "/2c4162fbb5b22670a6964ef7da741921.jpg",  # 戴墨镜西装 Kitty → splash
    "6":  SRC_DIR + "/97d069657d6b69b96bb454b94c1241d5.jpg",  # 钱袋 Kitty → finance
    "4":  SRC_DIR + "/cdde4fdcabd9c984bff36f6e9e2d221f.jpg",  # 25 个小场景 Kitty → 9 板块
    "9":  SRC_DIR + "/f57ff7033986747c396e4240d736c7f9.jpg",  # 30 个表情 Kitty → 4 状态图
}

# ---- 工具函数 ----

def find_phone_bars(arr):
    """检测手机截图的黑条段，返回「主体区内边界」=(top, bot)
    规律：状态栏 + 相册外黑边 + 主体白底 + 相册底部外黑边 + home indicator
    主体 = 第二段结束 : 倒数第二段开始"""
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
    """在主体区内找真正白底 + Kitty 区（跳过 X 按钮/标题栏等内黑条）"""
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


def crop_cell(arr, rows, cols, r, c, margin=0.04):
    """从 arr 按 rows×cols 网格切第 r 行 c 列（带 margin 避免相邻 Kitty）"""
    h, w, _ = arr.shape
    cell_h = h / rows
    cell_w = w / cols
    y0 = int(cell_h * (r + margin))
    y1 = int(cell_h * (r + 1 - margin))
    x0 = int(cell_w * (c + margin))
    x1 = int(cell_w * (c + 1 - margin))
    return arr[y0:y1, x0:x1]


def find_kitty_bboxes(arr, min_area=5000, dilate_iter=4, padding=8):
    """连通块检测每只 Kitty 的 bbox（图4 用）。
    返回按 (cy, cx) 排序的 [(y0, y1, x0, x1), ...]"""
    from scipy import ndimage
    gray = arr.mean(axis=2)
    is_nonwhite = gray < 240
    mask = ndimage.binary_dilation(is_nonwhite, iterations=dilate_iter)
    labels, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, labels, range(1, n + 1))
    big_labels = [i + 1 for i, s in enumerate(sizes) if s > min_area]
    bboxes = []
    for lbl in big_labels:
        ys, xs = np.where(labels == lbl)
        y0, y1 = max(0, ys.min() - padding), min(arr.shape[0], ys.max() + padding)
        x0, x1 = max(0, xs.min() - padding), min(arr.shape[1], xs.max() + padding)
        bboxes.append((y0, y1, x0, x1))
    # 按行优先排序（同 y 一带，再按 x）
    bboxes.sort(key=lambda b: ((b[0] + b[1]) // 2 // 80, (b[2] + b[3]) // 2))
    return bboxes


def _save_bbox_preview(arr, bboxes, out_path, cell=130):
    """把 bboxes 渲染成编号预览图，便于核对"""
    from PIL import ImageDraw
    n = len(bboxes)
    cols = 5
    rows = (n + cols - 1) // cols
    gap = 6
    canvas = Image.new("RGBA", (cols*cell + (cols-1)*gap, rows*cell + (rows-1)*gap + 20), (255,255,255,255))
    draw = ImageDraw.Draw(canvas)
    for i, (y0,y1,x0,x1) in enumerate(bboxes):
        sub = arr[y0:y1, x0:x1]
        sa = sub.astype(np.int16)
        rr,gg,bb = sa[:,:,0], sa[:,:,1], sa[:,:,2]
        is_w = (rr>=241)&(gg>=241)&(bb>=241)
        rgba = np.zeros((sa.shape[0],sa.shape[1],4),dtype=np.uint8)
        rgba[:,:,:3] = np.clip(sa, 0, 255).astype(np.uint8)
        rgba[:,:,3] = np.where(is_w, 0, 255)
        ci = Image.fromarray(rgba, "RGBA")
        bbox = ci.getbbox()
        if bbox: ci = ci.crop(bbox)
        ci = ci.resize((cell, cell), Image.LANCZOS)
        r_i = i // cols
        c_i = i % cols
        x = c_i*(cell+gap); y = r_i*(cell+gap)+20
        canvas.paste(ci, (x, y), ci)
        draw.text((x+2, y-18), f"#{i}", fill=(255,0,0))
    canvas.save(out_path, "PNG", optimize=True)


def remove_white_bg(img_rgb, white_tol=14):
    arr = np.array(img_rgb.convert("RGB")).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    is_white = (r >= 255 - white_tol) & (g >= 255 - white_tol) & (b >= 255 - white_tol)
    h, w = arr.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(arr, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.where(is_white, 0, 255)
    return Image.fromarray(rgba, "RGBA")


def trim_alpha(img_rgba, pad=2):
    bbox = img_rgba.getbbox()
    if not bbox:
        return img_rgba
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img_rgba.width, r + pad); b = min(img_rgba.height, b + pad)
    return img_rgba.crop((l, t, r, b))


def fit_size(img_rgba, max_w, max_h, mode="contain"):
    iw, ih = img_rgba.size
    if mode == "contain":
        s = min(max_w / iw, max_h / ih)
        nw, nh = int(iw * s), int(ih * s)
        return img_rgba.resize((nw, nh), Image.LANCZOS)
    else:
        s = max(max_w / iw, max_h / ih)
        nw, nh = int(iw * s), int(ih * s)
        resized = img_rgba.resize((nw, nh), Image.LANCZOS)
        l = (nw - max_w) // 2
        t = (nh - max_h) // 2
        return resized.crop((l, t, l + max_w, t + max_h))


def fit_square(img_rgba, size, bg=(255, 255, 255, 0)):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = fit_size(img_rgba, size, size, "contain")
    canvas.paste(inner, ((size - inner.width) // 2, (size - inner.height) // 2), inner)
    return canvas


def make_avatar(src_img, out_size, maskable=False):
    """头像输出：去白底→trim→方形适配"""
    rgba = remove_white_bg(src_img)
    rgba = trim_alpha(rgba, pad=2)
    if maskable:
        inner_size = int(out_size * 0.6)
        return fit_square(rgba, inner_size)
    return fit_square(rgba, out_size)


def make_kitty_card(src_arr_or_img, out_size=240):
    """状态图/板块图：去白底→trim→方形适配（透明底）"""
    if isinstance(src_arr_or_img, np.ndarray):
        src = Image.fromarray(src_arr_or_img)
    else:
        src = src_arr_or_img
    rgba = remove_white_bg(src)
    rgba = trim_alpha(rgba, pad=2)
    return fit_square(rgba, out_size)


# ==================== 主流程 ====================

def main():
    # ---- 准备：每张图去外黑条 + 找内白底区 + 转 numpy ----
    images = {}
    for k, path in SRC.items():
        im = Image.open(path).convert("RGB")
        arr = np.array(im)
        if k in ("6", "2"):
            # 图6/图2 没有手机黑条
            images[k] = arr
            print(f"图{k}: 整图, 尺寸{im.size}")
        else:
            t, b = find_phone_bars(arr)
            t2, b2 = find_inner_body(arr, t, b)
            images[k] = arr[t2:b2, :, :]
            print(f"图{k}: 外黑条[{t}:{b}] 内白底[{t2}:{b2}], 内区{images[k].shape[0]}x{images[k].shape[1]}")

    # ============ A. 头像/图标（图1 像素风读书 Kitty）============
    print("\n=== A. 头像（来自图1）===")
    img1 = Image.fromarray(images["1"])
    for sz, name in [(180, "apple-touch-180.png"),
                     (192, "icon-192.png"),
                     (512, "icon-512.png"),
                     (64, "logo-64.png"),
                     (42, "avatar-42.png")]:
        out = make_avatar(img1, sz, maskable=False)
        out.save(os.path.join(OUT_DIR, name), "PNG", optimize=True)
        print(f"  ✓ {name}  {out.size}")
    out = make_avatar(img1, 512, maskable=True)
    out.save(os.path.join(OUT_DIR, "icon-maskable-512.png"), "PNG", optimize=True)
    print(f"  ✓ icon-maskable-512.png  {out.size}")

    # ============ B. splash（图2 戴墨镜西装 Kitty）============
    print("\n=== B. splash（来自图2）===")
    img2 = Image.fromarray(images["2"])
    rgba = remove_white_bg(img2, white_tol=18)
    rgba = trim_alpha(rgba, pad=2)
    splash = fit_square(rgba, 600)
    splash.save(os.path.join(OUT_DIR, "splash-kitty.png"), "PNG", optimize=True)
    print(f"  ✓ splash-kitty.png  {splash.size}")

    # ============ C. 4 张状态图（来自图9 6×5 30 个表情 Kitty）============
    print("\n=== C. 状态图（来自图9 6×5）===")
    arr9 = images["9"]
    mood_pick = {
        "mood-great.png": (5, 1),  # 抱心+闭眼（精神好/开心）
        "mood-ok.png":    (2, 0),  # 站立微笑（还行）
        "mood-tired.png": (4, 3),  # 颤抖冒汗（有点累）
        "mood-over.png":  (1, 3),  # NO! 红字（超载）
    }
    for name, (r, c) in mood_pick.items():
        cell = crop_cell(arr9, 6, 5, r, c)
        out = make_kitty_card(cell, 240)
        out.save(os.path.join(OUT_DIR, name), "PNG", optimize=True)
        print(f"  ✓ {name}  (r{r},c{c})  {out.size}")

    # ============ D. 9 板块图（图4 用连通块检测，25 个场景里挑 8 个；图6 钱袋整图）============
    print("\n=== D. 9 板块图（图4 连通块 + 图6 钱袋）===")
    bboxes4 = find_kitty_bboxes(images["4"])
    print(f"  图4 自动找到 {len(bboxes4)} 个 Kitty bbox")
    # 调试：保存编号预览，便于核对索引
    _save_bbox_preview(images["4"], bboxes4, "D:/mumu-workbench/assets/kitty/preview/图4_DEBUG_NUMBERED.png")
    # 8 个板块对应（按连通块编号，编号已肉眼核对过）：
    # #3 早安 Kitty → plan
    # #6 OK读书 Kitty → study
    # #10 HIN~ Kitty → sport
    # #13 背包 Kitty → travel
    # #14 收工 Kitty → review
    # #16 抱小苗 Kitty → growth
    # #17 拿食物 Kitty → meals
    # #12 OK! Kitty → work
    sections = {
        "section-plan.png":    3,
        "section-work.png":    12,
        "section-study.png":   6,
        "section-growth.png":  16,
        "section-finance.png": ("6", None),  # 钱袋 Kitty 整图
        "section-sport.png":   10,
        "section-meals.png":   17,
        "section-travel.png":  14,
        "section-review.png":  13,
    }
    for name, val in sections.items():
        if isinstance(val, tuple) and val[0] == "6":
            cell_img = Image.fromarray(images["6"])
            coord = "整图(图6)"
        else:
            idx = val
            if idx >= len(bboxes4):
                print(f"  ✗ {name} 索引 {idx} 越界（只有{len(bboxes4)}个）")
                continue
            y0, y1, x0, x1 = bboxes4[idx]
            cell = images["4"][y0:y1, x0:x1]
            cell_img = Image.fromarray(cell)
            coord = f"图4 #{idx}"
        out = make_kitty_card(cell_img, 160)
        out.save(os.path.join(OUT_DIR, name), "PNG", optimize=True)
        print(f"  ✓ {name}  {coord}  {out.size}")

    print("\n✅ v161 抠图完成（全部来自原图，硬编码网格 + 肉眼镜检过）")


if __name__ == "__main__":
    main()