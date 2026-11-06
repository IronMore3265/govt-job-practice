# -*- coding: utf-8 -*-
"""Parse content/math/01-real-numbers/src/*.txt (hand transcription of 'Math Pt 1.pdf') into sections, theory blocks and questions.

Markers (first characters of a line):
  @SEC id | title          new numbered section (1.1 ... 1.9)
  @SUB title                sub group heading inside a section (shortcut formula groups)
  @T                        theory text follows (markdown-ish) until the next marker
  @Q n | source             question; stem lines, options (ক) খ) গ) ঘ) ঙ)), @ANS, @DOUBT, @SOL ...
  @SOLAPPEND n ... @ENDSOLAPPEND   extra solution text for question n of the current section
  Inside @T or @SOL:  @TABLE head | head ... @ENDTABLE, @FIG name, @DIV, @LONGDIV, @SQRTDIV, @FACT
"""
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "01-real-numbers" / "src"
LET = {"ক": "A", "খ": "B", "গ": "C", "ঘ": "D", "ঙ": "E"}
BNL = {v: k for k, v in LET.items()}
OPT = re.compile(r"^([কখগঘঙ])\)\s*(.*)$")
MARK = ("@SEC", "@SUB", "@T", "@Q", "@SOLAPPEND")


class Q:
    def __init__(self, sec, sub, n, source):
        self.sec = sec          # section id like "1.1"
        self.sub = sub
        self.n = n              # number inside the section group (as in the book)
        self.source = source
        self.stem = []
        self.opts = []          # list of (letter, text)
        self.ans = ""           # letter or free text
        self.doubt = False
        self.sol = []
        self.new = False        # written new (not from the book)

    @property
    def answer_letter(self):
        a = self.ans.strip()
        return a if re.fullmatch(r"[A-E](\s*,\s*[A-E])*", a) else ""


def _ans_to_letters(a):
    a = a.strip()
    found = [LET[c] for c in a if c in LET]
    if a and all((c in LET or c in " ,ও") for c in a):
        return ", ".join(found)
    return None


def parse():
    sections = []          # [{"id","title","blocks":[...]}]  blocks: ("sub", title) or ("t", [lines])
    questions = []
    sec = None
    sub = None
    cur = None
    mode = None            # "t", "stem", "opts", "sol", "append"
    tlines = None
    app_target = None
    app_lines = None
    files = sorted(SRC.glob("p*.txt"))
    for f in files:
        for raw in f.read_text(encoding="utf-8").splitlines():
            line = raw.rstrip()
            if line.startswith("@SEC"):
                _flush_t(sec, tlines); tlines = None
                sid, title = [x.strip() for x in line[4:].split("|", 1)]
                sec = {"id": sid, "title": title, "blocks": []}
                sections.append(sec)
                sub = None; cur = None; mode = None
                continue
            if line.startswith("@SUB"):
                _flush_t(sec, tlines); tlines = None
                sub = line[4:].strip()
                sec["blocks"].append(("sub", sub))
                cur = None; mode = None
                continue
            if line.strip() == "@T":
                _flush_t(sec, tlines)
                tlines = []
                mode = "t"; cur = None
                continue
            if line.startswith("@Q"):
                _flush_t(sec, tlines); tlines = None
                n, source = [x.strip() for x in line[2:].split("|", 1)]
                cur = Q(sec["id"], sub, int(n), source)
                questions.append(cur)
                mode = "stem"
                continue
            if line.startswith("@SOLAPPEND"):
                n = int(line.split()[1])
                app_target = next(q for q in reversed(questions) if q.sec == sec["id"] and q.n == n)
                app_lines = []
                mode = "append"
                continue
            if line.strip() == "@ENDSOLAPPEND":
                app_target.sol.extend(app_lines)
                mode = None
                continue
            if mode == "t":
                tlines.append(line)
            elif mode == "append":
                app_lines.append(line)
            elif cur is not None:
                if line.startswith("@ANS"):
                    cur.ans = line[4:].strip(); mode = "afterans"
                elif line.strip() == "@DOUBT":
                    cur.doubt = True
                elif line.strip() == "@SOL":
                    mode = "sol"
                elif mode == "sol":
                    cur.sol.append(line)
                elif mode in ("stem", "opts"):
                    m = OPT.match(line)
                    if m:
                        cur.opts.append((LET[m.group(1)], m.group(2).strip())); mode = "opts"
                    elif line.strip():
                        if mode == "stem":
                            cur.stem.append(line)
                        else:
                            L, t = cur.opts[-1]
                            cur.opts[-1] = (L, t + " " + line.strip())
                elif mode == "afterans" and line.strip():
                    cur.sol.append(line)
    _flush_t(sec, tlines)
    for q in questions:
        while q.sol and not q.sol[-1].strip():
            q.sol.pop()
        letters = _ans_to_letters(q.ans)
        if letters is not None:
            q.ans = letters
    return sections, questions


def _flush_t(sec, tlines):
    if sec is not None and tlines is not None:
        while tlines and not tlines[-1].strip():
            tlines.pop()
        if tlines:
            sec["blocks"].append(("t", tlines))


if __name__ == "__main__":
    s, qs = parse()
    print(len(s), "sections", len(qs), "questions")
    from collections import Counter
    c = Counter(q.sec for q in qs)
    for sec in s:
        print(sec["id"], sec["title"], c[sec["id"]])
    print("options count:", Counter(len(q.opts) for q in qs))
    print("no letter:", [(q.sec, q.n, q.ans) for q in qs if not q.answer_letter])
    print("doubt:", [(q.sec, q.n) for q in qs if q.doubt])
    bad = [(q.sec, q.n) for q in qs if q.answer_letter and any(l not in [o[0] for o in q.opts] for l in q.answer_letter.split(", "))]
    print("answer not in options:", bad)
    print("no sol:", sum(1 for q in qs if not q.sol))
