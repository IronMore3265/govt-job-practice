# -*- coding: utf-8 -*-
"""Build the note for Bangla topic 4, "আধুনিক যুগ" (book pages 56 to 110 of the printed numbering).

Run from this folder:  python build_note_modern.py          (needs: pip install playwright, Chromium)
Writes content/bangla/04-adhunik-jug/note.html and note.pdf (PDFs are git-ignored).
Shares helpers and the stylesheet with build_notes.py. Rules: docs/BANGLA_CONTENT_RULES.md.
The last two pages (answer-key pages) are generated from the questions whose key facts only the book's answer key states.
"""
import html as htmllib
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import build_notes as bn  # noqa: E402
from build_notes import doc, page, table  # noqa: E402
import md_part1 as m1  # noqa: E402
import md_part2 as m2  # noqa: E402
import md_part3 as m3  # noqa: E402
import md_part4 as m4  # noqa: E402
import md_part5 as m5  # noqa: E402
import md_part6 as m6  # noqa: E402
import md_part7 as m7  # noqa: E402
import md_part8 as m8  # noqa: E402
import md_part9 as m9  # noqa: E402
import md_part10 as m10  # noqa: E402
import md_part11 as m11  # noqa: E402

OUT = HERE.parent
FOLDER = "04-adhunik-jug"
F = bn.FOOT
BNUM = "০১২৩৪৫৬৭৮৯"


def bnum(n):
    return "".join(BNUM[int(c)] for c in str(n))


# (page title number, title html, tagline, body function, first-of-section)
PAGES = [
    ("০১", "বাংলা <span class='acc'>গদ্যসাহিত্য</span>", "আধুনিক যুগের সূচনা: ১৮০১ থেকে বর্তমান।", m1.p_gadya, True),
    ("০২", "ফোর্ট উইলিয়াম <span class='acc'>কলেজ</span>", "বাংলা গদ্যের বিকাশে কলেজের পণ্ডিতদের অবদান।", m1.p_fwc, True),
    ("০৩", "শ্রীরামপুর মিশন ও <span class='acc'>ছাপাখানা</span>", "বাংলা মুদ্রণের ইতিহাস।", m1.p_srirampur, True),
    ("০৪", "হিন্দু কলেজ, ইয়ংবেঙ্গল ও <span class='acc'>মুসলিম সাহিত্য সমাজ</span>", "মধ্যবিত্তের আধুনিক শিক্ষা আর বুদ্ধির মুক্তির আন্দোলন।", m1.p_hindu_dhaka, True),
    ("", "", "", m1.p_buddhir_mukti, False),
    ("০৭", "বাংলা <span class='acc'>একাডেমি</span>", "ভাষা আন্দোলনের প্রেরণায় গড়ে ওঠা প্রতিষ্ঠান।", m1.p_academy, True),
    ("০৮", "<span class='acc'>উপন্যাস</span>", "বাংলা উপন্যাসের সূচনা, প্রথম ধাপ ও ত্রয়ী উপন্যাস।", m2.p_novel_a, True),
    ("", "", "", m2.p_novel_b, False),
    ("", "", "", m2.p_novel_c, False),
    ("", "", "", m2.p_novel_d, False),
    ("০৯", "<span class='acc'>নাটক</span>", "দৃশ্যকাব্য: প্রথম নাটক থেকে বিখ্যাত নাট্যকার।", m3.p_drama_a, True),
    ("", "", "", m3.p_drama_b, False),
    ("১০", "<span class='acc'>প্রবন্ধ</span>", "বুদ্ধিভিত্তিক আলোচনা ও বিখ্যাত প্রাবন্ধিক।", m4.p_essay_a, True),
    ("", "", "", m4.p_essay_b, False),
    ("১১", "সাহিত্যের <span class='acc'>ইতিহাস</span> বিষয়ক গ্রন্থ", "বাংলা সাহিত্যের ইতিহাস যাঁরা লিখেছেন।", m4.p_history, True),
    ("১২", "<span class='acc'>ভ্রমণকাহিনি</span>", "বইয়ের তালিকার ভ্রমণ সাহিত্য।", m5.p_travel, True),
    ("১৩", "বাংলা কাব্য ও <span class='acc'>কবিতা</span>", "গীতিকবিতা, পঞ্চপাণ্ডব ও বিখ্যাত কাব্য।", m5.p_poetry_a, True),
    ("", "", "", m5.p_poetry_a2, False),
    ("", "", "", m5.p_poetry_b, False),
    ("", "", "", m5.p_poetry_c, False),
    ("১৪", "<span class='acc'>মহাকাব্য</span>", "বীর রসাত্মক বিশালায়তন আখ্যান।", m6.p_epic, True),
    ("১৫", "<span class='acc'>ছোটগল্প</span>", "বিন্দুর মধ্যে সিন্ধুর কলতান।", m6.p_story_a, True),
    ("", "", "", m6.p_story_b, False),
    ("১৬", "জীবনচরিত: <span class='acc'>মুহম্মদ (স.)</span>", "সীরাত গ্রন্থ।", m6.p_bio, True),
    ("১৭", "ভাষা আন্দোলনভিত্তিক <span class='acc'>রচনা</span>", "একুশের উপন্যাস, কবিতা, নাটক ও গান।", m7.p_language, True),
    ("১৮", "মুক্তিযুদ্ধভিত্তিক <span class='acc'>গ্রন্থ</span>", "নাটক, উপন্যাস ও অন্যান্য রচনা।", m7.p_liberation_a, True),
    ("", "", "", m7.p_liberation_b, False),
    ("১৯", "বিখ্যাত <span class='acc'>চরিত্র</span>", "কোন গ্রন্থের কোন চরিত্র।", m8.p_char_a, True),
    ("", "", "", m8.p_char_b, False),
    ("২০", "সাহিত্যিকদের <span class='acc'>উপাধি</span>", "নামের সঙ্গে জড়ানো উপাধি।", m9.p_titles, True),
    ("২১", "প্রকৃত নাম ও <span class='acc'>ছদ্মনাম</span>", "যাঁরা অন্য নামে লিখেছেন।", m9.p_pennames, True),
    ("২২", "প্রথম প্রকাশিত <span class='acc'>উপন্যাস</span>", "বিশিষ্ট ঔপন্যাসিকদের প্রথম উপন্যাস।", m10.p_first_published, True),
    ("", "", "", m10.p_first_published2, False),
    ("", "", "", m10.p_first_poems, False),
    ("২৩", "বাংলা সাহিত্যের প্রথম <span class='acc'>বিষয়াবলি</span>", "প্রথম কবি, প্রথম গ্রন্থ, প্রথম পত্রিকা।", m10.p_firsts_list, True),
    ("", "", "", m10.p_firsts_list2, False),
    ("২৪", "বাজেয়াপ্ত ও <span class='acc'>উৎসর্গীকৃত</span>", "কোন বই বাজেয়াপ্ত হয়েছিল আর কোনটি কাকে উৎসর্গ করা।", m10.p_banned, True),
    ("২৫", "বিখ্যাত বাংলা <span class='acc'>গান</span>", "কথা ও সুর কার।", m11.p_songs, True),
    ("২৬", "বিখ্যাত পঙ্ক্তি ও <span class='acc'>বক্তা</span>", "কোন পঙ্ক্তি কার।", m11.p_quotes_a, True),
    ("", "", "", m11.p_quotes_b, False),
    ("২৭", "পত্রিকা / সাময়িকী ও <span class='acc'>সম্পাদক</span>", "কোন পত্রিকা, কবে, কার সম্পাদনায়।", m11.p_press_a, True),
    ("", "", "", m11.p_press_b, False),
    ("", "", "", m11.p_press_c, False),
]
CHS = {  # page function -> chapter numbers it teaches (the "data-ch" tag; used to resolve question pages)
    "p_gadya": "1", "p_fwc": "2", "p_srirampur": "3", "p_hindu_dhaka": "4 5", "p_buddhir_mukti": "5 6", "p_academy": "7",
    "p_novel_a": "8", "p_novel_b": "8", "p_novel_c": "8", "p_novel_d": "8", "p_drama_a": "9", "p_drama_b": "9",
    "p_essay_a": "10", "p_essay_b": "10", "p_history": "11", "p_travel": "12", "p_poetry_a": "13", "p_poetry_a2": "13",
    "p_poetry_b": "13", "p_poetry_c": "13", "p_epic": "14", "p_story_a": "15", "p_story_b": "15", "p_bio": "16",
    "p_language": "17", "p_liberation_a": "18", "p_liberation_b": "18", "p_char_a": "19", "p_char_b": "19", "p_titles": "20",
    "p_pennames": "21", "p_first_published": "22", "p_first_published2": "22", "p_first_poems": "22", "p_firsts_list": "23",
    "p_firsts_list2": "23", "p_banned": "17 24", "p_songs": "25", "p_quotes_a": "26", "p_quotes_b": "26", "p_press_a": "27",
    "p_press_b": "27", "p_press_c": "27",
}
XA = 0  # the answer-key page(s) are laid out automatically (chapter tag 28)

SECTIONS = [
    ("০১", "বাংলা গদ্যসাহিত্য", 2), ("০২", "ফোর্ট উইলিয়াম কলেজ", 3), ("০৩", "শ্রীরামপুর মিশন ও বাংলা ছাপাখানা", 4),
    ("০৪", "হিন্দু কলেজ ও ইয়ংবেঙ্গল", 5), ("০৫", "ঢাকা মুসলিম সাহিত্য সমাজ", 5), ("০৬", "বাংলাদেশ এশিয়াটিক সোসাইটি", 6),
    ("০৭", "বাংলা একাডেমি", 7), ("০৮", "উপন্যাস", 8), ("০৯", "নাটক", 12), ("১০", "প্রবন্ধ", 14),
    ("১১", "বাংলা সাহিত্যের ইতিহাস বিষয়ক গ্রন্থ", 16), ("১২", "ভ্রমণকাহিনি", 17), ("১৩", "বাংলা কাব্য ও কবিতা", 18),
    ("১৪", "মহাকাব্য", 22), ("১৫", "ছোটগল্প", 23), ("১৬", "জীবনচরিত: মুহম্মদ (স.)", 25),
    ("১৭", "ভাষা আন্দোলনভিত্তিক রচনা", 26), ("১৮", "মুক্তিযুদ্ধভিত্তিক গ্রন্থ", 27), ("১৯", "বিখ্যাত চরিত্র", 29),
    ("২০", "বিখ্যাত সাহিত্যিকদের উপাধি", 31), ("২১", "প্রকৃত নাম ও ছদ্মনাম", 32), ("২২", "প্রথম প্রকাশিত উপন্যাস, নাটক, গল্প ও কাব্য", 33),
    ("২৩", "বাংলা সাহিত্যের প্রথম বিষয়াবলি", 36), ("২৪", "বাজেয়াপ্ত ও উৎসর্গীকৃত সাহিত্যকর্ম", 38), ("২৫", "বিখ্যাত বাংলা গান", 39),
    ("২৬", "বিখ্যাত পঙ্ক্তি ও বক্তা", 40), ("২৭", "পত্রিকা / সাময়িকী ও সম্পাদক", 42), ("২৮", "বইয়ের উত্তরমালা থেকে", XA),
]


def cover():
    bn.PN[0] += 1
    left = SECTIONS[:14]
    right = SECTIONS[14:]

    def col(rows):
        return "".join(f'<div class="li" data-ch="{int(n.translate(str.maketrans(BNUM, "0123456789")))}" style="grid-template-columns:30px 1fr 52px"><span class="n">{n}</span><span class="nm" style="font-size:12px">{t}</span>'
                       f'<span class="nt" style="color:#6F6A5C;font-size:11px">পৃষ্ঠা {bnum(p)}</span></div>' for n, t, p in rows)

    return ('<section class="page cover"><div style="margin-top:60px"><div class="label" style="font-size:12px;font-family:Outfit,sans-serif;letter-spacing:.24em">BANGLA LITERATURE</div>'
            '<h1 style="font-size:60px;line-height:1.35;font-weight:700;margin:6px 0 4px">আধুনিক <span class="acc">যুগ</span></h1>'
            '<div class="tagline" style="font-size:14px;max-width:600px">১৮০১ থেকে বর্তমান: গদ্য, উপন্যাস, নাটক, প্রবন্ধ, কাব্য, ছোটগল্প, প্রথম বিষয়াবলি, গান, পঙ্ক্তি ও পত্রিকা। পরীক্ষায় বসার আগে বইয়ের মতো পড়ে নিন।</div>'
            '<div class="ledger" style="margin-top:22px;max-width:690px;display:grid;grid-template-rows:repeat(14,auto);grid-auto-flow:column;column-gap:26px">' + col(SECTIONS) + '</div></div>'
            f'<div class="footer"><span>{F}</span><span class="pn"></span></div></section>')


def answer_key_html(qs, topic):
    """Generated: every question whose fact only the book's answer key states (sec x), by chapter."""
    chs = topic["ch_titles"]
    body = ["<p>বিগত পরীক্ষার কিছু প্রশ্নের উত্তর বইয়ের মূল পাঠে সরাসরি নেই, শুধু বইয়ের উত্তরমালায় আছে। সেগুলো এখানে একসঙ্গে রাখা হলো। "
            "যেখানে উত্তরমালা নিয়ে সন্দেহ আছে, সেখানে তা লেখা আছে।</p>"]
    cur = None
    rows = []

    def flush():
        if rows:
            body.append(table(["প্রশ্ন", "বইয়ের উত্তরমালা অনুযায়ী উত্তর"], list(rows), [400, 265]))
            rows.clear()

    for x in qs:
        if x["sec"] != "x":
            continue
        if x["ch"] != cur:
            flush()
            cur = x["ch"]
            body.append(f"<h3>{chs[x['ch']]}</h3>")
        doubt = x["src"].endswith("সন্দেহযুক্ত)")
        rows.append([htmllib.escape(x["q"]), htmllib.escape(x["opts"][x["ans"]]) + (" (সন্দেহযুক্ত)" if doubt else "")])
    flush()
    return "\n".join(body)


def build_html():
    import build_questions as bq

    topic = [t for t in bq.TOPICS if t["num"] == 4][0]
    qs = bq.prepare(topic, resolve=False)
    bn.PN[0] = 0
    pages = [cover()]
    for i, (num, title, tag, fn, first) in enumerate(PAGES, start=1):
        pg = page(num, title, tag, fn(), F, i, first=first)
        pages.append(pg.replace('<section class="page">', f'<section class="page" data-ch="{CHS[fn.__name__]}">', 1))
    pg = page("২৮", "বইয়ের <span class='acc'>উত্তরমালা</span> থেকে", "যে তথ্য শুধু উত্তরমালায় আছে আর যেগুলো নিয়ে সন্দেহ।", answer_key_html(qs, topic), F, 0)
    pages.append(pg.replace('<section class="page">', '<section class="page" data-ch="28">', 1))
    h = doc("আধুনিক যুগ", pages)
    return h.replace("</head>", "<style>" + EXTRA_CSS + "</style></head>", 1)


EXTRA_CSS = (".grid th,.grid td{padding:3px 8px;line-height:1.5;font-size:11.4px}.grid th{font-size:11.2px}"
             "h3{margin:10px 0 3px}p{margin-bottom:5px;line-height:1.75}.sbox li{line-height:1.6}")


LAYOUT_JS = r"""() => {
  const LIMIT = 1056;
  const BN = '০১২৩৪৫৬৭৮৯';
  const toBn = n => String(n).split('').map(c => BN[+c]).join('');
  const rel = (el, page) => el.getBoundingClientRect().bottom - page.getBoundingClientRect().top;
  const pages = () => [...document.querySelectorAll('.page')];
  function newPageAfter(p) {
    const np = document.createElement('section');
    np.className = 'page';
    np.setAttribute('data-ch', p.getAttribute('data-ch') || '');
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
      if (el.matches('table.grid')) {
        const rows = [...el.tBodies[0].rows]; const k = firstOver(rows, page);
        if (k > 0 && k < rows.length) { const c = emptyLike(el); rows.slice(k).forEach(r => c.tBodies[0].appendChild(r)); toMove = [c, ...kids.slice(i + 1)]; }
      } else if (el.matches('.row') && el.querySelectorAll('table.grid').length === 2) {
        const tb = [...el.querySelectorAll('table.grid')]; const rs = tb.map(t => [...t.tBodies[0].rows]);
        const k = Math.min(...rs.map(r => firstOver(r, page)));
        if (k > 0 && k < Math.max(...rs.map(r => r.length))) {
          const wrap = el.cloneNode(false);
          tb.forEach((t, ti) => { const d = document.createElement('div'); const c = emptyLike(t); rs[ti].slice(k).forEach(r => c.tBodies[0].appendChild(r)); d.appendChild(c); wrap.appendChild(d); });
          toMove = [wrap, ...kids.slice(i + 1)];
        }
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
  pages().forEach((p, i) => (p.getAttribute('data-ch') || '').split(' ').filter(Boolean).forEach(t => { if (!(t in first)) first[t] = i + 1; }));
  document.querySelectorAll('.cover .li[data-ch]').forEach(li => { const n = first[li.dataset.ch]; if (n) li.querySelector('.nt').textContent = 'পৃষ্ঠা ' + toBn(n); });
  return pages().map((p, i) => { const f = p.querySelector('.footer'); const kids = [...p.children].filter(c => c !== f); const last = kids[kids.length - 1]; return [i + 1, Math.round(last.getBoundingClientRect().bottom - p.getBoundingClientRect().top)]; });
}
"""


def main():
    from playwright.sync_api import sync_playwright

    html = build_html()
    d = OUT / FOLDER
    d.mkdir(exist_ok=True)
    tmp = OUT / "_tmp_note4.html"
    tmp.write_text(html.replace("HREF", "_build/guide.css"), encoding="utf-8")
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
        pg.wait_for_timeout(600)
        over = pg.evaluate(LAYOUT_JS)
        final = "<!doctype html>\n" + pg.evaluate("document.documentElement.outerHTML")
        (d / "note.html").write_text(final.replace("_build/guide.css", "../_build/guide.css"), encoding="utf-8")
        pg.pdf(path=str(d / "note.pdf"), width="793.33px", height="1122.67px", print_background=True,
               margin=dict(top="0", right="0", bottom="0", left="0"))
        tmp.unlink()
        print(len(over), "pages; content bottoms (limit 1070):", over)
        print("too long:", [o for o in over if o[1] > 1070])
        b.close()


if __name__ == "__main__":
    main()
