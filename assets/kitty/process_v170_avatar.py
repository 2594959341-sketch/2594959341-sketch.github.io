"""
v170 头像修复：
1) 用 v167 (e1bd6d4) 的 logo-64/avatar-42 作为基准（完整猫头+身体，正确取景），
   仅去掉右下角「豆包AI」水印字。
2) 白底方块改为透明底，避免遮住侧栏头像框的圆角（修复四角断裂）。

做法：
- 载入 v167 png（可能 RGBA 或 RGB）
- 检测右下角「豆包AI」文字区域：在 bottom-right 象限里找与猫主体分离的
  小连通块（文字），把该区域像素设回背景（透明或白）。
- 再把整张图的背景（与四角连通的近白像素）变透明，避免圆角被白方块遮住。
- 缩到 64 / 42 输出。
"""
from PIL import Image
import numpy as np
from scipy import ndimage

REF64  = r'D:/mumu-workbench/assets/kitty/png/_v167_ref.png'
REF42  = r'D:/mumu-workbench/assets/kitty/png/_v167_ref42.png'
OUT64  = r'D:/mumu-workbench/assets/kitty/png/logo-64.png'
OUT42  = r'D:/mumu-workbench/assets/kitty/png/avatar-42.png'

def load_rgba(path):
    im = Image.open(path).convert('RGBA')
    return np.array(im)

def is_white(px, th=235):
    return px[0] > th and px[1] > th and px[2] > th

def make_bg_transparent(rgba):
    """把与四角连通的近白背景变为透明；猫身（被轮廓包住）保留实心。"""
    h, w = rgba.shape[:2]
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    mask = np.ones((h, w), dtype=bool)          # True = 保留(不透明)
    visited = np.zeros((h, w), dtype=bool)
    for sy, sx in [(0,0),(0,w-1),(h-1,0),(h-1,w-1)]:
        if is_white(rgb[sy,sx]) and alpha[sy,sx] > 16 and not visited[sy,sx]:
            stack=[(sy,sx)]
            while stack:
                y,x=stack.pop()
                if y<0 or y>=h or x<0 or x>=w or visited[y,x]: continue
                if not (is_white(rgb[y,x]) and alpha[y,x]>16): continue
                visited[y,x]=True
                mask[y,x]=False
                stack.extend([(y+1,x),(y-1,x),(y,x+1),(y,x-1)])
    rgba[:,:,3] = np.where(mask, rgba[:,:,3], 0)
    return rgba

def remove_watermark(rgba):
    """在右下角象限找与猫主体分离的彩色/深色小连通块（豆包AI 字），清成透明。"""
    h, w = rgba.shape[:2]
    alpha = rgba[:, :, 3]
    fg = alpha > 16
    # 只搜 bottom-right 象限（字在右下角）
    y0, x0 = int(h*0.45), int(w*0.45)
    region = fg.copy()
    region[:y0, :] = False
    region[:, :x0] = False
    # 连通块
    lbl, n = ndimage.label(region)
    out = rgba.copy()
    removed = 0
    for i in range(1, n+1):
        comp = (lbl == i)
        ys, xs = np.where(comp)
        if len(xs) == 0: continue
        bb_h = ys.max()-ys.min()+1
        bb_w = xs.max()-xs.min()+1
        area = comp.sum()
        # 文字块特征：面积不大、且明显小于整只猫（猫主体通常 > 30% 图像面积）
        if area < (h*w)*0.25:
            out[comp, 3] = 0
            removed += 1
            print(f'  removed watermark component: bbox=({xs.min()},{ys.min()})-({xs.max()},{ys.max()}) area={area}')
    print(f'  total removed components: {removed}')
    return out

def process(ref_path, out_path, size):
    rgba = load_rgba(ref_path)
    print(f'[{ref_path}] size={rgba.shape}')
    rgba = remove_watermark(rgba)
    rgba = make_bg_transparent(rgba)
    im = Image.fromarray(rgba, 'RGBA').resize((size, size), Image.LANCZOS)
    im.save(out_path, 'PNG')
    print(f'  -> saved {out_path} ({size}x{size})')

if __name__ == '__main__':
    process(REF64, OUT64, 64)
    process(REF42, OUT42, 42)
    print('done')
