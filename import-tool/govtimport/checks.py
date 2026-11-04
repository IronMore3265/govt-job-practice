"""Validation of parsed questions: the rules PLAN.md section 5 lists, plus the database limits.

Everything here is offline. Errors block an import, warnings are only printed.
"""
import json
import re
import shutil
import subprocess
from pathlib import Path

from .parser import ParsedFile

REPO = Path(__file__).resolve().parents[2]
KATEX = REPO / "app" / "node_modules" / "katex"
KATEX_SCRIPT = Path(__file__).with_name("katex_check.js")

BENGALI = re.compile(r"[ঀ-৿]")
HASANTA_LOOSE = re.compile("্(?![ঀ-৿‌‍])")
FIGURE_EXT = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
FIGURE_MAX = 5 * 1024 * 1024  # the figures bucket limit

LIMITS = {"text": 4000, "option": 1000, "reason": 2000}  # the database check constraints


def split_math(line: str) -> tuple[list[str], list[int]]:
    """The same scan as splitInline in app/src/lib/math-text.ts. Returns (latex pieces, positions of unclosed $)."""
    math, unclosed = [], []
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "\\" and line[i + 1 : i + 2] == "$":
            i += 2
            continue
        if ch == "$":
            mark = "$$" if line[i + 1 : i + 2] == "$" else "$"
            j, found = i + len(mark), -1
            while j < len(line):
                if line[j] == "\\":
                    j += 2
                    continue
                if line.startswith(mark, j):
                    found = j
                    break
                j += 1
            if found != -1:
                latex = line[i + len(mark) : found].strip()
                if latex:
                    math.append(latex)
                else:
                    unclosed.append(i)  # an empty $$ pair draws nothing: almost certainly a typo
                i = found + len(mark)
                continue
            unclosed.append(i)
        i += 1
    return math, unclosed


def latex_check(items: list[str]) -> tuple[list[str | None], str | None]:
    """Parse each LaTeX string with the site's KaTeX. Returns (errors per item, reason it could not run)."""
    if not items:
        return [], None
    node = shutil.which("node")
    if not node:
        return [None] * len(items), "node is not installed"
    if not KATEX.exists():
        return [None] * len(items), "app/node_modules/katex is missing (run npm install in app/)"
    proc = subprocess.run([node, str(KATEX_SCRIPT), str(KATEX)], input=json.dumps(items), capture_output=True, text=True, encoding="utf-8", timeout=120)
    if proc.returncode != 0:
        return [None] * len(items), f"node failed: {proc.stderr.strip()[:120]}"
    data = json.loads(proc.stdout)
    if "unavailable" in data:
        return [None] * len(items), data["unavailable"]
    return data["results"], None


def check_files(files: list[ParsedFile], figures_dir: Path | None = None) -> list[str]:
    """Fill errors and warnings on every question. Returns notes about checks that could not run."""
    math_refs: list[tuple] = []  # (question, field name, latex)
    for pf in files:
        base = figures_dir or Path(pf.path).parent / "figures"
        for q in pf.questions:
            lang = q.lang or pf.lang
            if (q.topic or pf.topic) is None:
                q.errors.append("no topic: put 'topic: <number>' in the file header or add **Topic:** to the question")

            fields = {"question": (q.text, LIMITS["text"]), "reason": (q.reason, LIMITS["reason"])}
            fields.update({f"option {k}": (v, LIMITS["option"]) for k, v in q.options.items()})
            for name, (value, limit) in fields.items():
                if len(value) > limit:
                    q.errors.append(f"{name} is {len(value)} characters, the limit is {limit}")
                for line in value.split("\n"):
                    math, unclosed = split_math(line)
                    if unclosed:
                        q.errors.append(f"{name}: a $ is not closed (write a literal dollar sign as \\$): '{line.strip()[:60]}'")
                    math_refs += [(q, name, m) for m in math]
                if BENGALI.search(value) and HASANTA_LOOSE.search(value):
                    q.warnings.append(f"{name}: a hasanta (্) is not followed by a letter, so a conjunct may be broken")

            if lang == "bn" and not BENGALI.search(q.text):
                q.errors.append("lang is bn but the question has no Bangla letters (was the Bangla text lost when the file was saved?)")
            if lang == "en" and BENGALI.search(q.text):
                q.warnings.append("lang is en but the question text has Bangla letters; add '**Lang:** bn' if it is a Bangla question")

            if q.figure:
                ext = Path(q.figure).suffix.lower()
                path = base / q.figure
                if ext not in FIGURE_EXT:
                    q.errors.append(f"figure '{q.figure}' must be a .png, .jpg or .webp file")
                elif not path.is_file():
                    q.errors.append(f"figure file not found: {path}")
                elif path.stat().st_size > FIGURE_MAX:
                    q.errors.append(f"figure '{q.figure}' is {path.stat().st_size // 1024} KB, the limit is {FIGURE_MAX // 1024} KB")

    notes = []
    results, why = latex_check(sorted({m for _, _, m in math_refs}))
    if why:
        notes.append(f"LaTeX was not parsed: {why}. Only the $ pairing was checked.")
    else:
        lookup = dict(zip(sorted({m for _, _, m in math_refs}), results))
        for q, name, latex in math_refs:
            if lookup.get(latex):
                q.errors.append(f"{name}: LaTeX '{latex[:50]}' does not parse: {lookup[latex]}")
    return notes
