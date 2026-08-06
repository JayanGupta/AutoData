"""Dependency-free chart rendering for reports.

Generates inline SVG charts for the HTML report so the final document really
does contain the actual visualisations computed from the dataset - nothing is
stubbed or skipped. The same functions power the PDF report via small
reportlab flowables (see ``report_pdf_charts``).
"""

from __future__ import annotations

import html
import math

# Brand palette (shared with the frontend).
ACCENT_A = "#7c3aed"  # violet
ACCENT_B = "#06b6d4"  # cyan
INK = "#1f2937"
GRID = "#e5e7eb"
MUTED = "#6b7280"

HEIGHT = 300
WIDTH = 640


def _esc(v) -> str:
    return html.escape(str(v))


def _fmt(v: float, digits: int = 1) -> str:
    """Compact axis label formatting (12.5k, 3.2M, 0.4)."""
    av = abs(v)
    if av >= 1_000_000:
        return f"{v / 1_000_000:.1f}M"
    if av >= 1_000:
        return f"{v / 1_000:.1f}k"
    if av >= 100:
        return f"{v:.0f}"
    return f"{v:.{digits}f}"


def _frame(W: int, H: int, top: int = 22, bottom: int = 46, left: int = 56, right: int = 18):
    return left, top, W - right, H - bottom


def _gridlines(ax: float, ay: float, aw: float, ah: float, vmax: float, n: int = 5) -> list[tuple[float, float]]:
    lines = []
    for i in range(n + 1):
        frac = i / n
        y = ay + ah - frac * ah
        lines.append((y, frac * vmax))
    return lines


def _num_color(v: float) -> str:
    """Diverging colour for correlation values in [-1, 1]."""
    pos = max(0.0, v)
    neg = max(0.0, -v)
    if neg > 0:
        return f"rgba(244,63,94,{0.15 + 0.85 * neg:.2f})"
    return f"rgba(124,58,237,{0.15 + 0.85 * pos:.2f})"


def svg_bar_chart(chart: dict, W: int = WIDTH, H: int = HEIGHT) -> str:
    data = chart["data"] or []
    x_key, y_key = chart["x"], chart["y"]
    title = chart.get("title", "")
    left, top, right, bottom = _frame(W, H)
    aw, ah = right - left, bottom - top
    values = [float(d.get(y_key, 0) or 0) for d in data]
    if not values:
        return ""
    vmax = max(values) or 1
    bw = aw / max(len(data), 1)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="{_esc(title)}" '
        f'style="max-width:100%;height:auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif">',
        "<defs>",
        f'<linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{ACCENT_A}"/><stop offset="1" stop-color="{ACCENT_B}"/></linearGradient>',
        "</defs>",
    ]
    if title:
        parts.append(f'<text x="{left}" y="16" fill="{INK}" font-size="13" font-weight="600">{_esc(title)}</text>')
    for y, val in _gridlines(ax=left, ay=top, aw=aw, ah=ah, vmax=vmax, n=4):
        parts.append(
            f'<line x1="{left}" y1="{y:.1f}" x2="{right}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>'
            f'<text x="{left - 8}" y="{y + 3:.1f}" fill="{MUTED}" font-size="9" text-anchor="end">{_fmt(val)}</text>'
        )
    for i, d in enumerate(data):
        v = values[i]
        bh = max((v / vmax) * ah, 1)
        x = left + i * bw + bw * 0.12
        bar_w = max(bw * 0.72, 3)
        y = top + ah - bh
        parts.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{bh:.1f}" rx="3" fill="url(#barGrad)" opacity="0.92"/>'
        )
        label = _esc(str(d.get(x_key, "")))
        rotate = ' transform="rotate(-30)"' if len(data) > 8 else ""
        tx, ty = (x + bar_w / 2, bottom + 12)
        if rotate:
            parts.append(
                f'<text x="{tx:.1f}" y="{ty}" fill="{MUTED}" font-size="9" text-anchor="end"{rotate}>{label}</text>'
            )
        else:
            parts.append(
                f'<text x="{tx:.1f}" y="{ty}" fill="{MUTED}" font-size="9" text-anchor="middle">{label}</text>'
            )
    parts.append("</svg>")
    return "".join(parts)


def svg_line_chart(chart: dict, W: int = WIDTH, H: int = HEIGHT) -> str:
    data = chart["data"] or []
    x_key, y_key = chart["x"], chart["y"]
    title = chart.get("title", "")
    if len(data) < 2:
        return svg_bar_chart(chart, W, H)
    left, top, right, bottom = _frame(W, H)
    aw, ah = right - left, bottom - top
    values = [float(d.get(y_key, 0) or 0) for d in data]
    vmin, vmax = min(values), max(values)
    if vmax == vmin:
        vmax, vmin = vmax + 1, vmin - 1
    n = len(data)
    step = aw / (n - 1)
    pts = []
    for i, d in enumerate(data):
        x = left + i * step
        y = top + ah - (float(d.get(y_key, 0)) - vmin) / (vmax - vmin) * ah
        pts.append((x, y))
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="{_esc(title)}" '
        f'style="max-width:100%;height:auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif">',
        "<defs>",
        f'<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{ACCENT_A}" stop-opacity="0.35"/>'
        f'<stop offset="1" stop-color="{ACCENT_A}" stop-opacity="0.02"/></linearGradient>',
        "</defs>",
    ]
    if title:
        parts.append(f'<text x="{left}" y="16" fill="{INK}" font-size="13" font-weight="600">{_esc(title)}</text>')
    for y, val in _gridlines(ax=left, ay=top, aw=aw, ah=ah, vmax=vmax, n=4):
        parts.append(
            f'<line x1="{left}" y1="{y:.1f}" x2="{right}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>'
            f'<text x="{left - 8}" y="{y + 3:.1f}" fill="{MUTED}" font-size="9" text-anchor="end">{_fmt(val)}</text>'
        )
    area = f"M{pts[0][0]:.1f} {top + ah:.1f} " + " ".join(f"L{x:.1f} {y:.1f}" for x, y in pts) + f" L{pts[-1][0]:.1f} {top + ah:.1f} Z"
    line = " ".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    parts.append(f'<path d="{area}" fill="url(#areaGrad)"/>')
    parts.append(f'<polyline points="{line}" fill="none" stroke="{ACCENT_A}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>')
    for i, (x, y) in enumerate(pts):
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" fill="#fff" stroke="{ACCENT_A}" stroke-width="2"/>')
    max_labels = 8
    label_idx = [round(i * (n - 1) / max(max_labels - 1, 1)) for i in range(max_labels)]
    for i in set(label_idx):
        x, y = pts[i]
        parts.append(
            f'<text x="{x:.1f}" y="{bottom + 12}" fill="{MUTED}" font-size="9" text-anchor="middle">{_esc(str(data[i].get(x_key, ""))[:12])}</text>'
        )
    parts.append("</svg>")
    return "".join(parts)


def svg_pie_chart(chart: dict, W: int = WIDTH, H: int = HEIGHT) -> str:
    data = chart["data"] or []
    x_key, y_key = chart["x"], chart["y"]
    title = chart.get("title", "")
    total = sum(float(d.get(y_key, 0) or 0) for d in data)
    if not total:
        return ""
    palette = ["#7c3aed", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", "#6366f1", "#14b8a6", "#f43f5e", "#8b5cf6", "#0ea5e9"]
    cx, cy, r = W * 0.28, H * 0.52, min(H * 0.34, W * 0.22)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="{_esc(title)}" '
        f'style="max-width:100%;height:auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif">',
    ]
    if title:
        parts.append(f'<text x="14" y="16" fill="{INK}" font-size="13" font-weight="600">{_esc(title)}</text>')
    start = -90.0
    labels = []
    for i, d in enumerate(data):
        frac = float(d.get(y_key, 0) or 0) / total
        sweep = frac * 360
        a0, a1 = start, start + sweep
        x0, y0 = cx + r * math.cos(math.radians(a0)), cy + r * math.sin(math.radians(a0))
        x1, y1 = cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1))
        large = 1 if sweep > 180 else 0
        color = palette[i % len(palette)]
        parts.append(
            f'<path d="M{cx:.1f} {cy:.1f} L{x0:.1f} {y0:.1f} A{r:.1f} {r:.1f} 0 {large} 1 {x1:.1f} {y1:.1f} Z" '
            f'fill="{color}" stroke="#fff" stroke-width="1.5"/>'
        )
        labels.append((d.get(x_key, ""), frac))
        start = a1
    lx = W * 0.55
    ly = 34
    for name, frac in labels[:10]:
        parts.append(
            f'<rect x="{lx}" y="{ly - 9}" width="10" height="10" rx="2" fill="{palette[labels.index((name, frac)) % len(palette)]}"/>'
            f'<text x="{lx + 16}" y="{ly}" fill="{INK}" font-size="11">{_esc(str(name))[:22]}</text>'
            f'<text x="{W - 16}" y="{ly}" fill="{MUTED}" font-size="10" text-anchor="end">{frac * 100:.1f}%</text>'
        )
        ly += 22
        if ly > H - 12:
            break
    parts.append("</svg>")
    return "".join(parts)


def svg_heatmap(chart: dict, W: int = WIDTH, H: int = HEIGHT) -> str:
    title = chart.get("title", "")
    columns = chart.get("columns") or []
    matrix = chart.get("matrix") or []
    if not columns or not matrix:
        return ""
    cols = len(columns)
    left, top = 86, 40
    cell = min((W - left - 16) / max(cols, 1), (H - top - 40) / max(cols, 1))
    cell = max(cell, 8)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="{_esc(title)}" '
        f'style="max-width:100%;height:auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif">',
    ]
    if title:
        parts.append(f'<text x="14" y="16" fill="{INK}" font-size="13" font-weight="600">{_esc(title)}</text>')
    for j, c in enumerate(columns):
        name = _esc(str(c))[:12]
        parts.append(f'<text x="{left + j * cell + cell / 2}" y="32" fill="{MUTED}" font-size="8.5" text-anchor="middle">{name}</text>')
        parts.append(f'<text x="{left - 8}" y="{top + j * cell + cell / 2 + 3}" fill="{MUTED}" font-size="8.5" text-anchor="end">{name}</text>')
        for i, v in enumerate(matrix[j]):
            if v is None:
                parts.append(f'<rect x="{left + j * cell:.1f}" y="{top + i * cell:.1f}" width="{cell:.1f}" height="{cell:.1f}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5"/>')
            else:
                parts.append(
                    f'<rect x="{left + j * cell:.1f}" y="{top + i * cell:.1f}" width="{cell:.1f}" height="{cell:.1f}" '
                    f'fill="{_num_color(float(v))}" rx="1"><title>{_esc(c)} × {_esc(columns[i])}: {v:.2f}</title></rect>'
                )
    parts.append(
        f'<text x="14" y="{H - 6}" fill="{MUTED}" font-size="9">Negative</text>'
        f'<rect x="64" y="{H - 15}" width="60" height="10" rx="2" fill="#f43f5e" opacity="0.55"/>'
        f'<rect x="128" y="{H - 15}" width="60" height="10" rx="2" fill="#7c3aed" opacity="0.55"/>'
        f'<text x="194" y="{H - 6}" fill="{MUTED}" font-size="9">Positive</text>'
    )
    parts.append("</svg>")
    return "".join(parts)


def svg_scatter_chart(chart: dict, W: int = WIDTH, H: int = HEIGHT) -> str:
    data = chart["data"] or []
    x_key, y_key = chart["x"], chart["y"]
    title = chart.get("title", "")
    if len(data) < 3:
        return ""
    left, top, right, bottom = _frame(W, H)
    aw, ah = right - left, bottom - top
    xs = [float(d.get(x_key, 0) or 0) for d in data]
    ys = [float(d.get(y_key, 0) or 0) for d in data]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    if xmax == xmin:
        xmax += 1
    if ymax == ymin:
        ymax += 1
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="{_esc(title)}" '
        f'style="max-width:100%;height:auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif">',
        "<defs>",
        f'<radialGradient id="ptGrad"><stop offset="0" stop-color="{ACCENT_B}"/><stop offset="1" stop-color="{ACCENT_A}"/></radialGradient>',
        "</defs>",
    ]
    if title:
        parts.append(f'<text x="{left}" y="16" fill="{INK}" font-size="13" font-weight="600">{_esc(title)}</text>')
    for y, val in _gridlines(ax=left, ay=top, aw=aw, ah=ah, vmax=ymax, n=4):
        parts.append(
            f'<line x1="{left}" y1="{y:.1f}" x2="{right}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>'
            f'<text x="{left - 8}" y="{y + 3:.1f}" fill="{MUTED}" font-size="9" text-anchor="end">{_fmt(val)}</text>'
        )
    for d in data:
        x = left + (float(d.get(x_key, 0)) - xmin) / (xmax - xmin) * aw
        y = top + ah - (float(d.get(y_key, 0)) - ymin) / (ymax - ymin) * ah
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2" fill="url(#ptGrad)" opacity="0.75"/>')
    parts.append(
        f'<text x="{left}" y="{bottom + 12}" fill="{MUTED}" font-size="9">{_esc(x_key)}</text>'
        f'<text x="{left}" y="12" fill="{MUTED}" font-size="9">{_esc(y_key)}</text>'
    )
    parts.append("</svg>")
    return "".join(parts)


_RENDERERS = {
    "bar": svg_bar_chart,
    "histogram": svg_bar_chart,
    "line": svg_line_chart,
    "pie": svg_pie_chart,
    "heatmap": svg_heatmap,
    "scatter": svg_scatter_chart,
}


def svg_for_chart(chart: dict) -> str:
    renderer = _RENDERERS.get(chart.get("chart_type"))
    if renderer is None:
        return ""
    return renderer(chart)


def pick_report_charts(charts: list[dict], max_charts: int = 6) -> list[dict]:
    """Pick a diverse, representative subset of charts for a report.

    Prefers richer chart types (aggregations, trends, distributions) over
    repeated scatter plots, and caps the total count.
    """
    if not charts:
        return []
    preferred = {"bar": 0, "line": 1, "pie": 2, "histogram": 3, "heatmap": 4, "scatter": 5}
    ordered = sorted(charts, key=lambda c: preferred.get(c.get("chart_type"), 9))
    seen_types = {}
    picked = []
    for c in ordered:
        t = c.get("chart_type")
        seen_types[t] = seen_types.get(t, 0) + 1
        limit = {"scatter": 1, "histogram": 2, "heatmap": 1}.get(t, 2)
        if seen_types[t] > limit:
            continue
        picked.append(c)
        if len(picked) >= max_charts:
            break
    return picked
