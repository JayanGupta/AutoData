"""Professional report generation (Markdown + HTML + PDF).

Assembles the dataset overview, quality summary, key insights, correlations
and the *actual computed charts* into a single downloadable report. Nothing is
invented here - every number and every chart comes from the computed
analysis. Columns flagged as sensitive (PII) are summarised without their
values.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass

from .ai.insights import dataset_overview_text
from .config import MAX_ANALYZED_ROWS
from .data_engine.engine import EngineResult, analyze
from .report_charts import pick_report_charts, svg_for_chart

SECTION_TITLES = {
    "summary": "Executive Summary", "overview": "Dataset Overview", "columns": "Columns",
    "quality": "Data Quality", "insights": "Key Insights", "correlations": "Correlations",
    "charts": "Charts",
}


def _esc(v) -> str:
    if v is None:
        return "&ndash;"
    return html.escape(str(v))


@dataclass
class Report:
    engine: EngineResult
    name: str
    insights: list[dict]
    charts: list[dict]
    issues: list[dict]
    summary: list[str]
    section_order: tuple[str, ...] | None = None

    def headings(self):
        order = self.section_order or tuple(SECTION_TITLES)
        for index, key in enumerate(order):
            number = index + 1 if self.section_order else index
            title = SECTION_TITLES[key]
            yield key, f"{number}. {title}" if number else title


def prepare_report(engine: EngineResult, name: str, *, cleaning_steps: int, sections: tuple[str, ...] | None = None) -> Report:
    if sections is not None and (not sections or len(set(sections)) != len(sections) or set(sections) - SECTION_TITLES.keys()):
        raise ValueError("Choose at least one report section. Section names must be valid and unique.")
    visible = [column["name"] for column in engine.columns if not column.get("sensitive")]
    omitted = len(engine.columns) - len(visible)
    if omitted:
        engine = analyze(engine.df.loc[:, visible])
    insights = engine.cached_insights()
    quality = engine.quality["summary"]
    severity = {"high": 0, "medium": 1, "low": 2}
    issues = sorted(engine.quality["issues"], key=lambda issue: severity.get(issue["severity"], 3))
    summary = [
        f"Quality score: {quality['quality_score']}/100 across {quality['total_issues']} detected issues.",
        f"Cleaning steps applied: {cleaning_steps}.",
    ]
    if omitted:
        summary.append(f"Excluded {omitted} sensitive columns from report analysis.")
    if len(engine.df) > MAX_ANALYZED_ROWS:
        summary.append(
            f"Column profiles, quality checks, charts, and correlations use a sample of "
            f"{MAX_ANALYZED_ROWS:,} of {len(engine.df):,} rows."
        )
    if quality["high"]:
        summary.append("Next step: review high-priority data-quality issues before sharing findings.")
    elif quality["total_issues"]:
        summary.append("Next step: review the data-quality findings before acting on the results.")
    if insights:
        for insight in insights[:3]:
            first_number = next(iter(insight["numbers"]), None)
            detail = f" ({first_number['label']}: {first_number['value']})" if first_number else ""
            summary.append(f"{insight['title']}{detail}.")
    charts = pick_report_charts(engine.chart_suggestions, max_charts=4)
    return Report(engine, name, insights, charts, issues, summary, sections)


def build_report_markdown(report: Report) -> str:
    engine, dataset_name = report.engine, report.name
    insights, charts = report.insights, report.charts
    s = engine.summary
    columns = engine.columns
    lines = []
    lines.append(f"# AutoData Report — {dataset_name}")
    lines.append("")
    for section, heading in report.headings():
        if section == "summary":
            lines.extend([f"## {heading}", "", *(f"- {item}" for item in report.summary), ""])
        elif section == "overview":
            lines.append(f"## {heading}")
            lines.append("")
            lines.append(dataset_overview_text(engine))
            lines.append("")
        elif section == "columns":
            lines.append(f"## {heading}")
            lines.append("")
            lines.append("| Column | Type | Confidence | Missing | Distinct |")
            lines.append("| --- | --- | --- | --- | --- |")
            for c in columns:
                lines.append(
                    f"| {c['name']} | {c['inferred_type']} | {c['confidence']} | "
                    f"{c['null_pct']}% | {c['distinct_count']} |"
                )
            lines.append("")
        elif section == "quality":
            lines.append(f"## {heading}")
            q = engine.quality["summary"]
            lines.append("")
            lines.append(
                f"Quality score: **{q['quality_score']}/100** ({q['total_issues']} issues: "
                f"{q['high']} high, {q['medium']} medium, {q['low']} low)."
            )
            lines.append("")
            for issue in report.issues:
                lines.append(f"- **[{issue['severity'].upper()}]** {issue['title']}: {issue['detail']}")
            lines.append("")
        elif section == "insights":
            lines.append(f"## {heading}")
            lines.append("")
            if not insights:
                lines.append("No significant patterns were detected in this dataset.")
            for i in insights:
                lines.append(f"### {i['title']}")
                lines.append("")
                lines.append(i["detail"])
                if i.get("numbers"):
                    parts = ", ".join(f"{n['label']}: **{n['value']}**" for n in i["numbers"])
                    lines.append(f"\n_{parts}_")
                lines.append("")
        elif section == "correlations":
            lines.append(f"## {heading}")
            lines.append("")
            if engine.strong_correlations:
                for p in engine.strong_correlations[:6]:
                    lines.append(
                        f"- {p['col_a']} & {p['col_b']}: **{p['correlation']:.2f}** ({p['strength']})"
                    )
            else:
                lines.append("No strong correlations were found between numeric columns.")
            lines.append("")
        elif section == "charts":
            lines.append(f"## {heading}")
            lines.append("")
            if charts:
                lines.extend(f"- {chart['title']}" for chart in charts)
                lines.append("Charts are embedded in the HTML and PDF editions.")
            else:
                lines.append("No suitable charts for this dataset.")
            lines.append("")

    lines.append("---")
    lines.append(f"*Generated by AutoData · {s['row_count']:,} rows × {s['column_count']} columns*")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Markdown -> HTML rendering (small, safe subset used for preview + download)
# ---------------------------------------------------------------------------

_INLINE_BOLD = re.compile(r"\*\*(.+?)\*\*")
_INLINE_CODE = re.compile(r"`([^`]+)`")
_INLINE_EM = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")


def _inline(text: str) -> str:
    text = _esc(text)
    text = _INLINE_CODE.sub(r"<code>\1</code>", text)
    text = _INLINE_BOLD.sub(r"<strong>\1</strong>", text)
    text = _INLINE_EM.sub(r"<em>\1</em>", text)
    return text


def _is_table_sep(line: str) -> bool:
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    return bool(cells) and all(set(c) <= set("-: ") and c for c in cells)


def markdown_to_html(markdown_text: str) -> str:
    """Render a small Markdown subset to standalone, self-contained HTML."""
    out: list[str] = []
    lines = markdown_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]

        # Tables (header row + separator + body rows)
        if line.startswith("|") and i + 1 < len(lines) and _is_table_sep(lines[i + 1]):
            header = [c.strip() for c in line.strip().strip("|").split("|")]
            i += 2
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(cells)
                i += 1
            head = "".join(f"<th>{_inline(c)}</th>" for c in header)
            body = "".join(
                "<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in row) + "</tr>"
                for row in rows
            )
            out.append(f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>")
            continue

        # Unordered lists
        if line.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(f"<li>{_inline(lines[i][2:])}</li>")
                i += 1
            out.append("<ul>" + "".join(items) + "</ul>")
            continue

        # Headings
        for marker, tag in (("### ", "h3"), ("## ", "h2"), ("# ", "h1")):
            if line.startswith(marker):
                out.append(f"<{tag}>{_inline(line[len(marker):])}</{tag}>")
                i += 1
                break
        else:
            # Blockquote
            if line.startswith("> "):
                out.append(f"<blockquote>{_inline(line[2:])}</blockquote>")
            elif line.startswith("---"):
                out.append("<hr>")
            elif line.strip().startswith("_"):
                out.append(f"<p><em>{_inline(line.strip('_').strip())}</em></p>")
            elif line.strip() == "":
                out.append("")
            else:
                out.append(f"<p>{_inline(line)}</p>")
            i += 1

    body = "\n".join(out)
    return _html_document("Analysis Report", body, charts_html="")


def _html_document(title: str, body: str, charts_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_esc(title)}</title>
<style>
:root {{ color-scheme: light; }}
* {{ box-sizing: border-box; }}
body {{ font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 32px auto; padding: 0 24px; color: #1f2937; line-height: 1.65; }}
h1 {{ font-size: 28px; letter-spacing: -0.02em; border-bottom: 3px solid #7c3aed; padding-bottom: 10px; }}
h2 {{ margin-top: 36px; font-size: 20px; letter-spacing: -0.01em; color: #111827; }}
h3 {{ margin-top: 22px; font-size: 16px; }}
h2::before {{ content: ''; display: inline-block; width: 10px; height: 10px; margin-right: 8px; border-radius: 3px; background: linear-gradient(135deg, #7c3aed, #06b6d4); }}
table {{ border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13.5px; }}
th, td {{ border: 1px solid #e5e7eb; padding: 7px 11px; text-align: left; }}
thead th {{ background: #f3f0ff; font-weight: 600; color: #4c1d95; }}
tbody tr:nth-child(even) {{ background: #fafafa; }}
code {{ background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 5px; padding: 1px 5px; font-size: 0.9em; }}
ul {{ padding-left: 22px; }}
li {{ margin: 5px 0; }}
blockquote {{ border-left: 3px solid #a78bfa; margin: 14px 0; padding: 4px 16px; color: #4b5563; background: #faf7ff; }}
hr {{ border: 0; border-top: 1px solid #e5e7eb; margin: 34px 0; }}
figure {{ margin: 20px 0; padding: 18px; border: 1px solid #ede9fe; border-radius: 14px; background: #fcfbff; }}
figcaption {{ margin-top: 10px; font-size: 12px; color: #6b7280; text-align: center; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 8px; }}
.gauge-row {{ display: flex; align-items: center; gap: 18px; margin: 10px 0; }}
footer {{ margin-top: 40px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }}
@media print {{ body {{ max-width: 100%; margin: 0; }} h2 {{ page-break-after: avoid; }} figure {{ break-inside: avoid; }} }}
</style></head>
<body>
{body}
{charts_html}
<footer>Generated by AutoData — automated analysis of the uploaded dataset.</footer>
</body></html>"""


def _quality_gauge(score: int) -> str:
    r = 40
    circ = 2 * 3.14159 * r
    frac = max(0, min(100, score)) / 100
    color = "#10b981" if score >= 80 else "#f59e0b" if score >= 60 else "#f43f5e"
    return (
        f'<svg viewBox="0 0 100 100" width="86" height="86" role="img" '
        f'aria-label="Quality score {score} out of 100">'
        f'<circle cx="50" cy="50" r="{r}" fill="none" stroke="#eef2ff" stroke-width="10"/>'
        f'<circle cx="50" cy="50" r="{r}" fill="none" stroke="{color}" stroke-width="10" '
        f'stroke-linecap="round" stroke-dasharray="{circ:.2f}" stroke-dashoffset="{circ * (1 - frac):.2f}" '
        f'transform="rotate(-90 50 50)"/>'
        f'<text x="50" y="55" text-anchor="middle" font-size="24" font-weight="700" fill="#111827">'
        f'{score}</text>'
        f'<text x="50" y="70" text-anchor="middle" font-size="8" fill="#6b7280">QUALITY</text>'
        f'</svg>'
    )


def build_report_html(report: Report) -> str:
    """Build a self-contained HTML report with the computed charts embedded."""
    engine, dataset_name = report.engine, report.name
    insights, charts = report.insights, report.charts
    s = engine.summary
    q = engine.quality["summary"]
    columns = engine.columns

    sections = [
        "<h1>AutoData Report</h1>",
        f"<p class='muted'>{_esc(dataset_name)} · "
        f"{s['row_count']:,} rows × {s['column_count']} columns</p>",
    ]

    for section, heading in report.headings():
        if section == "summary":
            sections.append(f"<h2>{heading}</h2>")
            sections.append("<ul>" + "".join(f"<li>{_esc(item)}</li>" for item in report.summary) + "</ul>")
        elif section == "overview":
            sections.append(f"<h2>{heading}</h2>")
            sections.append(f"<p>{_inline(dataset_overview_text(engine))}</p>")
        elif section == "columns":
            sections.append(f"<h2>{heading}</h2>")
            head = "".join(f"<th>{_esc(c)}</th>" for c in ["Column", "Type", "Confidence", "Missing", "Distinct"])
            body = "".join(
                "<tr>" + "".join(
                    f"<td>{_esc(c['name'])}</td><td>{_esc(c['inferred_type'])}</td>"
                    f"<td>{_esc(c['confidence'])}</td><td>{_esc(c['null_pct'])}%</td>"
                    f"<td>{_esc(c['distinct_count'])}</td>"
                ) + "</tr>"
                for c in columns
            )
            sections.append(f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>")
        elif section == "quality":
            sections.append(f"<h2>{heading}</h2>")
            sections.append(
                "<div class='gauge-row'>" + _quality_gauge(q["quality_score"]) +
                f"<p>{q['total_issues']} issue(s) detected: "
                f"<strong>{q['high']}</strong> high, <strong>{q['medium']}</strong> medium, "
                f"<strong>{q['low']}</strong> low.</p></div>"
            )
            issues = "".join(
                f"<li><strong>[{_esc(i['severity'].upper())}]</strong> {_esc(i['title'])} — {_esc(i['detail'])}</li>"
                for i in report.issues
            )
            if issues:
                sections.append(f"<ul>{issues}</ul>")
        elif section == "insights":
            sections.append(f"<h2>{heading}</h2>")
            if not insights:
                sections.append("<p>No significant patterns were detected in this dataset.</p>")
            for ins in insights:
                sections.append(f"<h3>{_esc(ins['title'])}</h3>")
                sections.append(f"<p>{_inline(ins['detail'])}</p>")
                if ins.get("numbers"):
                    parts = ", ".join(
                        f"{_esc(n['label'])}: <strong>{_esc(n['value'])}</strong>" for n in ins["numbers"]
                    )
                    sections.append(f"<p><em>{parts}</em></p>")
        elif section == "correlations":
            sections.append(f"<h2>{heading}</h2>")
            if engine.strong_correlations:
                corr = "".join(
                    f"<li>{_esc(p['col_a'])} &amp; {_esc(p['col_b'])}: "
                    f"<strong>{p['correlation']:.2f}</strong> ({_esc(p['strength'])})</li>"
                    for p in engine.strong_correlations[:6]
                )
                sections.append(f"<ul>{corr}</ul>")
            else:
                sections.append("<p>No strong correlations were found between numeric columns.</p>")
        elif section == "charts":
            sections.append(f'<h2 id="charts">{heading}</h2>')
            figures = []
            for chart in charts:
                svg = svg_for_chart(chart)
                if svg:
                    figures.append(f"<figure>{svg}<figcaption>{_esc(chart['title'])}</figcaption></figure>")
            sections.append('<div class="grid">' + "".join(figures) + "</div>" if figures else "<p>No suitable charts for this dataset.</p>")

    return _html_document(f"AutoData Report — {dataset_name}", "\n".join(sections), "")


# ---------------------------------------------------------------------------
# PDF report
# ---------------------------------------------------------------------------


def build_report_pdf(report: Report) -> bytes:
    """Build a real, shareable PDF report (reportlab) with embedded charts."""
    from io import BytesIO

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        KeepTogether,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    from .report_pdf_charts import QualityBarFlowable, flowable_for_chart

    engine, dataset_name = report.engine, report.name
    insights, charts = report.insights, report.charts
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="Tight", parent=styles["Normal"], spaceAfter=6, leading=14,
    ))
    styles.add(ParagraphStyle(
        name="H2Local", parent=styles["Heading2"], textColor=colors.HexColor("#4f46e5"),
        spaceBefore=14, spaceAfter=6, keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        name="Muted", parent=styles["Normal"], textColor=colors.HexColor("#6b7280"),
        fontSize=9, spaceAfter=4,
    ))

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        topMargin=0.85 * inch, bottomMargin=0.85 * inch,
    )
    story = []
    story.append(Paragraph(f"AutoData Report — {_html(dataset_name)}", styles["Title"]))
    story.append(Paragraph("Automated data analysis", styles["Muted"]))
    story.append(Spacer(1, 10))

    for section, heading in report.headings():
        if section == "summary":
            story.append(Paragraph(heading, styles["H2Local"]))
            for item in report.summary:
                story.append(Paragraph(_html(item), styles["Tight"]))
        elif section == "overview":
            story.append(Paragraph(heading, styles["H2Local"]))
            story.append(Paragraph(_html(dataset_overview_text(engine)), styles["Tight"]))
        elif section == "columns":
            story.append(Paragraph(heading, styles["H2Local"]))
            columns = engine.columns
            col_data = [["Column", "Type", "Missing", "Distinct"]]
            for c in columns:
                col_data.append([Paragraph(_html(c["name"]), styles["Muted"]), c["inferred_type"], f"{c['null_pct']}%", str(c["distinct_count"])])
            col_table = Table(col_data, colWidths=[2.4 * inch, 1.4 * inch, 1.0 * inch, 1.0 * inch], repeatRows=1)
            col_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))
            story.append(col_table)
            story.append(Spacer(1, 8))
        elif section == "quality":
            story.append(Paragraph(heading, styles["H2Local"]))
            q = engine.quality["summary"]
            story.append(QualityBarFlowable(q["quality_score"], width=6.8 * inch, height=30))
            story.append(Paragraph(
                f"Quality score: <b>{q['quality_score']}/100</b> "
                f"({q['total_issues']} issues: {q['high']} high, {q['medium']} medium, {q['low']} low).",
                styles["Tight"],
            ))
            for issue in report.issues:
                story.append(Paragraph(f"• <b>[{issue['severity'].upper()}]</b> {_html(issue['title'])} — {_html(issue['detail'])}", styles["Tight"]))
        elif section == "insights":
            story.append(Paragraph(heading, styles["H2Local"]))
            if not insights:
                story.append(Paragraph("No significant patterns were detected in this dataset.", styles["Tight"]))
            for i in insights:
                story.append(KeepTogether([
                    Paragraph(f"<b>{_html(i['title'])}</b>", styles["Tight"]),
                    Paragraph(_html(i["detail"]), styles["Tight"]),
                ]))
                if i.get("numbers"):
                    parts = ", ".join(f"{_html(n['label'])}: <b>{_html(n['value'])}</b>" for n in i["numbers"])
                    story.append(Paragraph(parts, styles["Muted"]))
        elif section == "correlations":
            story.append(Paragraph(heading, styles["H2Local"]))
            if engine.strong_correlations:
                for p in engine.strong_correlations[:6]:
                    story.append(Paragraph(
                        f"• {_html(p['col_a'])} & {_html(p['col_b'])}: <b>{p['correlation']:.2f}</b> ({p['strength']})",
                        styles["Tight"],
                    ))
            else:
                story.append(Paragraph("No strong correlations were found between numeric columns.", styles["Tight"]))
        elif section == "charts":
            story.append(Paragraph(heading, styles["H2Local"]))
            if not charts:
                story.append(Paragraph("No suitable charts for this dataset.", styles["Tight"]))
            for chart in charts:
                flow = flowable_for_chart(chart, width=6.6 * inch, height=2.1 * inch)
                if flow is not None:
                    story.append(KeepTogether([flow, Spacer(1, 10)]))

    story.append(Spacer(1, 16))
    story.append(Paragraph(
        f"Generated by AutoData · {engine.summary['row_count']:,} rows × {engine.summary['column_count']} columns",
        styles["Muted"],
    ))
    def add_footer(canvas, document):
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#6b7280"))
        canvas.drawRightString(letter[0] - 0.85 * inch, 0.5 * inch, f"AutoData | {document.page}")

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    return buf.getvalue()


def _html(text: str) -> str:
    return html.escape(str(text))
