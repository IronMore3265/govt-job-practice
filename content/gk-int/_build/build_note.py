# -*- coding: utf-8 -*-
"""Build the note for General Knowledge - International, topic 1 "বিশ্বের সাম্প্রতিক ও চলমান ঘটনাপ্রবাহ - ১".

Source book: GK Int Pt 1.pdf (George's MP3 আন্তর্জাতিক, book pages ক-২ to ক-৩২, a scan with no text layer, transcribed by hand
into src/s01.txt ... s10.txt). Run:  python content/gk-int/_build/build_note.py   (needs: pip install playwright, Chromium)
Writes content/gk-int/01-bishwer-samprotik-cholman-ghotonaprobah-1/note.html and note.pdf (PDFs are git-ignored).
Shares helpers and the stylesheet with content/bangla/_build. Pages are laid out automatically (tables and lists split over pages);
every page carries data-ch (the chapter it teaches), which build_questions.py uses to find each question's note page.

src text format (one stream, files read in name order):
  # Title            new chapter (starts a new page)      ## Title   orange-square heading      ### Title   small heading
  plain line         paragraph                            - text     bullet (consecutive bullets form one box)
  || a | b | c       table header row, then | x | y | z rows
  !BOX title         small framed table, rows start with |
  !LIST ink|orange title   boxed bullet list, items start with -
  **x**              bold
"""
import html as _html
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
BANGLA = HERE.parent.parent / "bangla" / "_build"
sys.path.insert(0, str(BANGLA))
import build_notes as bn  # noqa: E402
from build_notes import doc, page  # noqa: E402

SRC = HERE / "src"
OUT = HERE.parent
FOLDER = "01-bishwer-samprotik-cholman-ghotonaprobah-1"
F = "GENERAL KNOWLEDGE INTERNATIONAL - THE NOTE"
BN = "০১২৩৪৫৬৭৮৯"

# chapter number -> (title html, tagline). Chapter order = order of the "# " lines in the sources; the last one (0) is the key page.
CHAPTERS = [
    (1, "রাজনৈতিক <span class='acc'>পরিক্রমা</span>", "যুক্তরাষ্ট্র, যুক্তরাজ্য, ভারত থেকে বিশ্বের নেতারা, সামরিক অভ্যুত্থান ও গৃহযুদ্ধ।"),
    (2, "আন্তর্জাতিক <span class='acc'>নিরাপত্তা</span> ও ক্ষমতা সম্পর্ক", "ইউক্রেন, গাজা, ইরান, ভারত-পাকিস্তান: যুদ্ধ, যুদ্ধবিরতি আর কূটনীতি।"),
    (3, "রিপোর্ট ও <span class='acc'>সমীক্ষা</span>", "জনসংখ্যা, মানব উন্নয়ন, দুর্নীতি, বৈশ্বিক সূচক আর ফোর্বস।"),
    (4, "সংস্থা ও <span class='acc'>সংগঠন</span>", "আন্তর্জাতিক সংস্থার শীর্ষ পদাধিকারী, শীর্ষ সম্মেলন আর জাতিসংঘের তথ্য।"),
    (5, "সংস্থার <span class='acc'>সদস্যপদ</span>", "কোন সংস্থার কত সদস্য আর সর্বশেষ সদস্য কে।"),
    (6, "দিবস <span class='acc'>প্রতিপাদ্য</span> ২০২৬", "আন্তর্জাতিক দিবসগুলোর এ বছরের প্রতিপাদ্য।"),
    (0, "বইয়ের <span class='acc'>উত্তরমালা</span> থেকে", "যে তথ্য শুধু বইয়ের উত্তরমালায় আছে আর যেগুলোর উত্তর নিয়ে সন্দেহ।"),
]
CH_TITLE_PLAIN = {1: "রাজনৈতিক পরিক্রমা", 2: "আন্তর্জাতিক নিরাপত্তা ও আন্তঃরাষ্ট্রীয় ক্ষমতা সম্পর্ক", 3: "রিপোর্ট ও সমীক্ষা", 4: "সংস্থা ও সংগঠন",
                  5: "সংস্থা- সংগঠনের সদস্যপদ", 6: "দিবস প্রতিপাদ্য ২০২৬", 0: "বইয়ের উত্তরমালা থেকে"}


def clean(t):
    t = t.replace("—", "-").replace("–", "-")
    t = _html.escape(t, quote=False)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)


def col_widths(rows, total=665):
    n = len(rows[0])
    weight = []
    for j in range(n):
        lens = sorted(len(re.sub(r"<[^>]+>", "", r[j])) for r in rows)
        typ = lens[int(len(lens) * 0.8)] if lens else 8
        weight.append(max(min(typ, 60), 8) ** 0.8 + 6)
    s = sum(weight)
    w = [max(int(total * x / s), 56) for x in weight]
    w[-1] += total - sum(w)
    return w


def table_html(rows):
    head, body = rows[0], rows[1:]
    w = col_widths(rows)
    cols = "".join(f'<col style="width:{x}px">' for x in w)
    th = "".join(f"<th>{c}</th>" for c in head)
    trs = ""
    for r in body:
        tds = "".join((f'<td class="strong">{c}</td>' if j == 0 else f"<td>{c}</td>") for j, c in enumerate(r))
        trs += f"<tr>{tds}</tr>"
    return f'<table class="grid"><colgroup>{cols}</colgroup><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>'


def parse_sources():
    """Returns {chapter index in order: [html block, ...]} from the src/*.txt stream."""
    chapters, cur = [], None
    lines = []
    for f in sorted(SRC.glob("s*.txt")):
        lines += f.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines):
        ln = lines[i].rstrip()
        i += 1
        if not ln.strip():
            continue
        if ln.startswith("# "):
            cur = {"title": ln[2:].strip(), "blocks": []}
            chapters.append(cur)
        elif cur is None:
            raise SystemExit("source starts without a '# ' chapter line")
        elif ln.startswith("### "):
            cur["blocks"].append(f'<h4 class="sh">{clean(ln[4:])}</h4>')
        elif ln.startswith("## "):
            cur["blocks"].append(f"<h3>{clean(ln[3:])}</h3>")
        elif ln.startswith("||") or ln.startswith("| "):
            rows = []
            while True:
                cells = [clean(c.strip()) for c in ln.lstrip("|").split(" | ")]
                cells[0] = cells[0].strip()
                rows.append(cells)
                if i < len(lines) and lines[i].startswith("| "):
                    ln = lines[i].rstrip()
                    i += 1
                else:
                    break
            assert all(len(r) == len(rows[0]) for r in rows), ("ragged table", rows[0], [r for r in rows if len(r) != len(rows[0])][:2])
            cur["blocks"].append(table_html(rows))
        elif ln.startswith("!BOX "):
            rows = []
            while i < len(lines) and lines[i].startswith("| "):
                a, b = [clean(c.strip()) for c in lines[i].lstrip("|").split(" | ", 1)]
                rows.append((a, b))
                i += 1
            body = "".join(f"<tr><td class='strong' style='width:200px'>{a}</td><td>{b}</td></tr>" for a, b in rows)
            cur["blocks"].append(f'<div class="sbox orange" style="padding:8px 14px"><span class="label">{clean(ln[5:])}</span>'
                                 f'<table class="grid" style="margin:4px 0 0"><tbody>{body}</tbody></table></div>')
        elif ln.startswith("!LIST "):
            kind, title = ln[6:].split(" ", 1)
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(clean(lines[i][2:]))
                i += 1
            lab = f'<span class="label{" ink" if kind == "ink" else ""}">{clean(title)}</span>'
            cur["blocks"].append(f'<div class="sbox {kind}">{lab}<ul>' + "".join(f"<li>{x}</li>" for x in items) + "</ul></div>")
        elif ln.startswith("- "):
            items = [clean(ln[2:])]
            while i < len(lines) and lines[i].startswith("- "):
                items.append(clean(lines[i][2:]))
                i += 1
            cur["blocks"].append('<div class="sbox ink"><ul>' + "".join(f"<li>{x}</li>" for x in items) + "</ul></div>")
        else:
            cur["blocks"].append(f"<p>{clean(ln)}</p>")
    return chapters


def cover():
    bn.PN[0] += 1
    led = "".join(f'<div class="li" data-ch="{c}" style="grid-template-columns:40px 1fr 70px"><span class="n">{BN[k]}</span><span class="nm">{CH_TITLE_PLAIN[c]}</span>'
                  f'<span class="nt" style="color:#6F6A5C;font-size:12px"></span></div>' for k, (c, _t, _g) in enumerate(CHAPTERS, start=1))
    return ('<section class="page cover"><div style="margin-top:130px"><div class="label" style="font-size:12px;font-family:Outfit,sans-serif;letter-spacing:.24em">GENERAL KNOWLEDGE INTERNATIONAL</div>'
            '<h1 style="font-size:50px;line-height:1.4;font-weight:700;margin:6px 0 4px">বিশ্বের <span class="acc">সাম্প্রতিক</span> ও চলমান ঘটনাপ্রবাহ - ১</h1>'
            '<div style="font-family:Outfit,sans-serif;font-size:18px;color:#6F6A5C;margin-bottom:8px">Current Affairs of the World, Part 1</div>'
            '<div class="tagline" style="font-size:15px;max-width:560px">বিশ্বের নেতারা, যুদ্ধ আর কূটনীতি, বৈশ্বিক সূচক, আন্তর্জাতিক সংস্থা আর দিবসের প্রতিপাদ্য: পরীক্ষায় বসার আগে বইয়ের মতো পড়ে নিন।</div>'
            '<div class="ledger" style="margin-top:30px;max-width:600px">' + led + '</div></div>'
            f'<div class="footer"><span>{F}</span><span class="pn"></span></div></section>')


EXTRA_CSS = (".grid th,.grid td{padding:3px 8px;line-height:1.5;font-size:11.4px}.grid th{font-size:11.2px}"
             "h3{margin:11px 0 3px}p{margin-bottom:5px;line-height:1.75;font-size:12.6px}.sbox li{line-height:1.6}"
             "h4.sh{font-size:13.2px;font-weight:700;line-height:1.5;margin:9px 0 3px;border-left:3px solid var(--orange);padding-left:8px}"
             ".sbox{margin:8px 0 14px}")


def build_html():
    bn.PN[0] = 0
    srcs = parse_sources()
    assert len(srcs) == len(CHAPTERS), (len(srcs), [s["title"] for s in srcs])
    pages = [cover()]
    for k, ((ch, title, tag), s) in enumerate(zip(CHAPTERS, srcs), start=1):
        pg = page(BN[k], title, tag, "".join(s["blocks"]), F, k)
        pages.append(pg.replace('<section class="page">', f'<section class="page" data-ch="{ch}">', 1))
    h = doc("বিশ্বের সাম্প্রতিক ও চলমান ঘটনাপ্রবাহ - ১", pages)
    return h.replace("</head>", "<style>" + EXTRA_CSS + "</style></head>", 1)


sys.path.insert(0, str(BANGLA))
import build_note_modern as bm  # noqa: E402

LAYOUT_JS = bm.LAYOUT_JS


def main():
    from playwright.sync_api import sync_playwright

    html = build_html()
    d = OUT / FOLDER
    d.mkdir(exist_ok=True)
    tmp = OUT / "_tmp_note_int1.html"
    tmp.write_text(html.replace("HREF", "../bangla/_build/guide.css"), encoding="utf-8")
    with sync_playwright() as pw:
        try:
            b = pw.chromium.launch()
        except Exception:
            import glob
            import os
            exe = glob.glob(os.path.expanduser("~/AppData/Local/ms-playwright/chromium-*/chrome-win*/chrome.exe"))
            b = pw.chromium.launch(executable_path=exe[0])
        pg = b.new_page()
        pg.goto(tmp.resolve().as_uri())
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(800)
        over = pg.evaluate(LAYOUT_JS)
        final = "<!doctype html>\n" + pg.evaluate("document.documentElement.outerHTML")
        (d / "note.html").write_text(final.replace("../bangla/_build/guide.css", "../../bangla/_build/guide.css"), encoding="utf-8", newline="\n")
        pg.pdf(path=str(d / "note.pdf"), width="793.33px", height="1122.67px", print_background=True,
               margin=dict(top="0", right="0", bottom="0", left="0"))
        tmp.unlink()
        print(len(over), "pages; content bottoms (limit 1070):", over)
        print("too long:", [o for o in over if o[1] > 1070])
        b.close()


if __name__ == "__main__":
    main()
