# -*- coding: utf-8 -*-
"""Build the note for Bangla topic 3, "মধ্যযুগ" (book pages 26 to 55).

Run from this folder:  python build_note_moddhojug.py          (needs: pip install playwright, Chromium)
Writes content/bangla/03-moddhojug/note.html and note.pdf (PDFs are git-ignored).
Shares helpers and the stylesheet with build_notes.py (topic 1). Rules: docs/BANGLA_CONTENT_RULES.md.
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
import build_notes as bn  # noqa: E402
from build_notes import doc, page  # noqa: E402
import mj_part1 as p1  # noqa: E402
import mj_part2 as p2  # noqa: E402
import mj_part3 as p3  # noqa: E402

OUT = HERE.parent
FOLDER = "03-moddhojug"
F = bn.FOOT


def build_html():
    bn.PN[0] = 0
    pages = [p1.cover(),
             page("০১", "মধ্যযুগ <span class='acc'>পরিচিতি</span>", "১২০১ থেকে ১৮০০: সময়কাল, যুগবিভাগ ও চারটি ধারা।", p1.pa(), F, 1),
             page("০২", "অন্ধকার <span class='acc'>যুগ</span>", "১২০০ থেকে ১৩৫০: যে সময়ে বাংলা সাহিত্য পাওয়া যায়নি।", p1.pb(), F, 2),
             page("০৩", "শ্রীকৃষ্ণ<span class='acc'>কীর্তন</span>", "মধ্যযুগের প্রথম কাব্য: গোয়ালঘরের মাচা থেকে বঙ্গীয় সাহিত্য পরিষদ।", p1.pc(), F, 3),
             page("", "", "", p1.pd(), F, 4, first=False),
             page("০৪", "বৈষ্ণব <span class='acc'>পদাবলি</span>", "মধ্যযুগের শ্রেষ্ঠ নিদর্শন: রাধা-কৃষ্ণের প্রেমলীলা ও ব্রজবুলি।", p1.pe(), F, 5),
             page("০৫", "মঙ্গল<span class='acc'>কাব্য</span>", "দেব-দেবীর মাহাত্ম্য: মনসা, চণ্ডী, অন্নদা ও ধর্মঠাকুর।", p1.pf(), F, 6),
             page("", "", "", p1.pg(), F, 7, first=False),
             page("০৬", "জীবনী ও <span class='acc'>নাথ সাহিত্য</span>", "চৈতন্যদেবের জীবনী আর নাথ ধর্মের কাহিনি।", p2.ph(), F, 8),
             page("০৮", "মর্সিয়া <span class='acc'>সাহিত্য</span>", "কারবালার শোক ও যুদ্ধের কাব্য।", p2.pi(), F, 9),
             page("০৯", "লোক<span class='acc'>সাহিত্য</span>", "গীতিকা, ডাক ও খনার বচন, রূপকথা।", p2.pj(), F, 10),
             page("", "", "", p2.pk(), F, 11, first=False),
             page("১০", "অনুবাদ <span class='acc'>সাহিত্য</span>", "মহাভারত, রামায়ণ, ভাগবত ও ফারসি-হিন্দি কাব্যের বাংলা রূপ।", p2.pl(), F, 12),
             page("১১", "রোমান্টিক <span class='acc'>প্রণয়োপাখ্যান</span>", "মুসলমান কবিদের উল্লেখযোগ্য অবদান।", p2.pp(), F, 13),
             page("", "", "", p2.pm(), F, 14, first=False),
             page("১২", "আরাকান রাজসভা ও <span class='acc'>পৃষ্ঠপোষক</span>", "রোসাঙ্গের কবিরা আর বাংলার সুলতানদের পৃষ্ঠপোষকতা।", p2.pn(), F, 15),
             page("১৪", "যুগ <span class='acc'>সন্ধিক্ষণ</span>", "১৭৬০ থেকে ১৮৬০: কবিওয়ালা, শায়ের ও দোভাষী পুঁথি।", p2.po(), F, 16),
             page("১৫", "বইয়ের <span class='acc'>উত্তরমালা</span> থেকে", "যে তথ্য শুধু উত্তরমালায় আছে আর যেগুলো নিয়ে সন্দেহ।", p3.px(), F, 17),
             page("", "", "", p3.py(), F, 18, first=False)]
    return doc("মধ্যযুগ", pages)


def main():
    from playwright.sync_api import sync_playwright

    html = build_html()
    d = OUT / FOLDER
    d.mkdir(exist_ok=True)
    (d / "note.html").write_text(html.replace("HREF", "../_build/guide.css"), encoding="utf-8")
    tmp = OUT / "_tmp_note3.html"
    tmp.write_text(html.replace("HREF", "_build/guide.css"), encoding="utf-8")
    with sync_playwright() as pw:
        try:
            b = pw.chromium.launch()
        except Exception:
            import glob, os
            exe = glob.glob(os.path.expanduser("~/AppData/Local/ms-playwright/chromium-*/chrome-win*/chrome.exe"))
            b = pw.chromium.launch(executable_path=exe[0])
        pg = b.new_page()
        pg.goto(tmp.resolve().as_uri())
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(600)
        over = pg.evaluate("""() => [...document.querySelectorAll('.page')].map((p,i)=>{
            const f=p.querySelector('.footer'); const kids=[...p.children].filter(c=>c!==f);
            const last=kids[kids.length-1]; const r=last.getBoundingClientRect(); const pr=p.getBoundingClientRect();
            return [i+1, Math.round(r.bottom-pr.top)] })""")
        pg.pdf(path=str(d / "note.pdf"), width="793.33px", height="1122.67px", print_background=True,
               margin=dict(top="0", right="0", bottom="0", left="0"))
        tmp.unlink()
        print("pages (page, content bottom px; limit 1070):", over)
        b.close()


if __name__ == "__main__":
    main()
