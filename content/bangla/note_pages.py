# -*- coding: utf-8 -*-
"""Read a built note.html: one entry per note page with its chapter tags (data-ch) and its normalized text."""
import html as H
import pathlib
import re

HERE = pathlib.Path(__file__).parent


def norm(s):
    return re.sub(r"\s+", " ", s.replace("‌", "").replace("‍", "")).strip(" ।.")


def page_info(folder):
    p = HERE / folder / "note.html"
    if not p.exists():
        return []
    out = []
    for part in p.read_text(encoding="utf-8").split('<section class="page')[1:]:
        m = re.search(r'data-ch="([^"]*)"', part[:120])
        chs = {int(t) for t in m.group(1).split()} if m else set()
        t = H.unescape(re.sub(r"<[^>]+>", " ", part))
        out.append(dict(chs=chs, text=norm(re.sub(r"\s+", " ", t))))
    return out
