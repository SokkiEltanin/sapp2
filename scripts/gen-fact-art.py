#!/usr/bin/env python3
"""Generator ikon pixel-art do ciekawostek (2026-11-25, user: "pixelarty tematyczne — mózg, sen
z księżycem czy łóżkiem — i żeby były wygenerowane").

Każdy motyw to kilka prostych kształtów (koło, elipsa, prostokąt, wielokąt, gruba linia) na
siatce 16×16. Generator sam dokłada cieniowanie (jaśniej u góry/z lewej, ciemniej u dołu/z
prawej każdej warstwy), więc wszystkie ikony mają jeden styl. Wynik: src/data/factArt.json
(wiersze + paleta), czytany przez src/utils/factArt.ts i components/daily/FactIcon.tsx.

Użycie:  python3 scripts/gen-fact-art.py [podgląd.png]
Nowa ciekawostka: dopisz motyw tutaj (albo użyj istniejącego) + id → motyw w src/utils/factArt.ts.
"""
import json, math, os, sys

N = 16
CELLS = [(x, y) for y in range(N) for x in range(N)]

# ── paleta (stonowana, jak reszta appki) ──
WHITE, GRAY, DGRAY = '#E7E5E4', '#A8A29E', '#5F5853'
RED, PINK, ORANGE = '#E58A8A', '#E7A3B5', '#E8A06A'
YELLOW, GOLD, BROWN, DBROWN = '#EBCB76', '#D9B45A', '#A07E5E', '#7A5A3E'
GREEN, MINT, CYAN, ICE = '#7DBF8E', '#8FD3B6', '#83C3CF', '#CDEBF0'
BLUE, NAVY, PURPLE, SAND = '#7FB3E0', '#4F6A9A', '#B9A6E8', '#D9B37A'


# ── kształty: zbiory komórek (x, y); środek komórki = (x+.5, y+.5) ──
def rect(x, y, w, h):
    return {(i, j) for i in range(x, x + w) for j in range(y, y + h) if 0 <= i < N and 0 <= j < N}

def ellipse(cx, cy, rx, ry):
    return {(x, y) for x, y in CELLS if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1}

def disc(cx, cy, r):
    return ellipse(cx, cy, r, r)

def ring(cx, cy, r, th=1.0):
    return disc(cx, cy, r) - disc(cx, cy, r - th)

def seg(x0, y0, x1, y1, w=1.0):
    out = set()
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy or 1e-9
    for x, y in CELLS:
        px, py = x + .5, y + .5
        t = max(0, min(1, ((px - x0) * dx + (py - y0) * dy) / L2))
        if math.hypot(px - (x0 + t * dx), py - (y0 + t * dy)) <= w / 2:
            out.add((x, y))
    return out

def poly(pts):
    out = set()
    for x, y in CELLS:
        px, py, inside = x + .5, y + .5, False
        for i in range(len(pts)):
            (ax, ay), (bx, by) = pts[i], pts[(i + 1) % len(pts)]
            if (ay > py) != (by > py) and px < ax + (py - ay) * (bx - ax) / (by - ay):
                inside = not inside
        if inside:
            out.add((x, y))
    return out

def bmp(x0, y0, rows):
    return {(x0 + i, y0 + j) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch == '#'}

def U(*shapes):
    s = set()
    for sh in shapes:
        s |= sh
    return s

def where(shape, f):
    return {(x, y) for x, y in shape if f(x + .5, y + .5)}


# ── kolory pochodne ──
def mix(hexc, to, k):
    a = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(to[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(a[i] + (b[i] - a[i]) * k):02X}' for i in range(3))

light = lambda c: mix(c, '#FFFFFF', .38)
dark = lambda c: mix(c, '#000000', .32)


class Art:
    def __init__(self):
        self.layers = []  # (komórki, kolor, cieniowanie)

    def add(self, color, shape, shade=True):
        self.layers.append((set(shape), color, shade))
        return self

    def cut(self, shape):
        for cells, _, _ in self.layers:
            cells -= shape
        return self

    def render(self):
        owner = {}
        for i, (cells, _, _) in enumerate(self.layers):
            for c in cells:
                owner[c] = i
        grid = {}
        for (x, y), i in owner.items():
            _, color, shade = self.layers[i]
            if shade:
                same = lambda dx, dy: owner.get((x + dx, y + dy)) == i
                if not same(0, -1) or not same(-1, 0):
                    color = light(color)
                elif not same(0, 1) or not same(1, 0):
                    color = dark(color)
            grid[(x, y)] = color
        letters, pal, rows = {}, {}, []
        alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
        for y in range(N):
            r = ''
            for x in range(N):
                c = grid.get((x, y))
                if not c:
                    r += '.'
                    continue
                if c not in letters:
                    letters[c] = alphabet[len(letters)]
                    pal[letters[c]] = c
                r += letters[c]
            rows.append(r)
        return {'rows': rows, 'pal': pal}


M = {}
def motif(fn):
    M[fn.__name__] = fn
    return fn


# ───────────────────────── motywy ─────────────────────────
@motif
def sleep(a):  # księżyc + Z
    a.add(YELLOW, disc(7, 9, 5.6) - disc(9.6, 7, 4.6))
    a.add(WHITE, bmp(10, 1, ['####', '..#.', '.#..', '####']), False)
    a.add(GRAY, bmp(13, 6, ['###', '.#.', '###']), False)

@motif
def bed(a):
    a.add(BROWN, U(rect(1, 4, 2, 10), rect(14, 9, 1, 5), rect(3, 12, 12, 1)))
    a.add(WHITE, rect(3, 9, 12, 3))
    a.add(BLUE, rect(7, 8, 8, 4))
    a.add(WHITE, ellipse(5.2, 8.6, 2, 1.3))
    a.add(YELLOW, disc(12, 3, 2) - disc(13, 2.3, 1.7))

@motif
def brain(a):
    a.add(PINK, U(disc(5, 6.5, 3), disc(8.5, 5.2, 3), disc(11.3, 7, 3), disc(5, 10, 3), disc(8.8, 10.6, 3), disc(11.6, 9.8, 2.6)))
    a.add(dark(PINK), U(seg(8.5, 3.5, 8.5, 13), seg(5, 7, 6.5, 8.5), seg(10.5, 7, 12, 8.5), seg(4.5, 11.5, 6, 10), seg(10, 11.5, 11.5, 12.5)), False)
    a.add(PINK, rect(9, 13, 2, 3))

@motif
def chair(a):
    a.add(BROWN, U(rect(4, 1, 2, 9), rect(4, 9, 8, 2), rect(4, 11, 1, 4), rect(11, 11, 1, 4)))
    a.add(BLUE, rect(6, 8, 6, 1))

@motif
def sun(a):
    a.add(YELLOW, disc(8, 8, 3.8))
    rays = set()
    for k in range(8):
        ang = k * math.pi / 4
        rays |= seg(8 + 5.2 * math.cos(ang), 8 + 5.2 * math.sin(ang), 8 + 7 * math.cos(ang), 8 + 7 * math.sin(ang), 1.3)
    a.add(ORANGE, rays, False)

@motif
def coffee(a):
    a.add(WHITE, ring(12, 9.5, 2.6, 1.1) - rect(0, 0, 11, 16))
    a.add(WHITE, U(rect(3, 6, 8, 6), ellipse(7, 11.5, 4, 2)))
    a.add(DBROWN, rect(4, 6, 6, 1), False)
    a.add(GRAY, rect(2, 14, 11, 1))
    a.add(GRAY, bmp(5, 1, ['#..#', '.#..#', '#..#', '.#..#']), False)

@motif
def dumbbell(a):
    a.add(GRAY, rect(4, 7, 8, 2))
    a.add(DGRAY, U(rect(2, 4, 2, 8), rect(12, 4, 2, 8)))
    a.add(DGRAY, U(rect(1, 5, 1, 6), rect(14, 5, 1, 6)))

@motif
def lungs(a):
    a.add(PINK, ellipse(4.8, 9.5, 3.3, 4.8))
    a.add(PINK, ellipse(11.2, 9.5, 3.3, 4.8))
    a.add(WHITE, U(rect(7, 1, 2, 7), seg(8, 7.5, 5.5, 10, 1.3), seg(8, 7.5, 10.5, 10, 1.3)))

@motif
def bottle(a):
    a.add(RED, U(rect(5, 6, 6, 9), rect(7, 2, 2, 4), poly([(5, 6.5), (7, 3.5), (9, 3.5), (11, 6.5)])))
    a.add(WHITE, rect(5, 9, 6, 3))
    a.add(GRAY, rect(7, 1, 2, 1))

@motif
def virus(a):
    sp = set()
    for k in range(8):
        ang = k * math.pi / 4 + math.pi / 8
        sp |= seg(8 + 4 * math.cos(ang), 8 + 4 * math.sin(ang), 8 + 6.2 * math.cos(ang), 8 + 6.2 * math.sin(ang), 1)
        sp |= disc(8 + 6.4 * math.cos(ang), 8 + 6.4 * math.sin(ang), 1.1)
    a.add(dark(GREEN), sp, False)
    a.add(GREEN, disc(8, 8, 4.6))
    a.add(dark(GREEN), U(disc(6.5, 7, .8), disc(9.5, 9.5, .9)), False)

@motif
def syringe(a):
    a.add(DGRAY, U(seg(2.5, 13.5, 4.5, 11.5, 1.3), seg(1, 11.5, 4.5, 15, 1.3)))
    a.add(WHITE, seg(4.5, 11.5, 10.5, 5.5, 3.4))
    a.add(BLUE, seg(5.5, 10.5, 8.5, 7.5, 1.3), False)
    a.add(GRAY, seg(11, 5, 14.5, 1.5, 1))

@motif
def dna(a):
    A, B, R = set(), set(), set()
    for y in range(N):
        s = math.sin((y + .5) * math.pi / 6)
        x1, x2 = 8 + 4.2 * s, 8 - 4.2 * s
        A.add((int(x1), y)); B.add((int(x2), y))
        if y % 2 == 0 and abs(x1 - x2) > 2.5:
            R |= seg(min(x1, x2) + 1, y + .5, max(x1, x2) - .2, y + .5, 1)
    a.add(GRAY, R, False)
    a.add(BLUE, A, False)
    a.add(PINK, B, False)

@motif
def pill(a):
    a.add(WHITE, seg(4.5, 11.5, 8, 8, 5))
    a.add(RED, seg(8, 8, 11.5, 4.5, 5))

@motif
def bacteria(a):
    a.add(MINT, U(seg(12.5, 5.5, 14.5, 3.5, 1), seg(14.5, 3.5, 15.5, 4, 1), seg(3, 10.5, 1.5, 12.5, 1), seg(1.5, 12.5, 1, 14.5, 1)), False)
    a.add(GREEN, seg(4, 10, 12, 5.5, 4.6))
    a.add(dark(GREEN), U(disc(6, 9, .8), disc(9, 7.5, .8), disc(10.8, 6.5, .7)), False)
    a.add(MINT, seg(9, 13, 13, 13, 2.6))

@motif
def bone(a):
    a.add(WHITE, U(seg(4.5, 11.5, 11.5, 4.5, 2.6), disc(3, 11.5, 1.7), disc(4.5, 13, 1.7), disc(11.5, 3, 1.7), disc(13, 4.5, 1.7)))

@motif
def heart(a):
    a.add(RED, U(disc(4.9, 5.6, 3.3), disc(11.1, 5.6, 3.3), poly([(1.7, 6.6), (14.3, 6.6), (8, 14.6)])))

@motif
def bricks(a):
    a.add('#C98B6B', rect(1, 3, 14, 11))
    mortar = U(rect(1, 6, 14, 1), rect(1, 9, 14, 1), rect(1, 12, 14, 1),
               rect(5, 3, 1, 3), rect(10, 3, 1, 3), rect(3, 7, 1, 2), rect(8, 7, 1, 2), rect(13, 7, 1, 2),
               rect(5, 10, 1, 2), rect(10, 10, 1, 2), rect(3, 13, 1, 1), rect(8, 13, 1, 1), rect(13, 13, 1, 1))
    a.add(GRAY, mortar, False)

def cloud_shape(dy=0):
    return U(disc(5, 10 + dy, 3), disc(8.5, 8 + dy, 4), disc(12, 10 + dy, 2.8), rect(5, 10 + dy, 7, 3))

@motif
def cloud(a):
    a.add('#CFD8E3', cloud_shape())

@motif
def raincloud(a):
    a.add('#B8C0CC', cloud_shape(-3))
    a.add(BLUE, U(seg(5, 12, 4, 14, 1), seg(8.5, 12, 7.5, 14, 1), seg(12, 12, 11, 14, 1)), False)

@motif
def phone(a):
    a.add(DGRAY, rect(4, 1, 8, 14))
    a.add('#5B7FA8', rect(5, 3, 6, 9))
    a.add(GRAY, rect(7, 13, 2, 1), False)

@motif
def web(a):
    s = set()
    for k in range(8):
        ang = k * math.pi / 4
        s |= seg(8, 8, 8 + 7.5 * math.cos(ang), 8 + 7.5 * math.sin(ang), 1)
    s |= ring(8, 8, 3, 1) | ring(8, 8, 5.8, 1)
    a.add(WHITE, s, False)
    a.add(DGRAY, disc(11.5, 4.5, 1.3))

@motif
def spring(a):
    pts = [(4.5 if i % 2 == 0 else 11.5, 2 + i * 2) for i in range(7)]
    s = set()
    for p, q in zip(pts, pts[1:]):
        s |= seg(p[0], p[1], q[0], q[1], 1.6)
    a.add(GRAY, s)

@motif
def chip(a):
    pins = set()
    for i in (5, 7, 9, 11):
        pins |= rect(i, 2, 1, 2) | rect(i, 12, 1, 2) | rect(2, i, 2, 1) | rect(12, i, 2, 1)
    a.add(GRAY, pins, False)
    a.add(DGRAY, rect(4, 4, 8, 8))
    a.add(MINT, rect(6, 6, 4, 4))

@motif
def diamond(a):
    a.add(CYAN, poly([(3.5, 6), (6, 3), (10, 3), (12.5, 6), (8, 13.5)]))
    a.add(ICE, U(rect(4, 6, 8, 1), seg(6.5, 3.5, 7.5, 6, 1), seg(9.5, 3.5, 8.5, 6, 1)), False)

@motif
def satellite(a):
    a.add(BLUE, U(rect(1, 7, 4, 3), rect(11, 7, 4, 3)))
    a.add(NAVY, U(rect(3, 7, 1, 3), rect(13, 7, 1, 3)), False)
    a.add(GOLD, rect(6, 6, 4, 5))
    a.add(GRAY, seg(8, 6, 8, 3.5, 1), False)
    a.add(WHITE, ellipse(8, 2.6, 2.4, 1.2))

def star_pts(cx, cy, r1, r2):
    return [(cx + (r1 if k % 2 == 0 else r2) * math.sin(k * math.pi / 5), cy - (r1 if k % 2 == 0 else r2) * math.cos(k * math.pi / 5)) for k in range(10)]

@motif
def star(a):
    a.add(YELLOW, poly(star_pts(8, 8.8, 7.4, 3.1)))

@motif
def planet_red(a):
    a.add('#D98A6A', disc(8, 8, 6.3))
    a.add(dark('#D98A6A'), U(disc(6, 6, 1.2), disc(10.5, 10, 1.6), disc(10, 5, .8), disc(5.5, 11, .9)), False)

@motif
def planet_gray(a):
    a.add('#B5AFA8', disc(8, 8, 6.3))
    a.add(ORANGE, where(disc(8, 8, 6.3), lambda x, y: x < 5.2), False)
    a.add(ICE, where(disc(8, 8, 6.3), lambda x, y: x > 11.2), False)
    a.add(dark('#B5AFA8'), U(disc(7.5, 6, 1.1), disc(9.5, 10.5, 1.3)), False)

@motif
def hexmirror(a):
    def hexa(cx, cy, r):
        return poly([(cx + r * math.cos(k * math.pi / 3 + math.pi / 6), cy + r * math.sin(k * math.pi / 3 + math.pi / 6)) for k in range(6)])
    for cx, cy in [(8, 8), (8, 3.6), (8, 12.4), (4.2, 5.8), (11.8, 5.8), (4.2, 10.2), (11.8, 10.2)]:
        a.add(GOLD, hexa(cx, cy, 2.45))

@motif
def moon(a):
    a.add('#D6D3D1', disc(8, 8, 6.3))
    a.add(GRAY, U(disc(6, 6, 1.5), disc(10.5, 10, 2), disc(10.5, 4.8, 1), disc(5, 11, .9)))

@motif
def wave(a):  # spokojna woda + bąbelki tlenu
    water = {(x, y) for x, y in CELLS if y + .5 >= 9 + 1.1 * math.sin((x + .5) * math.pi / 4)}
    a.add(BLUE, water)
    a.add(NAVY, {(x, y) for x, y in water if y + .5 >= 12.5 + .9 * math.sin((x + 2.5) * math.pi / 4)})
    a.add(WHITE, {(x, y) for x, y in water if (x, y - 1) not in water}, False)
    a.add(ICE, U(ring(5, 5, 1.8, 1), ring(10.5, 3, 1.4, 1), disc(8, 6.5, .7), disc(12.5, 6.5, .6)), False)

@motif
def tree(a):
    a.add(BROWN, rect(7, 9, 2, 6))
    a.add(GREEN, U(disc(8, 5.5, 4.5), disc(4.8, 8, 3), disc(11.2, 8, 3)))
    a.add(DGRAY, rect(3, 15, 10, 1))

@motif
def mushroom(a):
    a.add(WHITE, U(rect(6, 8, 4, 6), ellipse(8, 13.5, 2.6, 1.2)))
    a.add(RED, ellipse(8, 8.5, 6.5, 6) - rect(0, 9, 16, 7))
    a.add(WHITE, U(disc(5.5, 5.5, .9), disc(9.5, 4.2, 1), disc(11.5, 7, .8)), False)

@motif
def desert(a):
    a.add(YELLOW, disc(11.5, 4, 2.4))
    a.add(SAND, ellipse(4, 16, 8.5, 6))
    a.add(dark(SAND), ellipse(14, 17, 7, 4.5))

@motif
def ant(a):
    c = '#8A6A50'
    a.add(c, U(seg(6.5, 9.5, 4.5, 13.5, 1), seg(8, 9.5, 8, 13.5, 1), seg(9.5, 9.5, 11.5, 13.5, 1),
               seg(12.5, 6.5, 13.5, 3, 1), seg(11.5, 6.5, 10.5, 3, 1)), False)
    a.add(c, U(disc(3.8, 9.2, 2.2), disc(7.9, 8.8, 1.7), disc(12, 8.2, 2.3)))

@motif
def clock(a):
    a.add(WHITE, disc(8, 8, 6.5))
    a.add(DGRAY, U(ring(8, 8, 6.5, 1.1), seg(8, 8, 8, 3.8, 1.2), seg(8, 8, 11, 9.5, 1.2)), False)

@motif
def alarmclock(a):
    a.add(GRAY, U(disc(3.6, 3.6, 2), disc(12.4, 3.6, 2), seg(4.5, 13.5, 3, 15.5, 1.2), seg(11.5, 13.5, 13, 15.5, 1.2)))
    a.add(WHITE, disc(8, 9, 5.6))
    a.add(DGRAY, U(ring(8, 9, 5.6, 1), seg(8, 9, 8, 5.5, 1.1), seg(8, 9, 10.5, 10.5, 1.1)), False)

@motif
def hourglass(a):
    a.add(ICE, U(poly([(4, 2), (12, 2), (8.6, 8), (7.4, 8)]), poly([(7.4, 8), (8.6, 8), (12, 14), (4, 14)])))
    a.add(YELLOW, U(poly([(5.6, 13.6), (10.4, 13.6), (8, 10.4)]), rect(6, 4, 4, 1), seg(8, 7, 8, 12, 1)), False)
    a.add(BROWN, U(rect(3, 1, 10, 1), rect(3, 14, 10, 1)))

@motif
def icecube(a):
    a.add(ICE, poly([(8, 1.5), (14.5, 5), (8, 8.5), (1.5, 5)]), False)
    a.add(CYAN, poly([(1.5, 5), (8, 8.5), (8, 14.8), (1.5, 11.3)]), False)
    a.add(dark(CYAN), poly([(8, 8.5), (14.5, 5), (14.5, 11.3), (8, 14.8)]), False)

@motif
def battery(a):
    a.add(GRAY, U(rect(1, 5, 12, 7), rect(13, 7, 2, 3)))
    a.cut(rect(2, 6, 10, 5))
    a.add(GREEN, rect(3, 7, 6, 3))

@motif
def onion(a):
    c = '#C9A0C9'
    a.add(BROWN, U(seg(6.5, 13.5, 6, 15.5, 1), seg(8, 13.5, 8, 15.5, 1), seg(9.5, 13.5, 10, 15.5, 1)), False)
    a.add(c, U(disc(8, 9.4, 5), poly([(5.6, 6), (10.4, 6), (8, 1)])))
    a.add(light(c), U(seg(6, 7, 5.5, 12, 1), seg(10, 7, 10.5, 12, 1)), False)

@motif
def pin(a):
    a.add(RED, U(disc(8, 6, 4.6), poly([(4.3, 8), (11.7, 8), (8, 15.2)])))
    a.add(WHITE, disc(8, 6, 1.8))

@motif
def bubble(a):
    a.add(BLUE, U(ellipse(8, 7, 7.2, 5.2), poly([(3.5, 10), (7, 11.5), (2.5, 14.5)])))
    a.add(WHITE, U(rect(4, 6, 2, 2), rect(7, 6, 2, 2), rect(10, 6, 2, 2)), False)

@motif
def wifi(a):
    cone = lambda x, y: y < 13 and abs(x - 8) <= (13 - y) * 1.15
    a.add(BLUE, where(U(ring(8, 13.5, 11.5, 1.8), ring(8, 13.5, 7.8, 1.8), ring(8, 13.5, 4.2, 1.8)), cone))
    a.add(BLUE, disc(8, 13.3, 1.5))

@motif
def globe(a):
    g = disc(8, 8, 6.5)
    a.add(BLUE, g)
    a.add(GREEN, g & U(disc(5.5, 5.5, 2.3), disc(10.5, 10.5, 2.5), disc(11.5, 4.5, 1.3), disc(4.5, 11.5, 1.4)))

@motif
def qr(a):
    a.add(WHITE, rect(1, 1, 14, 14), False)
    a.add(DGRAY, bmp(2, 2, [
        '####.##.####',
        '#..#.#..#..#',
        '#..#..#.#..#',
        '####.#..####',
        '.....##.....',
        '#.##.#.##.#.',
        '.#..###..##.',
        '#.#.#..#.#.#',
        '####..#.#.#.',
        '#..#.##..#..',
        '#..#..#.##.#',
        '####.#.#..##',
    ]), False)

@motif
def server(a):
    for y in (2, 6, 10):
        a.add(DGRAY, rect(3, y, 10, 3))
    a.add(MINT, U(rect(5, 3, 1, 1), rect(5, 7, 1, 1), rect(5, 11, 1, 1)), False)
    a.add(GRAY, U(rect(8, 3, 3, 1), rect(8, 7, 3, 1), rect(8, 11, 3, 1)), False)

@motif
def sneaker(a):
    a.add(BLUE, poly([(1.5, 7.5), (6.5, 7.5), (9, 10), (14.5, 11), (14.5, 13), (1.5, 13)]))
    a.add(WHITE, rect(1, 13, 14, 2))
    a.add(WHITE, U(rect(5, 9, 1, 1), rect(7, 10, 1, 1)), False)

@motif
def smile(a):
    a.add(YELLOW, disc(8, 8, 6.6))
    a.add(DGRAY, U(rect(5, 5, 2, 2), rect(9, 5, 2, 2), where(ring(8, 8, 4.2, 1.2), lambda x, y: y > 9.3)), False)

@motif
def people(a):
    a.add(BLUE, where(ellipse(5, 13, 3.6, 4), lambda x, y: y < 15.5))
    a.add(PINK, where(ellipse(11, 13, 3.6, 4), lambda x, y: y < 15.5))
    a.add(BLUE, disc(5, 5.5, 2.4))
    a.add(PINK, disc(11, 5.5, 2.4))

@motif
def acorn(a):
    a.add(BROWN, ellipse(8, 10, 4.2, 4.6))
    a.add(DBROWN, U(where(ellipse(8, 7, 5.4, 3), lambda x, y: y < 8.2), rect(8, 2, 1, 3)))

@motif
def flask(a):
    shape = poly([(6.4, 1), (9.6, 1), (9.6, 6), (13.8, 14.5), (2.2, 14.5), (6.4, 6)])
    a.add(ICE, shape)
    a.add(GREEN, where(shape, lambda x, y: y > 9))
    a.add(GRAY, rect(6, 1, 4, 1), False)

@motif
def soap(a):
    a.add(PINK, U(rect(2, 9, 11, 5), rect(3, 8, 9, 1)))
    a.add(WHITE, U(ring(11, 4.5, 2.4, 1), ring(5.5, 4, 1.6, 1), disc(14, 8, .8)), False)

@motif
def ear(a):
    skin = '#E3B09A'
    a.add(skin, ellipse(8.5, 8, 4.8, 6.8))
    a.add(dark(skin), ellipse(9.2, 8, 2.6, 4.4), False)
    a.add(skin, ellipse(10, 8.8, 1.4, 3), False)

@motif
def window(a):
    a.add(BROWN, rect(1, 1, 14, 14))
    for x, y in [(2, 2), (9, 2), (2, 9), (9, 9)]:
        a.add(ICE, rect(x, y, 5, 5))
    a.add(WHITE, U(seg(3, 6, 5.5, 3.5, 1), seg(10, 13, 12.5, 10.5, 1)), False)

@motif
def pan(a):
    a.add(BROWN, seg(11, 6, 15, 2, 1.8))
    a.add(DGRAY, disc(7, 9, 5.2))
    a.add('#3F3A36', disc(7, 9, 3.8), False)

@motif
def burr(a):
    sp = set()
    for k in range(12):
        ang = k * math.pi / 6
        sp |= seg(8 + 3.5 * math.cos(ang), 8 + 3.5 * math.sin(ang), 8 + 7 * math.cos(ang), 8 + 7 * math.sin(ang), 1)
    a.add(dark(GREEN), sp, False)
    a.add(GREEN, disc(8, 8, 4.3))

@motif
def spoon(a):
    a.add(GRAY, U(ellipse(5, 5, 3, 3.6), seg(6.5, 7.5, 13.5, 14, 1.7)))

@motif
def solar(a):
    a.add(YELLOW, disc(13, 2.5, 2))
    p = poly([(4, 4.5), (14, 4.5), (12, 12), (2, 12)])
    a.add(NAVY, p)
    grid = set()
    for y in (7, 9):
        grid |= {(x, yy) for x, yy in p if yy == y}
    for t in (0.33, 0.66):
        grid |= seg(4 + 10 * t, 4.5, 2 + 10 * t, 12, 1) & p
    a.add(BLUE, grid, False)
    a.add(GRAY, rect(7, 12, 2, 3))

@motif
def tire(a):
    a.add('#4E4845', disc(8, 8, 6.6))
    a.add(GRAY, disc(8, 8, 3.2))
    a.add('#4E4845', disc(8, 8, 1.1), False)

@motif
def blackhole(a):
    disk = ellipse(8, 8, 7.6, 2.9) - ellipse(8, 8, 4.4, 1.3)
    a.add(ORANGE, disk)
    a.add('#0C0A09', disc(8, 8, 3.3), False)
    a.add(YELLOW, ring(8, 8, 3.9, .8), False)
    a.add(ORANGE, where(disk, lambda x, y: y > 8.6))

@motif
def volcano(a):
    c = '#B9785A'
    a.add(c, poly([(0.5, 14.5), (6, 5), (10, 5), (15.5, 14.5)]))
    a.add(dark(c), rect(6, 5, 4, 1), False)
    a.add(GRAY, U(disc(5.5, 2.5, 1.3), disc(8, 2, 1.6), disc(10.5, 2.8, 1.2)))

@motif
def rocket(a):
    a.add(ORANGE, poly([(6.4, 11), (9.6, 11), (8, 15.5)]))
    a.add(RED, U(poly([(5.5, 8), (2.8, 12.5), (5.5, 11.5)]), poly([(10.5, 8), (13.2, 12.5), (10.5, 11.5)])))
    a.add(WHITE, poly([(8, 0.5), (10.6, 4), (10.6, 11.5), (5.4, 11.5), (5.4, 4)]))
    a.add(BLUE, disc(8, 6, 1.4))

@motif
def whale(a):
    c = '#5E86B8'
    a.add(WHITE, U(seg(4, 5, 4, 3, 1), seg(4, 3, 3, 1.5, 1), seg(4, 3, 5, 1.5, 1)), False)
    a.add(c, U(ellipse(7, 9.5, 6.2, 3.6), poly([(11.5, 9), (15.5, 5.5), (14, 9.5), (15.5, 13)])))
    a.add(light(c), ellipse(6, 11.6, 4.4, 1.3) & ellipse(7, 9.5, 6.2, 3.6), False)
    a.add(WHITE, rect(3, 9, 1, 1), False)

@motif
def octopus(a):
    t = U(seg(5, 9, 2.5, 14.5, 1.6), seg(7, 9, 6, 15.5, 1.6), seg(9, 9, 10, 15.5, 1.6), seg(11, 9, 13.5, 14.5, 1.6))
    a.add(PURPLE, t)
    a.add(PURPLE, ellipse(8, 6, 4.8, 4.8))
    a.add(WHITE, U(rect(6, 6, 1, 1), rect(9, 6, 1, 1)), False)

@motif
def bug(a):
    c = '#C9B79C'
    a.add(dark(c), U(rect(4, 12, 1, 2), rect(7, 12, 1, 2), rect(10, 12, 1, 2), rect(13, 11, 1, 2)), False)
    a.add(c, U(ellipse(8.8, 9, 6, 3.5), disc(2.6, 9, 2)))
    a.add(dark(c), U(rect(6, 6, 1, 6), rect(9, 6, 1, 6), rect(12, 6, 1, 5)), False)
    a.add(DGRAY, rect(1, 8, 1, 1), False)

@motif
def fish(a):
    c = '#6F7FA0'
    a.add(GRAY, seg(5, 6, 4, 2.5, 1), False)
    a.add(YELLOW, disc(4, 1.6, 1.2))
    a.add(c, U(ellipse(8, 9, 5.4, 4), poly([(12, 9), (15.5, 5.5), (15.5, 12.5)])))
    a.add(WHITE, U(rect(5, 7, 1, 1), rect(3, 10, 1, 1), rect(4, 11, 1, 1)), False)

@motif
def amber(a):
    c = '#D9944A'
    a.add(c, U(disc(8, 10, 4.6), poly([(4.4, 8.6), (11.6, 8.6), (8, 1.5)])))
    a.add('#7A4A1E', U(rect(7, 10, 2, 1), rect(6, 9, 1, 1), rect(9, 11, 1, 1)), False)

@motif
def snowflake(a):
    c = '#DDEBF5'
    s = seg(8, 1.2, 8, 14.8, 1.2)
    for ang in (math.pi / 6, -math.pi / 6):
        s |= seg(8 - 6.8 * math.cos(ang), 8 - 6.8 * math.sin(ang), 8 + 6.8 * math.cos(ang), 8 + 6.8 * math.sin(ang), 1.2)
    for k in range(6):
        ang = k * math.pi / 3 + math.pi / 2
        bx, by = 8 + 4.6 * math.cos(ang), 8 + 4.6 * math.sin(ang)
        for d in (-1, 1):
            s |= seg(bx, by, bx + 2 * math.cos(ang + d * .9), by + 2 * math.sin(ang + d * .9), 1)
    a.add(c, s, False)

@motif
def signpost(a):
    a.add(BROWN, rect(7, 2, 2, 13))
    a.add(YELLOW, poly([(9, 3), (13, 3), (15.3, 5), (13, 7), (9, 7)]))
    a.add(WHITE, poly([(7, 8), (3, 8), (0.7, 10), (3, 12), (7, 12)]))

@motif
def bulb(a):
    a.add(YELLOW, U(disc(8, 6.4, 4.8), rect(6, 9, 4, 2)))
    a.add(GRAY, rect(6, 11, 4, 3))
    a.add(DGRAY, U(rect(6, 12, 4, 1), rect(7, 14, 2, 1)), False)
    a.add(WHITE, U(rect(5, 4, 1, 2), rect(6, 3, 1, 1)), False)

@motif
def calendar(a):
    a.add(WHITE, rect(2, 3, 12, 11))
    a.add(RED, rect(2, 3, 12, 3))
    a.add(DGRAY, U(rect(5, 2, 1, 2), rect(10, 2, 1, 2)), False)
    a.add(GRAY, U(*[rect(x, y, 2, 2) for x in (4, 7, 10) for y in (7, 10)]), False)
    a.add(RED, rect(10, 10, 2, 2), False)

@motif
def fridge(a):
    a.add(WHITE, rect(4, 1, 8, 14))
    a.add(GRAY, U(rect(4, 6, 8, 1), rect(10, 3, 1, 2), rect(10, 8, 1, 3)), False)

@motif
def washer(a):
    a.add(WHITE, rect(2, 1, 12, 14))
    a.add(GRAY, U(rect(3, 2, 4, 1), disc(11.5, 2.6, 1)), False)
    a.add(GRAY, ring(8, 9, 4.4, 1.1), False)
    a.add(BLUE, disc(8, 9, 3.3))

@motif
def monitor(a):
    a.add(DGRAY, rect(1, 2, 14, 10))
    a.add(WHITE, rect(2, 3, 12, 8), False)
    a.add(BLUE, U(rect(3, 5, 8, 1), rect(3, 7, 6, 1), rect(3, 9, 9, 1)), False)
    a.add(GRAY, U(rect(7, 12, 2, 2), rect(5, 14, 6, 1)))

@motif
def at(a):
    outer = ring(8, 8, 6.4, 1.6) - where(rect(0, 0, 16, 16), lambda x, y: x > 10 and 8.2 < y < 10.6)
    a.add(BLUE, U(outer, ring(8, 8, 2.8, 1.6), seg(10.6, 5.5, 10.6, 10, 1.5), seg(10.6, 10, 13, 10.4, 1.4)), False)

@motif
def floppy(a):
    a.add(NAVY, rect(2, 2, 12, 12) - rect(13, 2, 1, 1))
    a.add(GRAY, rect(5, 2, 6, 4))
    a.add(DGRAY, rect(9, 3, 1, 2), False)
    a.add(WHITE, rect(4, 8, 8, 5))

@motif
def key(a):
    a.add(GOLD, U(ring(4.5, 8, 3.3, 1.6), seg(7.5, 8, 14.5, 8, 1.6), rect(12, 9, 1, 2), rect(10, 9, 1, 2)))

@motif
def barcode(a):
    a.add(WHITE, rect(1, 3, 14, 10), False)
    a.add(DGRAY, U(*[rect(x, 4, w, 8) for x, w in [(2, 1), (4, 2), (7, 1), (9, 1), (11, 2), (14, 1)]]), False)


def build():
    out = {}
    for name, fn in M.items():
        a = Art()
        fn(a)
        out[name] = a.render()
    return out


def preview(art, path):
    from PIL import Image, ImageDraw
    S, cols = 8, 10
    names = list(art)
    rows = (len(names) + cols - 1) // cols
    cw, ch = N * S + 24, N * S + 40
    img = Image.new('RGB', (cols * cw, rows * ch), '#171717')
    d = ImageDraw.Draw(img)
    for i, n in enumerate(names):
        ox, oy = (i % cols) * cw + 12, (i // cols) * ch + 8
        a = art[n]
        for y, r in enumerate(a['rows']):
            for x, c in enumerate(r):
                if c != '.':
                    d.rectangle([ox + x * S, oy + y * S, ox + (x + 1) * S - 1, oy + (y + 1) * S - 1], fill=a['pal'][c])
        d.text((ox, oy + N * S + 6), n, fill='#A8A29E')
    img.save(path)


if __name__ == '__main__':
    art = build()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, 'src', 'data', 'factArt.json'), 'w', encoding='utf-8') as f:
        json.dump(art, f, ensure_ascii=False, separators=(',', ':'))
    if len(sys.argv) > 1:
        preview(art, sys.argv[1])
    print(f'{len(art)} motywów')
