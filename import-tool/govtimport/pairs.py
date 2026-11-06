"""Two-file input: question.md (header, questions, options) + answer.md (answer, explanation, note page).

The two files are matched by question number and cross-checked (same question text, the answer's option text equals
the option in question.md), then merged into the same ParsedFile that a single-file import produces. Nothing here
touches the network.
"""
from pathlib import Path

from .parser import LABELS, ParsedFile, parse_file

QUESTION_NAMES = ("question.md", "questions.md")
ANSWER_NAME = "answer.md"


def norm(text: str) -> str:
    return " ".join(text.split()).casefold()


def question_file_in(folder: Path) -> Path | None:
    for name in QUESTION_NAMES:
        if (folder / name).is_file():
            return folder / name
    return None


def load_pair(question_path: Path, answer_path: Path) -> ParsedFile:
    qf = parse_file(question_path, "questions")
    af = parse_file(answer_path, "answers")
    pf = ParsedFile(path=str(question_path), subject=qf.subject, topic=qf.topic, lang=qf.lang)
    pf.errors = list(qf.errors) + list(af.errors)
    qname, aname = Path(question_path).name, Path(answer_path).name
    if af.subject and af.subject.casefold() != qf.subject.casefold():
        pf.errors.append(f"{aname}: header subject '{af.subject}' differs from {qname} ('{qf.subject}')")
    if af.topic is not None and af.topic != qf.topic:
        pf.errors.append(f"{aname}: header topic {af.topic} differs from {qname} ({qf.topic})")

    answers = {a.number: a for a in af.questions}
    for q in qf.questions:
        a = answers.pop(q.number, None)
        if a is None:
            q.errors.append(f"no answer for Q{q.number} in {aname}")
            pf.questions.append(q)
            continue
        if norm(a.text) != norm(q.text):
            q.errors.append(f"the question text of Q{q.number} in {aname} differs from {qname} (the files are out of step)")
        if a.answer in LABELS and a.answer_text and norm(a.answer_text) != norm(q.options.get(a.answer, "")):
            q.errors.append(f"{aname} says the answer is {a.answer}. '{a.answer_text[:40]}' but option {a.answer} in {qname} is '{q.options.get(a.answer, '')[:40]}'")
        q.answer, q.reason, q.page = a.answer, a.reason, a.page
        if q.answer in LABELS and q.answer not in q.options:
            q.errors.append(f"{aname} says the answer is {q.answer} but Q{q.number} in {qname} has no option {q.answer}")
        q.figure, q.figure_caption = a.figure, a.figure_caption
        q.topic = a.topic or q.topic
        q.lang = a.lang or q.lang
        q.errors += a.errors
        q.warnings += a.warnings
        pf.questions.append(q)
    for number in sorted(answers):
        pf.errors.append(f"{aname} has Q{number} but {qname} does not")
    return pf
