"""
木木工作台 · v171 统一头像/图标抠图脚本
源图：c8eb1a05...jpg（戴墨镜西装 Kitty，无水印，白底）
目标：把 v162 时代生成的 logo-64/avatar-42/icon-192/512/icon-maskable-512/apple-touch-180
     全部换成这张新猫（与 v167 时期的"v167 头像"同一只猫，但 v167 头像右下角有「豆包AI」水印）。
约束：
  - 满画布 (zoom ≈ 0.95，留 ~2px 给描边)
  - 透明底 (PNG RGBA) → 容器圆角不被白方块遮
  - 实心 (flood-fill 4 角剔背景，猫身被轮廓包保留)
  - 2px 黑边 (白猫在白底也清晰)
  - maskable 走安全区 (画布 80% 内居中)
  - splash 状态图 板块图 全部不动 (用户多次明确"其他别动")
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = r"C:/Users/86175/Documents/xwechat_files/wxid_aj1kslumhdih21_4171/temp/RWTemp/2026-08/c2838ba091487c0bd640ec393445236a/c8eb1a05e82bafd53f6dae1b0f10462f.jpg"
OUT_DIR = r"D:/mumu-workbench/assets/kitty/png"


def bg_color(arr):
    """取四角小块的中值作为背景色候选（更鲁棒，不假设一定白）"""
    h, w = arr.shape[:2]
    pts = []
    for (yy, xx) in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        y0, y1 = max(0, yy - 6), min(h, yy + 6)
        x0, x1 = max(0, xx - 6), min(w, xx + 6)
        pts.append(arr[y0:y1, x0:x1].reshape(-1, 3))
    allp = np.concatenate(pts, axis=0).astype(np.int16)
    return np.median(allp, axis=0).astype(np.int16)


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
    """给猫描一圈细边，白猫在白底上也清晰。"""
    a = np.array(img_rgba)
    am = a[:, :, 3] > 0
    dilated = ndimage.binary_dilation(am, iterations=width)
    edge = dilated & ~am
    a[edge, 0] = color[0]; a[edge, 1] = color[1]; a[edge, 2] = color[2]; a[edge, 3] = color[3]
    return Image.fromarray(a, "RGBA")


def trim_alpha(img_rgba, pad=2):
    bbox = img_rgba.getbbox()
    if not bbox:
        return img_rgba
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img_rgba.width, r + pad); b = min(img_rgba.height, b + pad)
    return img_rgba.crop((l, t, r, b))


def fit_square(img_rgba, size, zoom=1.0, bg=(0, 0, 0, 0)):
    """居中方形适配, 透明底"""
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
    a = np.array(canvas)
    alpha = a[:, :, 3]
    tot = canvas.width * canvas.height
    cov = alpha.sum() / (255.0 * tot)
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return cov, 1.0, 0, 0
    cx, cy = (xs.min() + xs.max()) / 2.0, (ys.min() + ys.max()) / 2.0
    oc = max(abs(cx - canvas.width / 2) / (canvas.width / 2),
             abs(cy - canvas.height / 2) / (canvas.height / 2))
    bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    return cov, oc, bw, bh


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"=== 源图: {SRC} ===")
    im = Image.open(SRC).convert("RGB")
    print(f"  源尺寸: {im.size}")
    rgba = remove_bg_solid(im, color_tol=30)
    rgba = add_outline(rgba, color=(17, 17, 17, 255), width=2)
    rgba = trim_alpha(rgba, pad=2)
    print(f"  trim 后尺寸: {rgba.size}")

    # 侧栏头像 (zoom=0.95 留 ~2px 给黑边)
    print("\n=== 侧栏头像 (满画布) ===")
    for (sz, nm, zm) in [(64, "logo-64.png", 0.95),
                         (42, "avatar-42.png", 0.95)]:
        out = fit_square(rgba, sz, zoom=zm)
        out.save(os.path.join(OUT_DIR, nm), "PNG", optimize=True)
        cov, oc, bw, bh = stats(out)
        print(f"  ✓ {nm}  size={out.size}  content={bw}x{bh}  coverage={cov:.2f} offcenter={oc:.2f}")

    # 手机 APP 图标 (zoom=0.92 留 2-3px)
    print("\n=== 手机 APP 图标 (PWA 类) ===")
    for (sz, nm, zm) in [(180, "apple-touch-180.png", 0.92),
                         (192, "icon-192.png", 0.92),
                         (512, "icon-512.png", 0.92)]:
        out = fit_square(rgba, sz, zoom=zm)
        out.save(os.path.join(OUT_DIR, nm), "PNG", optimize=True)
        cov, oc, bw, bh = stats(out)
        print(f"  ✓ {nm}  size={out.size}  content={bw}x{bh}  coverage={cov:.2f} offcenter={oc:.2f}")

    # maskable 走安全区 (画布 80% 内居中, 防被各种遮罩裁切)
    print("\n=== maskable 512 (安全区 80%) ===")
    out = fit_square(rgba, 512, zoom=0.78)
    out.save(os.path.join(OUT_DIR, "icon-maskable-512.png"), "PNG", optimize=True)
    cov, oc, bw, bh = stats(out)
    print(f"  ✓ icon-maskable-512.png  size={out.size}  content={bw}x{bh}  coverage={cov:.2f} offcenter={oc:.2f}")

    print("\n=== 未改动 (splash/状态图/板块图) ===")
    print("  - splash-kitty.png (v167 状态图那只)")
    print("  - mood-great/ok/tired/over.png")
    print("  - section-plan/work/study/growth/finance/sport/meals/travel/review.png")


if __name__ == "__main__":
    main()
