from PIL import Image
import numpy as np

names = ['mood-great.png', 'mood-ok.png', 'mood-tired.png', 'mood-over.png']
R = 120  # 46px圆(r=23) 映射到240空间半径 = 23/46*240
for n in names:
    a = np.array(Image.open('assets/kitty/png/' + n))
    al = a[:, :, 3]
    mask = al > 20
    ys, xs = np.where(mask)
    cy, cx = a.shape[0] / 2, a.shape[1] / 2
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    outside = (dist > R).sum()
    frac = outside / max(1, mask.sum())
    # 质心偏移
    my, mx = ys.mean(), xs.mean()
    print(f'{n:16s} 被圆裁掉的像素占比={frac*100:5.1f}%  质心偏移 cy={(my-cy)/a.shape[0]:+.2f} cx={(mx-cx)/a.shape[1]:+.2f}')
