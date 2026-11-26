#!/usr/bin/env python3
"""Genera los iconos de la web, de Android (launcher, adaptativo, aviso, pantalla de inicio) y de la ficha de Google Play.

Uso: python3 iconos.py <carpeta-app>
La carpeta debe tener:
  public/icon.svg           icono completo (con su fondo)
  marca/primer-plano.svg    dibujo sin fondo (se centra en la zona segura de Android)
  marca/aviso.svg           silueta blanca para la barra de notificaciones
  marca/marca.json          {"fondo": "#1D2433", "nombre": "Día Hábil", "lema": "...", "fondo_destacada": "#..."}
  marca/destacada.html      (opcional) imagen destacada de Google Play, 1024x500
Necesita Google Chrome (para dibujar los SVG) y Pillow.
"""
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw

app = os.path.abspath(sys.argv[1])
SOLO_NATIVO = '--solo-nativo' in sys.argv
marca = json.load(open(os.path.join(app, 'marca/marca.json')))
FONDO = marca['fondo']
tmp = tempfile.mkdtemp()


def render_html(html, w, h, out):
    p = os.path.join(tmp, 'r.html')
    open(p, 'w').write(html)
    subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                    '--default-background-color=00000000', f'--window-size={w},{h}', f'--screenshot={out}', 'file://' + p],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return Image.open(out).convert('RGBA')


def svg(path, size):
    html = f'<html><body style="margin:0"><img src="file://{path}" style="width:{size}px;height:{size}px;display:block"></body></html>'
    return render_html(html, size, size, os.path.join(tmp, f'{size}.png'))


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


icon = os.path.join(app, 'public/icon.svg')
fg = os.path.join(app, 'marca/primer-plano.svg')
aviso = os.path.join(app, 'marca/aviso.svg')
grande = svg(icon, 1024)
pp = svg(fg, 1024)

def dibujo_centrado(lado, escala):
    lienzo = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    t = int(lado * escala)
    d = pp.resize((t, t), Image.LANCZOS)
    lienzo.alpha_composite(d, ((lado - t) // 2, (lado - t) // 2))
    return lienzo

def con_fondo(img):
    f = Image.new('RGBA', img.size, hex2rgb(FONDO) + (255,))
    f.alpha_composite(img)
    return f

# ---- Web ----
os.makedirs(os.path.join(app, 'public/icons'), exist_ok=True)
for s in (() if SOLO_NATIVO else (192, 512)):
    grande.resize((s, s), Image.LANCZOS).save(os.path.join(app, f'public/icons/icon-{s}.png'))
if not SOLO_NATIVO: con_fondo(dibujo_centrado(512, 0.70)).save(os.path.join(app, 'public/icons/maskable-512.png'))

# ---- Google Play ----
os.makedirs(os.path.join(app, 'store'), exist_ok=True)
if not SOLO_NATIVO:
    con_fondo(dibujo_centrado(512, 0.78)).convert('RGB').save(os.path.join(app, 'store/play-icon-512.png'))
    con_fondo(dibujo_centrado(1024, 0.78)).convert('RGB').save(os.path.join(app, 'store/icon-1024.png'))
dest = os.path.join(app, 'marca/destacada.html')
if os.path.exists(dest) and not SOLO_NATIVO:
    html = open(dest).read().replace('{{PRIMER_PLANO}}', 'file://' + fg).replace('{{ICONO}}', 'file://' + icon)
    render_html(html, 1024, 500, os.path.join(tmp, 'd.png')).convert('RGB').save(os.path.join(app, 'store/play-destacada-1024x500.png'))

# ---- Android ----
res = os.path.join(app, 'android-res')
densidades = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for nombre, k in densidades.items():
    carpeta = os.path.join(res, f'mipmap-{nombre}')
    os.makedirs(carpeta, exist_ok=True)
    lado = int(48 * k)
    cuadrado = con_fondo(dibujo_centrado(lado, 0.74))
    m = Image.new('L', (lado, lado), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, lado - 1, lado - 1), radius=int(lado * 0.2), fill=255)
    legado = Image.new('RGBA', (lado, lado), (0, 0, 0, 0)); legado.paste(cuadrado, (0, 0), m)
    legado.save(os.path.join(carpeta, 'ic_launcher.png'))
    mr = Image.new('L', (lado, lado), 0); ImageDraw.Draw(mr).ellipse((0, 0, lado - 1, lado - 1), fill=255)
    redondo = Image.new('RGBA', (lado, lado), (0, 0, 0, 0)); redondo.paste(cuadrado, (0, 0), mr)
    redondo.save(os.path.join(carpeta, 'ic_launcher_round.png'))
    # Adaptativo: lienzo de 108 dp, dibujo dentro de la zona segura (66 dp).
    dibujo_centrado(int(108 * k), 0.58).save(os.path.join(carpeta, 'ic_launcher_foreground.png'))
    # Icono de aviso: 24 dp, blanco sobre transparente.
    dcar = os.path.join(res, f'drawable-{nombre}'); os.makedirs(dcar, exist_ok=True)
    svg(aviso, int(24 * k)).save(os.path.join(dcar, 'ic_stat_aviso.png'))

os.makedirs(os.path.join(res, 'mipmap-anydpi-v26'), exist_ok=True)
adapt = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
for n in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    open(os.path.join(res, 'mipmap-anydpi-v26', n), 'w').write(adapt)
os.makedirs(os.path.join(res, 'values'), exist_ok=True)
open(os.path.join(res, 'values/ic_launcher_background.xml'), 'w').write(
    f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{FONDO}</color>\n    <color name="splash_fondo">{FONDO}</color>\n</resources>\n')
# Pantalla de inicio: color de la marca con el dibujo en el centro (sin deformarse en ninguna pantalla).
os.makedirs(os.path.join(res, 'drawable-nodpi'), exist_ok=True)
dibujo_centrado(432, 0.9).save(os.path.join(res, 'drawable-nodpi/splash_logo.png'))
os.makedirs(os.path.join(res, 'drawable'), exist_ok=True)
open(os.path.join(res, 'drawable/splash.xml'), 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_fondo"/>
    <item android:width="144dp" android:height="144dp" android:gravity="center" android:drawable="@drawable/splash_logo"/>
</layer-list>
''')
# ---- iPhone: pantalla de inicio (2732 x 2732, se recorta al centro en cada pantalla) ----
os.makedirs(os.path.join(app, 'ios-res'), exist_ok=True)
lado = 2732
fondo_ios = Image.new('RGBA', (lado, lado), hex2rgb(FONDO) + (255,))
logo = pp.resize((560, 560), Image.LANCZOS)
fondo_ios.alpha_composite(logo, ((lado - 560) // 2, (lado - 560) // 2))
fondo_ios.convert('RGB').save(os.path.join(app, 'ios-res/splash-2732x2732.png'), optimize=True)

print('Iconos generados en', app)
