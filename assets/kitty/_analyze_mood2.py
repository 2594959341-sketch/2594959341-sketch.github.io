from PIL import Image
import numpy as np
from scipy import ndimage

names = ['mood-great.png', 'mood-ok.png', 'mood-tired.png', 'mood-over.png']
for n in names:
    a = np.array(Image.open('assets/kitty/png/' + n))
    al = a[:, :, 3]
    mask = al > 20
    h, w = a.shape[:2]
    cov = mask.sum() / float(h * w)
    # 连通块（排除极小噪点）
    lab, num = ndimage.label(mask)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, num + 1))
    big = [s for s in sizes if s > 30]
    print(f'{n:16s} coverage={cov:.2f} 连通块数(>30px)={len(big)} 最大块占比={max(sizes)/mask.sum() if mask.sum() else 0:.2f}')
