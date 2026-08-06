"""PDF chart flowables built directly on reportlab primitives.

No external rasterisation is required: each chart is a ``Flowable`` that
draws itself on the PDF canvas, so reports render deterministically and stay
small. Data comes from the same declarative chart specs used by the frontend.
"""

from __future__ import annotations

import math

from reportlab.lib import colors
from reportlab.platypus import Flowable

ACCENT_A = colors.HexColor("#7c3aed")
ACCENT_B = colors.HexColor("#06b6d4")
GRID = colors.HexColor("#e5e7eb")
MUTED = colors.HexColor("#6b7280")
INK = colors.HexColor("#1f2937")
WHITE = colors.white

PALETTE = [
    colors.HexColor("#7c3aed"), colors.HexColor("#06b6d4"),
    colors.HexColor("#f59e0b"), colors.HexColor("#10b981"),
    colors.HexColor("#ec4899"), colors.HexColor("#6366f1"),
    colors.HexColor("#14b8a6"), colors.HexColor("#f43f5e"),
    colors.HexColor("#8b5cf6"), colors.HexColor("#0ea5e9"),
]


def _fmt(v: float, digits: int = 1) -> str:
    av = abs(v)
    if av >= 1_000_000:
        return f"{v / 1_000_000:.1f}M"
    if av >= 1_000:
        return f"{v / 1_000:.1f}k"
    if av >= 100:
        return f"{v:.0f}"
    return f"{v:.{digits}f}"


def _val_or_zero(d: dict, key: str) -> float:
    try:
        return float(d.get(key, 0) or 0)
    except (TypeError, ValueError):
        return 0.0


class _ChartFlowable(Flowable):
    def __init__(self, chart: dict, width: float = 400, height: float = 150):
        super().__init__()
        self.chart = chart
        self.chart_w = width
        self.chart_h = height

    def wrap(self, availWidth, availHeight):
        self.width = min(self.chart_w, availWidth)
        self.height = min(self.chart_h, availHeight)
        return self.width, self.height

    def _font(self, size: float = 8, bold: bool = False):
        self.canv.setFont("Helvetica-Bold" if bold else "Helvetica", size)

    def _alpha(self, value: float):
        self.canv.setFillAlpha(value)
        self.canv.setStrokeAlpha(value)

    def _title(self):
        c = self.canv
        c.saveState()
        c.setFillColor(INK)
        self._font(10, bold=True)
        c.drawString(0, self.height - 12, self.chart.get("title", ""))
        c.restoreState()

    def _gridlines(self, left, top, right, bottom, vmax, n=4, show=True):
        c = self.canv
        out = []
        c.saveState()
        c.setStrokeColor(GRID)
        c.setLineWidth(0.4)
        c.setFillColor(MUTED)
        self._font(7)
        for i in range(n + 1):
            frac = i / n
            y = top + (bottom - top) * (1 - frac)
            c.line(left, y, right, y)
            if show:
                c.drawString(left - 6, y - 2, _fmt(frac * vmax))
        c.restoreState()
        return out

    def _x_label(self, text: str, x: float, y: float, center: bool = True):
        c = self.canv
        c.saveState()
        c.setFillColor(MUTED)
        self._font(7)
        if center:
            c.drawCentredString(x, y, str(text)[:14])
        else:
            c.drawString(x, y, str(text)[:14])
        c.restoreState()


class BarChart(_ChartFlowable):
    def draw(self):
        c = self.canv
        self._title()
        data = self.chart.get("data") or []
        if not data:
            return
        x_key, y_key = self.chart["x"], self.chart["y"]
        left, right = 30, self.width - 8
        top, bottom = self.height - 18, self.height - 34
        values = [_val_or_zero(d, y_key) for d in data]
        vmax = max(values) or 1
        self._gridlines(left, top, right, bottom, vmax)
        bw = (right - left) / len(data)
        c.saveState()
        for i, d in enumerate(data):
            v = values[i]
            bh = max(v / vmax * (bottom - top), 0.6)
            x = left + i * bw + bw * 0.12
            w = max(bw * 0.72, 2)
            c.setFillColor(ACCENT_A)
            self._alpha(0.92)
            c.roundRect(x, top, w, bh, 1.5, stroke=0, fill=1)
            self._alpha(1)
            if len(data) <= 10:
                self._x_label(d.get(x_key, ""), x + w / 2, bottom + 5)
        c.restoreState()


class LineChart(_ChartFlowable):
    def draw(self):
        c = self.canv
        self._title()
        data = self.chart.get("data") or []
        if len(data) < 2:
            BarChart(self.chart, self.chart_w, self.chart_h).draw()
            return
        x_key, y_key = self.chart["x"], self.chart["y"]
        left, right = 30, self.width - 8
        top, bottom = self.height - 18, self.height - 34
        values = [_val_or_zero(d, y_key) for d in data]
        vmin, vmax = min(values), max(values)
        if vmax == vmin:
            vmax, vmin = vmax + 1, vmin - 1
        self._gridlines(left, top, right, bottom, vmax)
        step = (right - left) / (len(data) - 1)
        pts = []
        for i, d in enumerate(data):
            x = left + i * step
            y = top + (bottom - top) * (1 - (values[i] - vmin) / (vmax - vmin))
            pts.append((x, y))
        c.saveState()
        # area fill
        p = c.beginPath()
        p.moveTo(pts[0][0], top)
        for x, y in pts:
            p.lineTo(x, y)
        p.lineTo(pts[-1][0], top)
        p.close()
        c.setFillColor(ACCENT_A)
        self._alpha(0.15)
        c.drawPath(p, stroke=0, fill=1)
        self._alpha(1)
        # line + points
        c.setStrokeColor(ACCENT_A)
        c.setLineWidth(1.4)
        for i in range(len(pts) - 1):
            c.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
        c.setFillColor(WHITE)
        for x, y in pts:
            c.circle(x, y, 1.6, stroke=1, fill=1)
            c.setFillColor(WHITE)
        c.setStrokeColor(ACCENT_A)
        # labels (subset)
        max_labels = 8
        idxs = sorted({round(i * (len(data) - 1) / (max_labels - 1)) for i in range(max_labels)})
        for i in idxs:
            self._x_label(data[i].get(x_key, ""), pts[i][0], bottom + 5)
        c.restoreState()


class PieChart(_ChartFlowable):
    def draw(self):
        c = self.canv
        self._title()
        data = self.chart.get("data") or []
        if not data:
            return
        x_key, y_key = self.chart["x"], self.chart["y"]
        total = sum(_val_or_zero(d, y_key) for d in data)
        if not total:
            return
        cx, cy = min(self.width * 0.26, 90), self.height * 0.5
        r = min(self.height * 0.34, 55)
        start = -90.0
        legend_x = cx + r + 22
        legend_y = self.height - 30
        c.saveState()
        for i, d in enumerate(data):
            frac = _val_or_zero(d, y_key) / total
            sweep = frac * 360
            color = PALETTE[i % len(PALETTE)]
            p = c.beginPath()
            p.moveTo(cx, cy)
            seg = max(int(frac * 60), 3)
            for k in range(seg + 1):
                ang = math.radians(start + sweep * k / seg)
                p.lineTo(cx + r * math.cos(ang), cy + r * math.sin(ang))
            p.close()
            c.setFillColor(color)
            c.drawPath(p, stroke=1, fill=1)
            c.setStrokeColor(WHITE)
            c.setLineWidth(0.8)
            start += sweep
        # legend
        for i, d in enumerate(data):
            if i >= 10 or legend_y < 14:
                break
            name = str(d.get(x_key, ""))[:20]
            c.setFillColor(PALETTE[i % len(PALETTE)])
            c.rect(legend_x, legend_y - 7, 8, 8, stroke=0, fill=1)
            c.setFillColor(INK)
            self._font(7.5)
            c.drawString(legend_x + 12, legend_y - 4, name)
            c.setFillColor(MUTED)
            c.drawRightString(self.width - 8, legend_y - 4, f"{_val_or_zero(d, y_key) / total * 100:.1f}%")
            legend_y -= 17
        c.restoreState()


class HeatmapChart(_ChartFlowable):
    def draw(self):
        c = self.canv
        self._title()
        columns = self.chart.get("columns") or []
        matrix = self.chart.get("matrix") or []
        if not columns or not matrix:
            return
        cols = len(columns)
        cell = min((self.width - 40) / cols, (self.height - 44) / cols)
        left, top = 58, self.height - 22
        c.saveState()
        for j, name in enumerate(columns):
            self._font(6.5)
            c.setFillColor(MUTED)
            c.drawCentredString(left + j * cell + cell / 2, top - 10, str(name)[:12])
            c.saveState()
            c.translate(left - 8, top + j * cell + cell / 2)
            c.rotate(90)
            c.drawString(3, -2, str(name)[:12])
            c.restoreState()
            for i, v in enumerate(matrix[j]):
                x, y = left + j * cell, top + i * cell
                if v is None:
                    c.setFillColor(colors.HexColor("#f8fafc"))
                    c.setStrokeColor(colors.HexColor("#e2e8f0"))
                    c.rect(x, y, cell, cell, stroke=1, fill=1)
                    continue
                vf = float(v)
                if vf < 0:
                    a = 0.15 + 0.85 * min(-vf, 1)
                    col = colors.HexColor("#f43f5e")
                else:
                    a = 0.15 + 0.85 * min(vf, 1)
                    col = ACCENT_A
                c.setFillColor(col)
                self._alpha(a)
                c.rect(x, y, cell, cell, stroke=0, fill=1)
                self._alpha(1)
                c.setStrokeColor(colors.HexColor("#e2e8f0"))
                c.setLineWidth(0.3)
                c.rect(x, y, cell, cell, stroke=1, fill=0)
        c.restoreState()


class ScatterChart(_ChartFlowable):
    def draw(self):
        c = self.canv
        self._title()
        data = self.chart.get("data") or []
        if len(data) < 3:
            return
        x_key, y_key = self.chart["x"], self.chart["y"]
        left, right = 34, self.width - 8
        top, bottom = self.height - 18, self.height - 30
        xs = [_val_or_zero(d, x_key) for d in data]
        ys = [_val_or_zero(d, y_key) for d in data]
        xmin, xmax = min(xs), max(xs)
        ymin, ymax = min(ys), max(ys)
        if xmax == xmin:
            xmax += 1
        if ymax == ymin:
            ymax += 1
        self._gridlines(left, top, right, bottom, ymax)
        c.saveState()
        for d, xv, yv in zip(data, xs, ys):
            x = left + (xv - xmin) / (xmax - xmin) * (right - left)
            y = top + (bottom - top) * (1 - (yv - ymin) / (ymax - ymin))
            c.setFillColor(ACCENT_A)
            self._alpha(0.7)
            c.circle(x, y, 1.8, stroke=0, fill=1)
        self._alpha(1)
        c.setFillColor(MUTED)
        self._font(7)
        c.drawString(left, bottom + 5, str(x_key)[:16])
        c.restoreState()


class QualityBarFlowable(Flowable):
    """Horizontal quality-score bar used in the report header."""

    def __init__(self, score: int, width: float = 400, height: float = 30):
        super().__init__()
        self.score = max(0, min(100, int(score)))
        self.chart_w = width
        self.chart_h = height

    def wrap(self, availWidth, availHeight):
        self.width = min(self.chart_w, availWidth)
        self.height = self.chart_h
        return self.width, self.height

    def draw(self):
        c = self.canv
        color = colors.HexColor("#10b981") if self.score >= 80 else colors.HexColor("#f59e0b") if self.score >= 60 else colors.HexColor("#f43f5e")
        bar_w = self.width - 40
        c.setFillColor(GRID)
        c.roundRect(0, 4, bar_w, 10, 5, stroke=0, fill=1)
        c.setFillColor(color)
        c.roundRect(0, 4, max(bar_w * self.score / 100, 4), 10, 5, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(bar_w + 10, 2, f"{self.score}/100")


def flowable_for_chart(chart: dict, width: float = 400, height: float = 150) -> Flowable | None:
    kind = chart.get("chart_type")
    cls = {
        "bar": BarChart,
        "histogram": BarChart,
        "line": LineChart,
        "pie": PieChart,
        "heatmap": HeatmapChart,
        "scatter": ScatterChart,
    }.get(kind)
    if cls is None:
        return None
    return cls(chart, width=width, height=height)
