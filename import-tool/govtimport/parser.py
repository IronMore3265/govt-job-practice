"""Parse a question Markdown file (docs/QUESTION_FORMAT.md) into plain data. Nothing here touches the network.

A file starts with a small header between two `---` lines (subject, topic, lang). After that each question is a
`### Q1. text` heading, four `- A.` options, then `**Answer:**`, `**Reason:**`, `**Page:**` and optionally
`**Figure:**`, `**Topic:**`, `**Lang:**`. Anything else (titles, `## Part` headings, `---` rules, intro text) is ignored.
"""
import re
from dataclasses import dataclass, field
from pathlib import Path

LABELS = ("A", "B", "C", "D")
LANGS = ("en", "bn")

HEAD = re.compile(r"^###\s+Q\s*(\d+)\s*[.:)]?\s*(.*)$")
OPTION = re.compile(r"^-\s*\(?([A-Za-z])[.)]\s*(.*)$")
FIELD = re.compile(r"^\*\*(Answer|Reason|Explanation|Page|Figure|Topic|Lang|Marking points|Source|উত্তর|ব্যাখ্যা|পৃষ্ঠা|উৎস):\*\*\s*(.*)$", re.I)
# Bangla field names used in answer.md map to the same fields. 'source' is a note for people and is ignored.
ALIAS = {"উত্তর": "answer", "ব্যাখ্যা": "reason", "পৃষ্ঠা": "page", "উৎস": "source", "explanation": "reason"}
ANSWER_VALUE = re.compile(r"^\(?([A-Da-d])\)?(?:\s*[.):]\s*(.*))?$")
SECTION = re.compile(r"^#{1,2}\s")
RULE = re.compile(r"^-{3,}\s*$")

# Typical signs of a file that was saved in the wrong encoding and read back as another one.
MOJIBAKE = ("à¦", "à§", "Ã¢â‚¬")


@dataclass
class Question:
    file: str
    line: int
    number: int
    text: str = ""
    options: dict = field(default_factory=dict)
    answer: str = ""
    answer_text: str = ""  # answer.md writes "B. option text"; the text is cross-checked against question.md
    reason: str = ""
    page: int | None = None
    figure: str | None = None
    figure_caption: str | None = None
    topic: int | None = None
    lang: str | None = None
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)

    @property
    def label(self) -> str:
        return f"{Path(self.file).name} Q{self.number} (line {self.line})"


@dataclass
class ParsedFile:
    path: str
    subject: str = ""
    topic: int | None = None
    lang: str = "en"
    questions: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


def read_text(path: Path) -> tuple[str | None, list]:
    """Strict UTF-8 read. A byte order mark is accepted. Returns (text, errors)."""
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        return None, [f"{path.name}: not valid UTF-8 (byte {e.start}). Save the file as UTF-8."]
    errors = []
    if "�" in text:
        errors.append(f"{path.name}: contains the replacement character U+FFFD, so some text was already lost when the file was saved")
    if any(m in text for m in MOJIBAKE):
        errors.append(f"{path.name}: looks like UTF-8 text that was read as another encoding (garbled letters such as 'à¦'). Re-save it as UTF-8")
    return text.replace("\r\n", "\n").replace("\r", "\n"), errors


def _front_matter(lines: list[str], pf: ParsedFile, required: bool = True) -> int:
    """Read the header. Returns the index of the first line after it."""
    if not lines or lines[0].strip() != "---":
        if not required:
            return 0
        pf.errors.append(f"{Path(pf.path).name}: the file must start with a header between two --- lines (subject, topic, lang)")
        return 0
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if end is None:
        pf.errors.append(f"{Path(pf.path).name}: the header at the top is not closed with a second ---")
        return 0
    seen = {}
    for n, raw in enumerate(lines[1:end], start=2):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        key, sep, value = raw.partition(":")
        key = key.strip().lower()
        if not sep or key not in ("subject", "topic", "lang"):
            pf.errors.append(f"{Path(pf.path).name} line {n}: unknown header line '{raw.strip()}' (allowed: subject, topic, lang)")
            continue
        seen[key] = value.strip().strip('"').strip("'")
    pf.subject = seen.get("subject", "")
    if not pf.subject:
        pf.errors.append(f"{Path(pf.path).name}: header needs 'subject: <name>'")
    if "topic" in seen:
        if seen["topic"].isdigit() and 1 <= int(seen["topic"]) <= 999:
            pf.topic = int(seen["topic"])
        else:
            pf.errors.append(f"{Path(pf.path).name}: header 'topic' must be a topic number from 1 to 999, not '{seen['topic']}'")
    lang = seen.get("lang", "en").lower()
    if lang in LANGS:
        pf.lang = lang
    else:
        pf.errors.append(f"{Path(pf.path).name}: header 'lang' must be en or bn, not '{lang}'")
    return end + 1


def parse_text(text: str, path: str, kind: str = "full") -> ParsedFile:
    """kind: "full" (questions with answers, the single-file format), "questions" (question.md: no answers needed)
    or "answers" (answer.md: answers, reasons and pages, no options needed; header optional)."""
    pf = ParsedFile(path=path)
    lines = text.split("\n")
    i0 = _front_matter(lines, pf, required=kind != "answers")

    q: Question | None = None
    mode = None  # "text", ("opt", label), ("field", name) or None
    blank_before = False
    reason_open = False

    def finish():
        nonlocal q
        if q is not None:
            q.text = q.text.strip()
            q.reason = q.reason.strip()
            q.options = {k: v.strip() for k, v in q.options.items()}
            _check_shape(q, kind)
            pf.questions.append(q)
        q = None

    for idx in range(i0, len(lines)):
        n = idx + 1
        raw = lines[idx]
        line = raw.strip()

        m = HEAD.match(line)
        if m:
            finish()
            q = Question(file=path, line=n, number=int(m.group(1)))
            q.text = m.group(2)
            mode, blank_before, reason_open = "text", False, False
            continue
        if q is None:
            continue
        if SECTION.match(line):
            finish()
            mode = None
            continue
        if RULE.match(line):
            mode, reason_open = None, False
            continue

        f = FIELD.match(line)
        if f:
            name, value = f.group(1).lower(), f.group(2).strip()
            name = ALIAS.get(name, name)
            mode, reason_open = ("field", name), name == "reason"
            blank_before = False
            _set_field(q, name, value)
            continue

        in_options = kind != "answers" and (mode == "text" or (isinstance(mode, tuple) and mode[0] == "opt"))
        o = OPTION.match(line) if in_options else None
        if o:
            label = o.group(1).upper()
            if label not in LABELS:
                q.errors.append(f"option '{o.group(1)}.' is not allowed, options are A, B, C and D")
            elif label in q.options:
                q.errors.append(f"option {label} appears twice")
            else:
                q.options[label] = o.group(2)
            mode, blank_before = ("opt", label), False
            continue

        if not line:
            blank_before = True
            if mode == "text":
                q.text += "\n"
            elif isinstance(mode, tuple) and mode[1] == "reason":
                q.reason += "\n"
            continue

        # A plain line: it continues whatever is open.
        if mode == "text":
            q.text += "\n" + line
        elif isinstance(mode, tuple) and mode[0] == "opt" and not blank_before:
            label = mode[1]
            if label in q.options:
                q.options[label] += " " + line
        elif reason_open and isinstance(mode, tuple):
            q.reason += "\n" + line
        elif isinstance(mode, tuple) and mode[0] == "field" and not blank_before:
            q.errors.append(f"unexpected extra line after **{mode[1].title()}:** (one line only): '{line[:50]}'")
        else:
            q.errors.append(f"unexpected text outside the question format: '{line[:50]}'")
    finish()

    seen = {}
    for question in pf.questions:
        if question.number in seen:
            pf.errors.append(f"{Path(path).name}: Q{question.number} appears twice (lines {seen[question.number]} and {question.line})")
        seen[question.number] = question.line
    if not pf.questions and not pf.errors:
        pf.errors.append(f"{Path(path).name}: no questions found. Each question starts with '### Q1. ...'")
    return pf


def _set_field(q: Question, name: str, value: str) -> None:
    if name == "answer":
        m = ANSWER_VALUE.match(value.strip())
        if m:
            q.answer, q.answer_text = m.group(1).upper(), (m.group(2) or "").strip()
        else:
            q.answer = value.strip().strip(".").upper()
    elif name == "source":
        pass
    elif name == "reason":
        q.reason = value
    elif name == "page":
        m = re.match(r"^(\d+)\b", value)
        if m and int(m.group(1)) > 0:
            q.page = int(m.group(1))
        else:
            q.errors.append(f"**Page:** must be a page number like 12, not '{value}'")
    elif name == "figure":
        file, _, caption = value.partition("|")
        q.figure = file.strip() or None
        q.figure_caption = caption.strip() or None
        if not q.figure:
            q.errors.append("**Figure:** needs a file name, for example '**Figure:** ch3-table.png | Table 3.1'")
    elif name == "topic":
        if value.isdigit() and 1 <= int(value) <= 999:
            q.topic = int(value)
        else:
            q.errors.append(f"**Topic:** must be a topic number from 1 to 999, not '{value}'")
    elif name == "lang":
        if value.lower() in LANGS:
            q.lang = value.lower()
        else:
            q.errors.append(f"**Lang:** must be en or bn, not '{value}'")
    elif name == "marking points":
        q.warnings.append("**Marking points:** is for written questions and is ignored here")


def _check_shape(q: Question, kind: str = "full") -> None:
    if not q.text:
        q.errors.append("the question text is empty")
    if kind != "answers":
        _check_options(q)
    if kind != "questions":
        _check_answer_fields(q)


def _check_options(q: Question) -> None:
    missing = [x for x in LABELS if x not in q.options]
    if missing:
        q.errors.append(f"needs exactly four options A to D, missing {', '.join(missing)}")
    for label, text in q.options.items():
        if not text:
            q.errors.append(f"option {label} is empty")
    texts = [t.casefold() for t in q.options.values() if t]
    if len(texts) != len(set(texts)):
        q.errors.append("two options have the same text")


def _check_answer_fields(q: Question) -> None:
    if q.answer not in LABELS:
        q.errors.append(f"**Answer:** must be one letter from A to D, not '{q.answer}'" if q.answer else "**Answer:** is missing")
    if not q.reason:
        q.errors.append("**Reason:** is missing or empty (every question needs an explanation)")
    if q.page is None and not any("**Page:**" in e for e in q.errors):
        q.errors.append("**Page:** is missing (the source page of the book or note)")


def parse_file(path: str | Path, kind: str = "full") -> ParsedFile:
    path = Path(path)
    text, errors = read_text(path)
    if text is None:
        return ParsedFile(path=str(path), errors=errors)
    pf = parse_text(text, str(path), kind)
    pf.errors = errors + pf.errors
    return pf
