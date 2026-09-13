from PIL import Image
import numpy as np

names = ['mood-great.png', 'mood-ok.png', 'mood-tired.png', 'mood-over.png']
for n in names:
    a = np.array(Image.open('assets/kitty/png/' + n))
    al = a[:, :, 3]
    ys, xs = np.where(al > 20)
    if len(ys) == 0:
        print(n, 'EMPTY')
        continue
    h, w = a.shape[:2]
    cy, cx = h / 2, w / 2
    t, b, l, r = ys.min(), ys.max(), xs.min(), xs.max()
    my, mx = ys.mean(), xs.mean()
    d = np.sqrt((ys - cy) ** 2 + (xs - cx) ** 2).max()
    clip_d = 23.0 / 46 * w  # 46px 圆，半径23，对应240空间阈值
    print(f'{n:16s} box=[{t}-{b}]x[{l}-{r}] (of {w}) cy_off={(my-cy)/h:+.2f} cx_off={(mx-cx)/w:+.2f} maxDist={d:.0f} ->46px_maxDist={d/w*46:.1f} circleR=23 CLIP={d>clip_d}')
