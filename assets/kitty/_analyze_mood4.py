from PIL import Image
import numpy as np
from scipy import ndimage

names = ['mood-great.png', 'mood-ok.png', 'mood-tired.png', 'mood-over.png']
for n in names:
    a = np.array(Image.open('assets/kitty/png/' + n)).astype(np.int32)
    al = a[:, :, 3]
    mask = al > 20
    # 从四条边 flood-fill 背景（透明区域），标记为"外部"
    outside = np.zeros_like(mask)
    outside[0, :] = ~mask[0, :]
    outside[-1, :] = ~mask[-1, :]
    outside[:, 0] = ~mask[:, 0]
    outside[:, -1] = ~mask[:, -1]
    lab, _ = ndimage.label(outside)
    # 与边连通的即外部
    border_label = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    ext = np.isin(lab, list(border_label))
    # 内部空洞 = 在 mask 外接框内、透明、且不被外部到达
    ys, xs = np.where(mask)
    if len(ys) == 0:
        print(n, 'EMPTY'); continue
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    interior = np.zeros_like(mask)
    interior[y0:y1+1, x0:x1+1] = True
    hole = interior & (~mask) & (~ext)
    hole_frac = hole.sum() / max(1, mask.sum())
    print(f'{n:16s} 透明空洞占猫面积={hole_frac*100:5.1f}%  (高=空心猫，看着不完整)')
