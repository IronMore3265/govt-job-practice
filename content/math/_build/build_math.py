# -*- coding: utf-8 -*-
"""Build the Real Numbers topic (Mathematics topic 1): note.html + note.pdf, question.md and answer.md.

Run:  python -X utf8 content/math/_build/build_math.py
Source of truth: content/math/01-real-numbers/src/*.txt (hand transcription of 'Math Pt 1.pdf', see qparse.py)
Needs: pip install playwright (+ Chromium). KaTeX is taken from app/node_modules/katex.
"""
import html as H
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                      # content/math
REPO = ROOT.parent.parent
OUT = ROOT / "01-real-numbers"
sys.path.insert(0, str(HERE))
from qparse import BNL, LET, parse  # noqa: E402

BN = "০১২৩৪৫৬৭৮৯"
FOOT = "MATHEMATICS - REAL NUMBERS - THE NOTE"
TOPIC_NO = 1
SEED = 20261106


def to_bn(s):
    return "".join(BN[int(c)] if c.isdigit() else c for c in str(s))


def has_bn(s):
    return any(c in BN for c in s)


def esc(s):
    return H.escape(s, quote=False)


def inline(s):
    parts = re.split(r"(\$[^$]+\$)", s)
    out = ""
    for p in parts:
        if len(p) > 2 and p.startswith("$") and p.endswith("$"):
            out += esc(p.replace("\\frac", "\\dfrac"))
        else:
            e = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", esc(p))
            out += e.replace("∴", "$\\therefore$").replace("≠", "$\\neq$")
    return out


# ---------------------------------------------------------------- special blocks (note html)
def fact_steps(n, factors):
    n = int(re.sub(r"\D", "", n)) if not str(n).isdigit() else int(n)
    vals = []
    cur = n
    for f in factors[:-1]:
        vals.append((f, cur))
        cur //= f
    return vals, cur


def fact_html(arg, bangla=True):
    n, fl = [x.strip() for x in arg.split("|", 1)]
    factors = [int(x) for x in fl.split(",")]
    nn = int(n)
    rows, last = fact_steps(nn, factors)
    cv = to_bn if bangla else str
    tr = "".join(f'<tr><td class="d">{cv(f)}</td><td class="v">{cv(v)}</td></tr>' for f, v in rows)
    tr += f'<tr><td class="d" style="border-right:0"></td><td>{cv(last)}</td></tr>'
    return f'<div class="fact"><table>{tr}</table></div>'


def div_html(arg):
    d, dd, q, prod, rem = [x.strip() for x in arg.split("|")]
    return ('<div class="ldiv"><table>'
            f'<tr><td class="l">{d}</td><td class="u" style="text-align:right">{dd}</td><td class="q">{q}</td></tr>'
            f'<tr><td></td><td class="u" style="text-align:right">{prod}</td><td></td></tr>'
            f'<tr><td></td><td style="text-align:right">{rem}</td><td></td></tr></table></div>')


def sqrtdiv_html(arg):
    pairs, root, steps = [x.strip() for x in arg.split("|")]
    st = [s.strip() for s in steps.split(";")]
    groups = "".join(f'<span class="ol">{g}</span>' for g in pairs.split())
    # decimal point glued to the first group, like the book
    rows = [f'<tr><td></td><td class="top" colspan="1">{groups}</td><td class="m">{root}</td></tr>']
    rows.append(f'<tr><td></td><td>{st[0]}</td><td class="m"></td></tr>')
    rest = st[1:-1]
    i = 0
    while i < len(rest):
        chunk = rest[i:i + 3]
        if len(chunk) == 3:
            rows.append(f'<tr><td>{chunk[1]}</td><td class="m" style="border-top:1.5px solid var(--ink)">{chunk[0]}</td><td></td></tr>')
            rows.append(f'<tr><td></td><td class="m">{chunk[2]}</td><td></td></tr>')
        else:
            for c in chunk:
                rows.append(f'<tr><td></td><td class="m">{c}</td><td></td></tr>')
        i += 3
    rows.append(f'<tr><td></td><td class="m" style="border-top:1.5px solid var(--ink)">{st[-1]}</td><td></td></tr>')
    return f'<div class="sqd"><table>{"".join(rows)}</table></div>'


def realtree_svg():
    def box(cx, cy, w, h, t, accent=False, vertical=False):
        x, y = cx - w / 2, cy - h / 2
        st = ' stroke="#FF6B1A" stroke-width="2.4"' if accent else ' stroke="#1C1A16" stroke-width="1.5"'
        r = f'<rect x="{x:.1f}" y="{y:.1f}" width="{w}" height="{h}" rx="7" fill="#FAF8F2"{st}/>'
        if vertical:
            return r.replace('rx="7"', 'rx="2"') + f'<text transform="translate({cx:.1f},{cy:.1f}) rotate(-90)" text-anchor="middle" dominant-baseline="central" font-size="12.5" font-weight="700">{t}</text>'
        return r + f'<text x="{cx}" y="{cy}" text-anchor="middle" dominant-baseline="central" font-size="12.5" font-weight="700">{t}</text>'

    def line(x1, y1, x2, y2, arrow=False):
        s = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#1C1A16" stroke-width="1.5"/>'
        if arrow:
            s += f'<path d="M{x2 - 4.5} {y2 - 8} L{x2} {y2} L{x2 + 4.5} {y2 - 8} Z" fill="#1C1A16"/>'
        return s

    p = []
    # connectors first
    p += [line(362, 71, 362, 95), line(222, 95, 499, 95), line(222, 95, 222, 131, True), line(499, 95, 499, 131, True)]
    p += [line(222, 171, 222, 196), line(99, 196, 398, 196), line(99, 196, 99, 229, True), line(398, 196, 398, 229, True)]
    p += [line(99, 269, 99, 292), line(73, 292, 238, 292), line(73, 292, 73, 322, True), line(152, 292, 152, 322, True), line(238, 292, 238, 322, True)]
    p += [line(73, 361, 73, 388), line(61, 388, 200, 388), line(61, 388, 61, 414, True), line(127, 388, 127, 414, True), line(200, 388, 200, 414, True)]
    p += [line(398, 269, 398, 292), line(335, 292, 447, 292), line(335, 292, 335, 322, True), line(447, 292, 447, 322, True)]
    p += [line(335, 361, 335, 388), line(283, 388, 356, 388), line(283, 388, 283, 418, True), line(356, 388, 356, 418, True)]
    p += [line(356, 457, 356, 483, True)]
    p += [line(447, 361, 447, 388), line(437, 388, 478, 388), line(437, 388, 437, 418, True), line(478, 388, 478, 482, True)]
    p += [line(519, 171, 519, 324, True)]
    # boxes
    p += [box(362, 49, 150, 44, "বাস্তব সংখ্যা", accent=True), box(222, 151, 68, 40, "মূলদ"), box(499, 151, 74, 40, "অমূলদ")]
    p += [box(99, 249, 62, 40, "পূর্ণ"), box(398, 249, 102, 40, "ভগ্নাংশ")]
    p += [box(73, 341, 78, 40, "ধনাত্মক"), box(152, 341, 56, 40, "শূন্য"), box(238, 341, 78, 40, "ঋণাত্মক")]
    p += [box(335, 341, 74, 40, "সাধারণ"), box(447, 341, 68, 40, "দশমিক")]
    p += [box(61, 435, 78, 40, "মৌলিক"), box(127, 435, 44, 40, "এক"), box(200, 435, 88, 40, "অমৌলিক")]
    p += [box(283, 437, 62, 40, "প্রকৃত"), box(356, 437, 74, 40, "অপ্রকৃত"), box(437, 437, 62, 40, "সসীম")]
    p += [box(358, 505, 48, 40, "মিশ্র"), box(447, 503, 99, 40, "অসীম আবৃত্ত")]
    p += [box(519, 421, 36, 196, "অসীম অনাবৃত্ত দশমিক", vertical=True)]
    return ('<div class="figbox"><svg viewBox="0 0 570 540" width="520" xmlns="http://www.w3.org/2000/svg" '
            'font-family="Noto Sans Bengali, Outfit, sans-serif" fill="#1C1A16">' + "".join(p) + "</svg></div>")


# ---------------------------------------------------------------- theory -> html
TABLE_W = {
    "রোমান প্রতীক": [140, 190, 140, 190],
    "ভাজক": [64, 270, 100, 230],
    "ক্রম": [60, 355, 250],
    "গাণিতিক চিহ্ন": [120, 200, 175, 170],
    "সীমা": [140, 290, 80, 155],
}


def table_html(head_line, rows):
    head = [h.strip() for h in head_line.split("|")]
    ncol = len(head)
    widths = TABLE_W.get(head[0]) or [665 // ncol] * ncol
    cols = "".join(f'<col style="width:{w}px">' for w in widths)
    th = "".join(f"<th>{inline(h)}</th>" for h in head)
    cells = [[c.strip() for c in r.split("|")] for r in rows]
    sub_idx = head.index("উপমোট") if "উপমোট" in head else None
    spans = {}
    if sub_idx is not None:
        last = -1
        for r, row in enumerate(cells):
            if len(row) > sub_idx and row[sub_idx]:
                spans[last + 1] = (r - last, row[sub_idx])
                last = r
    body = ""
    for r, row in enumerate(cells):
        tds = ""
        for j, c in enumerate(row):
            if sub_idx is not None and j == sub_idx:
                if r in spans:
                    n, txt = spans[r]
                    tds += f'<td class="num" rowspan="{n}">{inline(txt)}</td>'
                continue
            tds += f'<td class="strong">{inline(c)}</td>' if j == 0 else f"<td>{inline(c)}</td>"
        body += f"<tr>{tds}</tr>"
    return f'<table class="grid"><colgroup>{cols}</colgroup><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'


def theory_html(lines):
    out = []
    para = []
    i = 0

    def flush():
        if para:
            out.append("<p>" + "<br>".join(inline(x) for x in para) + "</p>")
            para.clear()

    while i < len(lines):
        l = lines[i]
        s = l.strip()
        if not s:
            flush(); i += 1; continue
        if s.startswith("@TABLE"):
            flush()
            rows = []
            j = i + 1
            while lines[j].strip() != "@ENDTABLE":
                rows.append(lines[j]); j += 1
            out.append(table_html(s[len("@TABLE"):].strip(), rows)); i = j + 1; continue
        if s.startswith("@FIG"):
            flush(); out.append(realtree_svg() if "realtree" in s else ""); i += 1; continue
        if s.startswith("@DIV"):
            flush()
            out.append(div_html(s[4:])); i += 1; continue
        if s.startswith("@SQRTDIV"):
            flush(); out.append(sqrtdiv_html(s[8:])); i += 1; continue
        if s.startswith("@FACT"):
            flush(); out.append(fact_html(s[5:], True)); i += 1; continue
        if s.startswith(">"):
            flush()
            q = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                q.append(lines[i].strip()[1:].strip()); i += 1
            body = []
            lab = ""
            ul = []
            for x in q:
                if not x:
                    continue
                if x.startswith("- "):
                    ul.append(x[2:])
                    continue
                if ul:
                    body.append("<ul>" + "".join(f"<li>{inline(u)}</li>" for u in ul) + "</ul>"); ul = []
                m = re.fullmatch(r"\*\*(.+)\*\*", x)
                if m and not lab:
                    lab = f'<span class="label">{esc(m.group(1))}</span>'
                else:
                    body.append(f"<p>{inline(x)}</p>")
            if ul:
                body.append("<ul>" + "".join(f"<li>{inline(u)}</li>" for u in ul) + "</ul>")
            if lab:
                out.append(f'<div class="sbox orange">{lab}{"".join(body)}</div>')
            else:
                out.append(f'<div class="callout">{"".join(body)}</div>')
            continue
        if s.startswith("- "):
            flush()
            ul = []
            while i < len(lines) and lines[i].strip().startswith("- "):
                ul.append(lines[i].strip()[2:]); i += 1
            out.append('<div class="sbox"><ul>' + "".join(f"<li>{inline(u)}</li>" for u in ul) + "</ul></div>")
            continue
        m = re.fullmatch(r"\*\*([^*]+)\*\*", s)
        if m:
            flush(); out.append(f"<h3>{inline(m.group(1))}</h3>"); i += 1; continue
        para.append(l)
        i += 1
    flush()
    return "".join(out)


def page(num, title, tagline, body, pn=0, sec=""):
    head = ""
    if title:
        head = (f'<h1 class="pt"><span class="n">{num}</span><span>{title}</span></h1>'
                f'<div class="tagline">{tagline}</div>')
    return (f'<section class="page" data-sec="{sec}">{head}{body}'
            f'<div class="footer"><span>{FOOT}</span><span class="pn">{pn}</span></div></section>')


def cover(sections):
    rows = "".join(
        f'<div class="li" data-sec="{s["id"]}"><span class="n">{to_bn(s["id"])}</span><span class="nm">{esc(s["title"])}</span><span class="nt"></span></div>'
        for s in sections)
    return ('<section class="page cover" data-sec="0">'
            '<span class="label">MATHEMATICS &middot; TOPIC 1</span>'
            '<h1 style="font-size:62px;line-height:1.35;font-weight:700;margin:6px 0 2px">বাস্তব <span class="acc">সংখ্যা</span></h1>'
            '<div style="font-size:30px;font-weight:600;margin-bottom:6px">Real Numbers</div>'
            '<div class="tagline" style="max-width:600px">অঙ্ক ও সংখ্যা, বিভাজ্যতা, জোড় ও বিজোড়, মৌলিক সংখ্যা, মূলদ ও অমূলদ, বর্গ ও বর্গমূল, ঘনমূল এবং সংখ্যা বিষয়ক সমস্যার সূত্র। পরীক্ষায় বসার আগে বইয়ের মতো পড়ে নিন।</div>'
            f'<div class="cl">{rows}</div>'
            f'<div class="footer"><span>{FOOT}</span><span class="pn">1</span></div></section>')


DOUBT_NOTES = [
    ("১.১", "'১ থেকে ১০০ পর্যন্ত গণনা করলে কতটি ৫ পাওয়া যায়' প্রশ্নে বইয়ে উত্তর ছাপা নেই। সঠিক উত্তর ২০টি, যা কোনো অপশনে নেই।"),
    ("১.২", "'১০০ এর চেয়ে ছোট কতটি ধনাত্মক পূর্ণসংখ্যাকে ১৩ দিয়ে ভাগ করলে ২ অবশিষ্ট থাকে' প্রশ্নে বইয়ের উত্তর ৭টি। ২ কে ১৩ দিয়ে ভাগ করলেও ভাগশেষ ২ থাকে, তাই ২ সহ ৮টি হতে পারে।"),
    ("১.৩", "'(m + p)m জোড় হলে কোনটি অবশ্যই সত্য' প্রশ্নে বইয়ের উত্তর 'm জোড় হলে p বিজোড়'। কিন্তু m বিজোড় হলে (m + p) জোড় হতে হয়, তাই 'm বিজোড় হলে p বিজোড়' সবসময় সত্য।"),
    ("১.৩", "'তিনটি স্বাভাবিক ক্রমিক সংখ্যার গুণফল সর্বদাই কোন সংখ্যা দ্বারা বিভাজ্য' প্রশ্নে বইয়ের উত্তর ২। কিন্তু গুণফল ৩ এবং ৬ দ্বারাও সবসময় বিভাজ্য হয়।"),
    ("১.৪", "'৪১ হতে ১০০ পর্যন্ত মৌলিক সংখ্যা কয়টি' প্রশ্নে বইয়ের উত্তর ১২ (৪১ বাদ দিয়ে গোনা হয়েছে)। ৪১ সহ গুনলে ১৩টি হয়।"),
    ("১.৫", "'$\\sqrt{২৮৯}$ এর বর্গমূল হলো' প্রশ্নে বইয়ের উত্তরমালায় তিনটি উত্তর (মূলদ, স্বাভাবিক, পূর্ণসংখ্যা) দেওয়া আছে।"),
    ("১.৫", "'নীচের কোনটি অমূলদ সংখ্যা' (৪০তম বিসিএস) প্রশ্নে বইয়ে উত্তর ছাপা নেই। চারটি অপশনই মূলদ।"),
    ("১.৬", "'নিচের কোন সংখ্যাটি পূর্ণবর্গ নয়' (২১৮৭, ৭৮১২৫, ১৬২৮৪, ৩১২৫) প্রশ্নে বইয়ের উত্তর ২১৮৭। কিন্তু চারটি সংখ্যার কোনোটিই পূর্ণবর্গ নয়।"),
    ("১.৭", "'০.০০৯ এর বর্গমূল কত' প্রশ্নে বইয়ে উত্তর ছাপা নেই। বইয়ের হিসাবে আসন্ন মান ০.০৯৪, যা কোনো অপশনের সাথে মেলে না।"),
]


def doubt_page_html():
    li = "".join(f"<li><b>{a}:</b> {inline(t)}</li>" for a, t in DOUBT_NOTES)
    return ('<div class="sbox orange"><span class="label">সতর্কতা</span>'
            '<p>নিচের প্রশ্নগুলোতে বইয়ের নিজস্ব উত্তরমালায় সমস্যা আছে। প্রশ্নগুলো বইয়ের মতোই রাখা হয়েছে, ব্যাখ্যায় সমস্যাটি লেখা আছে।</p>'
            f'<ul>{li}</ul></div>'
            '<div class="callout"><b>আরও একটি কথা:</b> ১.১ এর ১৮ নং প্রশ্নের সমাধানে বইয়ে "বিয়োগফল" ছাপা আছে, কিন্তু প্রশ্নে যোগফল চাওয়া হয়েছে (৪৩২১০ + ১০২৩৪ = ৫৩৪৪৪)। ১.৩ এর ২৭ নং প্রশ্নের শেষ অপশনে বইয়ে "wx + 1" ছাপা আছে, সেটি 2x + 1 ধরা হয়েছে।</div>')


def build_html(sections):
    pages = [cover(sections)]
    for s in sections:
        body = ""
        first = True
        for kind, val in s["blocks"]:
            if kind == "sub":
                body += f'<h3 class="sub">{inline(val)}</h3>'
            else:
                body += theory_html(val)
        tag = {
            "1.1": "অঙ্ক, সংখ্যা, স্থানীয় মান, বাস্তব সংখ্যার শ্রেণিবিন্যাস ও রোমান গণনা।",
            "1.2": "ভাজ্য, ভাজক, ভাগশেষ আর কোন সংখ্যা কখন নিঃশেষে বিভাজ্য।",
            "1.3": "জোড় ও বিজোড় সংখ্যার ধর্ম এবং গাণিতিক অপারেশনের ফলাফল।",
            "1.4": "গুণনীয়ক, মৌলিক সংখ্যা, সহমৌলিক, মৌলিক দ্বিজোট ও ১০০ থেকে ২০০ পর্যন্ত তালিকা।",
            "1.5": "মূলদ ও অমূলদ সংখ্যা আর তাদের মধ্যে গাণিতিক অপারেশন।",
            "1.6": "বর্গ, পূর্ণবর্গ সংখ্যা, করণী ও বর্গ নির্ণয়ের নিয়ম।",
            "1.7": "বর্গমূল ও ঘনমূল নির্ণয়ের পদ্ধতি।",
            "1.8": "ক্রমিক সংখ্যা, সমষ্টি ও অন্তরের শর্টকাট সূত্র এবং সংখ্যা বিষয়ক সমস্যা।",
            "1.9": "দুটি বা তিনটি সংখ্যার শর্ত থেকে সংখ্যা নির্ণয়।",
        }[s["id"]]
        title = f'{esc(s["title"].split(" (")[0])}'
        eng = re.search(r"\(([^)]+)\)", s["title"])
        if eng:
            title += f' <span style="font-size:15px;font-weight:600;color:var(--muted)">({esc(eng.group(1))})</span>'
        pages.append(page(to_bn(s["id"]), title, tag, body, 0, s["id"]))
    pages.append(page("সতর্কতা", "বইয়ের <span class='acc'>উত্তরমালা</span> থেকে", "যে প্রশ্নের উত্তর নিয়ে সন্দেহ আছে।", doubt_page_html(), 0, "x"))
    css = "../../app/node_modules/katex/dist/katex.min.css"
    return ('<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>বাস্তব সংখ্যা</title><link rel="stylesheet" href="KATEXCSS"><link rel="stylesheet" href="GUIDECSS"></head><body>'
            + "".join(pages) + "</body></html>"), css


LAYOUT_JS = r"""() => {
  const LIMIT = 1064;
  const BN = '০১২৩৪৫৬৭৮৯';
  const toBn = n => String(n).split('').map(c => BN[+c]).join('');
  const rel = (el, page) => el.getBoundingClientRect().bottom - page.getBoundingClientRect().top;
  const pages = () => [...document.querySelectorAll('.page')];
  function newPageAfter(p) {
    const np = document.createElement('section');
    np.className = 'page';
    np.setAttribute('data-sec', p.getAttribute('data-sec') || '');
    np.appendChild(p.querySelector('.footer').cloneNode(true));
    p.after(np);
    return np;
  }
  function emptyLike(tbl) {
    const c = tbl.cloneNode(false);
    const cg = tbl.querySelector('colgroup'); if (cg) c.appendChild(cg.cloneNode(true));
    if (tbl.tHead) c.appendChild(tbl.tHead.cloneNode(true));
    c.appendChild(document.createElement('tbody'));
    return c;
  }
  function firstOver(rows, page) { const k = rows.findIndex(r => rel(r, page) > LIMIT); return k < 0 ? rows.length : k; }
  for (let pi = 0; pi < pages().length; pi++) {
    const page = pages()[pi];
    if (page.classList.contains('cover')) continue;
    const f = page.querySelector('.footer');
    const kids = [...page.children].filter(c => c !== f);
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      if (rel(el, page) <= LIMIT) continue;
      let toMove = null;
      if (el.matches('table.grid') && !el.querySelector('[rowspan]')) {
        const rows = [...el.tBodies[0].rows]; const k = firstOver(rows, page);
        if (k > 0 && k < rows.length) { const c = emptyLike(el); rows.slice(k).forEach(r => c.tBodies[0].appendChild(r)); toMove = [c, ...kids.slice(i + 1)]; }
      } else if (el.matches('.sbox') && el.querySelector('ul')) {
        const ul = el.querySelector('ul'); const lis = [...ul.children]; const k = firstOver(lis, page);
        if (k > 0 && k < lis.length) { const c = el.cloneNode(false); const u = document.createElement('ul'); c.appendChild(u); lis.slice(k).forEach(l => u.appendChild(l)); toMove = [c, ...kids.slice(i + 1)]; }
      }
      if (!toMove) {
        let s = i; if (s > 0 && kids[s - 1].matches('h3')) s -= 1;
        if (s === 0) continue;
        toMove = kids.slice(s);
      }
      const np = newPageAfter(page);
      toMove.forEach(n => np.insertBefore(n, np.querySelector('.footer')));
      break;
    }
  }
  pages().forEach((p, i) => { const pn = p.querySelector('.footer .pn'); if (pn && !p.classList.contains('cover')) pn.textContent = String(i + 1); });
  const first = {};
  pages().forEach((p, i) => { const t = p.getAttribute('data-sec'); if (t && !(t in first)) first[t] = i + 1; });
  document.querySelectorAll('.cover .li[data-sec]').forEach(li => { const n = first[li.dataset.sec]; if (n) li.querySelector('.nt').textContent = 'পৃষ্ঠা ' + toBn(n); });
  return pages().map((p, i) => { const f = p.querySelector('.footer'); const kids = [...p.children].filter(c => c !== f); const last = kids[kids.length - 1]; return [i + 1, p.getAttribute('data-sec'), Math.round(last.getBoundingClientRect().bottom - p.getBoundingClientRect().top), p.innerText]; });
}
"""


def render_note(sections):
    from playwright.sync_api import sync_playwright
    html, katex_css = build_html(sections)
    tmp = ROOT / "_tmp_note.html"
    tmp.write_text(html.replace("KATEXCSS", katex_css).replace("GUIDECSS", "_build/guide.css"), encoding="utf-8")
    katex_js = (REPO / "app/node_modules/katex/dist/katex.min.js").resolve().as_uri()
    auto_js = (REPO / "app/node_modules/katex/dist/contrib/auto-render.min.js").resolve().as_uri()
    with sync_playwright() as pw:
        try:
            b = pw.chromium.launch()
        except Exception:
            import glob
            import os
            exe = glob.glob(os.path.expanduser("~/AppData/Local/ms-playwright/chromium-*/chrome-win*/chrome.exe"))
            b = pw.chromium.launch(executable_path=exe[0])
        pg = b.new_page(viewport={"width": 900, "height": 1200})
        pg.goto(tmp.resolve().as_uri())
        pg.add_script_tag(url=katex_js)
        pg.add_script_tag(url=auto_js)
        pg.evaluate("""() => renderMathInElement(document.body, {delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}], throwOnError:false, strict:'ignore'})""")
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(900)
        info = pg.evaluate(LAYOUT_JS)
        final = "<!doctype html>\n" + pg.evaluate("document.documentElement.outerHTML")
        final = final.replace("_build/guide.css", "../_build/guide.css").replace("../../app/node_modules", "../../../app/node_modules")
        OUT.mkdir(exist_ok=True)
        (OUT / "note.html").write_text(final, encoding="utf-8")
        pg.pdf(path=str(OUT / "note.pdf"), width="793.33px", height="1122.67px", print_background=True,
               margin=dict(top="0", right="0", bottom="0", left="0"))
        b.close()
    tmp.unlink()
    return info


# ---------------------------------------------------------------- questions
EXPL = {
    ("1.1", 1): "শূন্যসহ সকল ধনাত্মক ও ঋণাত্মক অখণ্ড সংখ্যাসমূহকে পূর্ণসংখ্যা (Integer) বলা হয়। যেমন ...... - ৩, - ২, - ১, ০, ১, ২, ৩, ....... ইত্যাদি।",
    ("1.2", 1): "যে রাশিকে ভাগ করা হয়, তাকে ভাজ্য বলে। যে রাশি দ্বারা ভাগ করা হয় তাকে ভাজক এবং ভাগ করার পর যে সংখ্যাটি অবশিষ্ট থাকে তাকে ভাগশেষ বলে।",
    ("1.2", 2): "ভাজ্য = ভাজক × ভাগফল + ভাগশেষ। যেমন ১৪ = ৩ × ৪ + ২।",
    ("1.4", 13): "১ থেকে ১০০ পর্যন্ত মৌলিক সংখ্যা সর্বমোট ২৫টি (১ থেকে ৫০ এর মধ্যে ১৫টি এবং ৫১ থেকে ১০০ এর মধ্যে ১০টি)। কৌশল: ৪৪২২৩২২৩২১।",
    ("1.5", 2): "যে সংখ্যাকে $\\frac{p}{q}$ আকারে (p ও q পূর্ণসংখ্যা এবং q ≠ ০) প্রকাশ করা যায় না, তাকে অমূলদ সংখ্যা বলা হয়।",
    ("1.5", 23): "(i) বইয়ের সারণি অনুযায়ী দুটি ভিন্ন অমূলদ সংখ্যার গুণ অমূলদ, (ii) ০ একটি মূলদ সংখ্যা, (iii) পূর্ণবর্গ নয় এমন পূর্ণসংখ্যার বর্গমূল অমূলদ। বইয়ের উত্তর (i), (ii), (iii)।",
}

NEW = [
    ("1.1", "গণিতে মোট কয়টি অঙ্ক রয়েছে?", "১০টি", ["৮টি", "৯টি", "১২টি"], "বইয়ের মতে গণিতে মোট ১০টি অঙ্ক রয়েছে: ০, ১, ২, ৩, ৪, ৫, ৬, ৭, ৮ এবং ৯।", "অঙ্ক সার্থক হিসাবনিকাশ"),
    ("1.1", "৫৬২৭ সংখ্যায় হাজার স্থানীয় অঙ্ক কোনটি?", "৫", ["৬", "২", "৭"], "ডানদিক থেকে চতুর্থ স্থান হাজার। ৫৬২৭ সংখ্যায় একক স্থানীয় অঙ্ক ৭, দশক স্থানীয় অঙ্ক ২, শতক স্থানীয় অঙ্ক ৬ এবং হাজার স্থানীয় অঙ্ক ৫।", "দেশীয় রীতিতে ঘরগুলোর মান হাজার"),
    ("1.1", "রোমান সংখ্যা IV এর মান কত?", "৪", ["৬", "৫", "১৪"], "বৃহত্তম সংখ্যাবাচক বর্ণের পূর্বের বর্ণ বিয়োগ করা হয়। তাই IV = ৫ - ১ = ৪।", "রোমান গণনা পদ্ধতি বিয়োগ"),
    ("1.1", "রোমান গণনা পদ্ধতিতে D এর সংখ্যাসূচক মান কত?", "৫০০", ["৫০", "১০০", "১০০০"], "বইয়ের সারণি অনুযায়ী I = ১, V = ৫, X = ১০, L = ৫০, C = ১০০, D = ৫০০ এবং M = ১০০০।", "রোমান গণনা পদ্ধতি সংখ্যাসূচক"),
    ("1.2", "কোনো সংখ্যা ১২ দ্বারা নিঃশেষে বিভাজ্য হতে হলে সংখ্যাটি কোন দুই সংখ্যা দ্বারা বিভাজ্য হতে হবে?", "৩ ও ৪", ["২ ও ৬", "২ ও ৩", "৫ ও ৭"], "১২ দ্বারা বিভাজ্য হওয়ার শর্ত: সংখ্যাটি ৩ ও ৪ দ্বারা বিভাজ্য। যেমন ৪৮, ৩ ও ৪ দ্বারা বিভাজ্য।", "বিভাজ্যতা নির্ণয় নিঃশেষে বিভাজ্য"),
    ("1.2", "যে সংখ্যার শেষ অঙ্ক ০ বা ৫, সেই সংখ্যা সবসময় কোন সংখ্যা দ্বারা নিঃশেষে বিভাজ্য?", "৫", ["২", "৩", "৯"], "৫ দ্বারা বিভাজ্য হওয়ার শর্ত: শেষের অঙ্কটি ০ (শূন্য) বা ৫। যেমন ২২৫ এর শেষ অঙ্ক ৫।", "বিভাজ্যতা নির্ণয় নিঃশেষে বিভাজ্য"),
    ("1.3", "বিজোড় সংখ্যাকে কোন রাশি দ্বারা সূচিত করা হয় (n যেকোনো পূর্ণসংখ্যা)?", "২n + ১", ["২n", "n + ১", "৩n"], "জোড় সংখ্যাকে ২n এবং বিজোড় সংখ্যাকে ২n + ১ দ্বারা সূচিত করা হয়।", "বিজোড় সংখ্যাকে সূচিত"),
    ("1.3", "জোড় সংখ্যা × বিজোড় সংখ্যা = ?", "জোড় সংখ্যা", ["বিজোড় সংখ্যা", "ভগ্নাংশ", "অমূলদ সংখ্যা"], "জোড় × বিজোড় = জোড়। যেমন ৪ × ৩ = ১২ (জোড়)।", "জোড় বিজোড় অপারেশন ফলাফল"),
    ("1.4", "১ থেকে ১০০ পর্যন্ত মৌলিক দ্বিজোট কয়টি?", "৮টি", ["৬টি", "১০টি", "১৫টি"], "দুটি মৌলিক সংখ্যার অন্তর ২ হলে তাদের মৌলিক দ্বিজোট বলে। বইয়ে বলা আছে ১ থেকে ১০০ পর্যন্ত মৌলিক দ্বিজোট ৮টি এবং ১ থেকে ২০০ পর্যন্ত ১৫টি।", "মৌলিক দ্বিজোট"),
    ("1.4", "১ থেকে ১০০০ পর্যন্ত মৌলিক সংখ্যা কয়টি?", "১৬৮টি", ["১৭৫টি", "১৫০টি", "৯৫টি"], "মনে রাখা ভালো: ১ থেকে ৫০০ পর্যন্ত মৌলিক সংখ্যা ৯৫টি, ১ থেকে ১০০০ পর্যন্ত ১৬৮টি এবং ১ থেকে ৫০০০ পর্যন্ত ৬৬৯টি।", "মনে রাখা ভালো মৌলিক সংখ্যা"),
    ("1.5", "দশমিকের পরের ঘরগুলো ভিন্ন ভিন্ন আকারে অসীম হলে সংখ্যাটি কেমন হয়?", "অমূলদ", ["মূলদ", "পূর্ণ", "স্বাভাবিক"], "দশমিকের পরের ঘরগুলো যদি ভিন্ন ভিন্ন আকারে অসীম হয়, তবে সংখ্যাটি অমূলদ। যেমন ৫.৩৫৭৬ ...", "দশমিকের পরের ঘরগুলো ভিন্ন অসীম অমূলদ"),
    ("1.5", "$\\sqrt{৩} - \\sqrt{৩}$ কোন ধরনের সংখ্যা?", "মূলদ", ["অমূলদ", "মৌলিক", "ঋণাত্মক"], "দুটি অভিন্ন অমূলদ সংখ্যার বিয়োগফল $\\sqrt{৩} - \\sqrt{৩} = ০$, যা মূলদ সংখ্যা।", "দুটি অভিন্ন অমূলদ সংখ্যার গাণিতিক অপারেশন"),
    ("1.6", "নিচের কোন অঙ্কটি কোনো পূর্ণবর্গ সংখ্যার একক স্থানীয় অঙ্ক হতে পারে না?", "৭", ["১", "৪", "৬"], "পূর্ণবর্গ সংখ্যার একক স্থানীয় অঙ্ক ০, ১, ৪, ৫, ৬ বা ৯ হয়। ২, ৩, ৭ বা ৮ হতে পারে না।", "পূর্ণবর্গ সংখ্যার একক স্থানীয় অঙ্ক"),
    ("1.6", "কোনো বিজোড় স্বাভাবিক সংখ্যার বর্গকে ৮ দ্বারা ভাগ করলে প্রতিক্ষেত্রে ভাগশেষ কত হয়?", "১", ["০", "৩", "৭"], "বইয়ে বলা আছে, কোনো বিজোড় স্বাভাবিক সংখ্যার বর্গকে ৮ দ্বারা ভাগ করলে প্রতিক্ষেত্রে ভাগশেষ ১ হয়। যেমন $৩^২ = ৯$, ৯ ÷ ৮ এর ভাগশেষ ১।", "বিজোড় স্বাভাবিক সংখ্যার বর্গকে ৮ দ্বারা ভাগ"),
    ("1.7", "কোনো ঘনের একক স্থানীয় অঙ্ক ৩ হলে তার ঘনমূলের একক স্থানীয় অঙ্ক কত হবে?", "৭", ["৩", "২", "৮"], "ঘনের একক স্থানীয় অঙ্ক ২, ৩, ৭, ৮ হলে ঘনমূলের একক স্থানীয় অঙ্ক যথাক্রমে ৮, ৭, ৩, ২ হয়। তাই ৩ হলে ৭। যেমন $৭^৩ = ৩৪৩$।", "ঘনমূল নির্ণয় একক স্থানীয় অঙ্ক"),
    ("1.8", "দুটি সংখ্যার সমষ্টি ও অন্তর জানা থাকলে বড় সংখ্যা নির্ণয়ের সূত্র কোনটি?", "$\\frac{\\text{সমষ্টি} + \\text{অন্তর}}{২}$", ["$\\frac{\\text{সমষ্টি} - \\text{অন্তর}}{২}$", "সমষ্টি × অন্তর", "সমষ্টি ÷ অন্তর"], "বড় সংখ্যা = $\\frac{\\text{সংখ্যাদ্বয়ের সমষ্টি} + \\text{সংখ্যাদ্বয়ের অন্তর}}{২}$ এবং ছোট সংখ্যা = $\\frac{\\text{সংখ্যাদ্বয়ের সমষ্টি} - \\text{সংখ্যাদ্বয়ের অন্তর}}{২}$।", "দুটি সংখ্যার সমষ্টি এবং অন্তর জানা থাকলে বড় সংখ্যা"),
]


def sec_label(sid):
    return to_bn(sid)


def conv_special(line, bangla):
    """Turn @LONGDIV/@SQRTDIV/@FACT markers (possibly after some text) into plain explanation text."""
    m = re.search(r"@(LONGDIV|SQRTDIV|FACT)\s+(.*)$", line)
    if not m:
        return line
    pre = line[:m.start()]
    kind, arg = m.group(1), m.group(2)
    parts = [x.strip() for x in arg.split("|")]
    cv = to_bn if bangla else str
    if kind == "LONGDIV":
        d, n, q, steps = parts
        st = [x.strip() for x in steps.split(",")]
        txt = f"ভাগ করে পাই: {n} কে {d} দিয়ে ভাগ করলে ভাগফল {q}, ভাগশেষ {st[-1]} (ভাগের ধাপ: {', '.join(st)})"
    elif kind == "SQRTDIV":
        pairs, root, steps = parts
        st = [x.strip() for x in steps.split(";")]
        txt = f"ভাগ পদ্ধতিতে বর্গমূল: {pairs} এর বর্গমূল {root}; ভাগের ধাপগুলো ক্রমানুসারে: {' → '.join(st)}"
    else:
        n, fl = parts
        factors = [int(x) for x in fl.split(",")]
        rows, last = fact_steps(n, factors)
        steps = ", ".join(f"{cv(v)} ÷ {cv(f)} = {cv(v // f)}" for f, v in rows)
        prod = " × ".join(cv(f) for f in factors)
        txt = f"মৌলিক উৎপাদক: {cv(int(n))} = {prod} (ক্রমিক ভাগ: {steps})"
    return pre + txt


def build_questions(sections, qs, page_of):
    rnd = random.Random(SEED)
    items = []   # dict per question in final order
    by_sec = {}
    for q in qs:
        by_sec.setdefault(q.sec, []).append(q)
    new_by_sec = {}
    for n in NEW:
        new_by_sec.setdefault(n[0], []).append(n)
    n_new = 0
    for s in sections:
        for q in by_sec.get(s["id"], []):
            stem = " ".join(x.strip() for x in q.stem)
            opts = [(L, t) for L, t in q.opts]
            body = stem + " " + " ".join(t for _, t in opts) + " ".join(q.sol)
            bangla_ctx = has_bn(stem + " ".join(t for _, t in opts))
            sol = [conv_special(l, bangla_ctx) for l in q.sol]
            if (q.sec, q.n) in EXPL:
                sol = [EXPL[(q.sec, q.n)]]
            src = q.source.replace(" : ", ": ")
            tag = "বিগত পরীক্ষা (বইয়ের উত্তরমালা, সন্দেহযুক্ত)" if (q.doubt or not q.answer_letter) else "বিগত পরীক্ষা"
            items.append(dict(sec=q.sec, stem=stem, opts=opts, ans=q.answer_letter or "", raw_ans=q.ans, sol=sol,
                              source=f"{tag}: {src}", new=False, doubt=q.doubt or not q.answer_letter, key=(q.sec, q.n)))
        for (sec, stem, good, bad, expl, kw) in new_by_sec.get(s["id"], []):
            choices = [good] + list(bad)
            rnd.shuffle(choices)
            letters = "ABCD"
            opts = [(letters[i], c) for i, c in enumerate(choices)]
            ans = letters[choices.index(good)]
            items.append(dict(sec=sec, stem=stem, opts=opts, ans=ans, raw_ans=ans, sol=[expl], source="নতুন প্রশ্ন", new=True,
                              doubt=False, key=("new", kw)))
            n_new += 1
    assert len(items) % 20 == 0, f"{len(items)} questions is not a multiple of 20"
    return items


def write_md(sections, items, page_of):
    secs = {s["id"]: s for s in sections}
    qlines = ["---", "subject: Mathematics", f"topic: {TOPIC_NO}", "lang: bn", "---", "",
              "# বাস্তব সংখ্যা (Real Numbers)", ""]
    alines = ["# বাস্তব সংখ্যা (Real Numbers): উত্তর ও ব্যাখ্যা", ""]
    quick = []
    cur = None
    seen = {}
    for i, it in enumerate(items, start=1):
        # the importer skips a question whose text already exists, so a repeated stem gets a number in brackets
        k = re.sub(r"\s+", " ", it["stem"]).strip().casefold()
        seen[k] = seen.get(k, 0) + 1
        if seen[k] > 1:
            it["stem"] = f"{it['stem']} ({to_bn(seen[k])})"
        if it["sec"] != cur:
            cur = it["sec"]
            h = f"## {to_bn(cur)} {secs[cur]['title']}"
            qlines += [h, ""]
            alines += [h, ""]
        no_bangla = not re.search(r"[ঀ-৿]", it["stem"])
        qh = f"### Q{i}. {it['stem']}"
        qlines += [qh, ""]
        for L, t in it["opts"]:
            qlines.append(f"- {L}. {t}")
        if no_bangla:
            qlines += ["", "**Lang:** en"]
        qlines += ["", "---", ""]
        if it["ans"]:
            ans = it["ans"]
        else:
            ans = f"(বইয়ে উত্তর দেওয়া নেই)"
        quick.append(f"Q{i}: {ans}")
        pg = page_of(it)
        alines += [qh, "", f"**উত্তর:** {ans}", "", "**ব্যাখ্যা:** " + "\n".join(it["sol"]) if it["sol"] else "**ব্যাখ্যা:** (বইয়ে সমাধান দেওয়া নেই)", "",
                   f"**পৃষ্ঠা:** {pg}", "", f"**উৎস:** {it['source']}", "", "---", ""]
    (OUT / "question.md").write_text("\n".join(qlines).rstrip() + "\n", encoding="utf-8")
    key = ["## দ্রুত উত্তরমালা", "", "  ".join(quick), "", "---", ""]
    head = alines[0:2]
    (OUT / "answer.md").write_text("\n".join(head + key + alines[2:]).rstrip() + "\n", encoding="utf-8")


def make_page_of(info, sections):
    # info: [(page_no, sec, bottom, text)]
    def toks(s):
        s = re.sub(r"\$[^$]*\$", " ", s)
        return set(re.findall(r"[ঀ-৿A-Za-z]{3,}", s))
    pages = [(p, sec, toks(txt)) for p, sec, _, txt in info]

    def page_of(it):
        cand = [(p, t) for p, sec, t in pages if sec == it["sec"]]
        if not cand:
            return 2
        if it["new"]:
            kw = toks(it["key"][1])
        else:
            good = next((t for L, t in it["opts"] if L == (it["ans"] or "A")), "")
            kw = toks(it["stem"] + " " + good + " " + " ".join(it["sol"][:2]))
        best = max(cand, key=lambda c: (len(kw & c[1]), -c[0]))
        return best[0]
    return page_of


def main():
    sections, qs = parse()
    info = render_note(sections)
    print(len(info), "note pages; content bottoms (limit 1070):", [(p, b) for p, _, b, _ in info])
    print("too long:", [(p, b) for p, _, b, _ in info if b > 1070])
    items = build_questions(sections, qs, None)
    write_md(sections, items, make_page_of(info, sections))
    print(len(items), "questions written")


if __name__ == "__main__":
    main()
