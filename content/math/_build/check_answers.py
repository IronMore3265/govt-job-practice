# -*- coding: utf-8 -*-
"""Heuristic cross-check: the text of the book's answer option should appear in the book's own solution text.
Mismatches are listed so they can be compared against the scan by hand (catches 4/8 style misreads)."""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qparse import parse  # noqa: E402

BN = "০১২৩৪৫৬৭৮৯"


def norm(t):
    t = "".join(str(BN.index(c)) if c in BN else c for c in t)
    for w in ("\\dfrac", "\\frac", "\\text", "\\left", "\\right", "\\sqrt", "টি", "জন", "গুণ", "$", "{", "}", "\\", "^", "_", " ", "\n"):
        t = t.replace(w, "")
    return t.replace("−", "-")


def main():
    sections, qs = parse()
    bad = []
    for q in qs:
        if not q.answer_letter or "," in q.answer_letter:
            continue
        good = dict(q.opts)[q.answer_letter]
        g = norm(good)
        sol = norm(" ".join(q.sol))
        if g and g not in sol:
            bad.append((q.sec, q.n, good, q.source[:24]))
    print(len(bad), "of", len(qs), "answers not found in the solution text")
    for b in bad:
        print(b)


if __name__ == "__main__":
    main()
