"""Command line: python -m govtimport <check|import|notes|figure|report> ... (run from the import-tool folder)."""
import argparse
import sys
from pathlib import Path

from . import importer, notes, report
from .checks import FIGURE_EXT, FIGURE_MAX, check_files
from .client import Supabase
from .parser import ParsedFile, parse_file


def expand(paths: list[str]) -> list[Path]:
    files: list[Path] = []
    for p in map(Path, paths):
        files += sorted(f for f in p.rglob("*.md") if f.name.lower() != "readme.md") if p.is_dir() else [p]
    return files


def load(paths: list[str], figures_dir: str | None) -> tuple[list[ParsedFile], int]:
    """Parse and check files, print every problem. Returns (files, number of errors)."""
    files = [parse_file(p) for p in expand(paths)]
    if not files:
        raise SystemExit("No Markdown files given.")
    for note in check_files(files, Path(figures_dir) if figures_dir else None):
        print(f"note: {note}")
    errors = 0
    for pf in files:
        for e in pf.errors:
            print(f"ERROR {e}")
            errors += 1
        for q in pf.questions:
            for e in q.errors:
                print(f"ERROR {q.label}: {e}")
                errors += 1
            for w in q.warnings:
                print(f"warning {q.label}: {w}")
    total = sum(len(pf.questions) for pf in files)
    print(f"\n{len(files)} file(s), {total} question(s), {errors} error(s).")
    return files, errors


def print_report(db, topic_ids: set | None) -> None:
    lines = report.short_sets(db, topic_ids)
    if not lines:
        return
    print("\nSet status per exam (questions are filled into sets of the exam's size):")
    for line in lines:
        print(f"  {'SHORT ' if line.topics and line.missing else 'ok    '}{line.describe()}")


def cmd_check(a) -> int:
    _, errors = load(a.files, a.figures_dir)
    print("Nothing was written. Fix the errors above, then run 'import'." if errors else "All good. Nothing was written (this was a check only).")
    return 1 if errors else 0


def cmd_import(a) -> int:
    files, errors = load(a.files, a.figures_dir)
    if errors:
        print("Nothing was imported. Fix the errors above first.")
        return 1
    db = Supabase.from_env()
    out = importer.run(db, files, Path(a.figures_dir) if a.figures_dir else None, approve=a.approve, dry_run=a.dry_run)
    for e in out.errors:
        print(f"ERROR {e}")
    if out.errors:
        print(f"\nStopped. {out.imported} question(s) were imported before the problem; run again after fixing it, finished ones are skipped.")
        return 1
    verb = "Would import" if a.dry_run else "Imported"
    status = "approved" if a.approve else "drafts"
    print(f"\n{verb} {out.imported} question(s) as {status}, skipped {out.skipped} that already exist, {out.figures_used} figure(s) used.")
    if a.dry_run:
        print("Dry run: nothing was written.")
    elif not a.approve and out.imported:
        print("They are drafts. Approve them in the admin question bank (Phase 3) or re-run with --approve.")
    print_report(db, out.topic_ids | {i.topic["id"] for i in out.items})
    return 0


def cmd_notes(a) -> int:
    db = Supabase.from_env()
    try:
        rep, blob = notes.upload_note(db, a.subject, a.topic, Path(a.file), dry_run=a.dry_run)
    except LookupError as e:
        print(f"ERROR {e}")
        return 1
    for w in rep.warnings:
        print(f"warning {w}")
    for e in rep.errors:
        print(f"ERROR {e}")
    if rep.errors:
        return 1
    print(f"{'Would upload' if a.dry_run else 'Uploaded'} {Path(a.file).name} ({rep.pages} pages, {rep.size / 1048576:.1f} MB) to notes/{blob}")
    return 0


def cmd_figure(a) -> int:
    path = Path(a.file)
    if path.suffix.lower() not in FIGURE_EXT or not path.is_file():
        print("ERROR the figure must be an existing .png, .jpg or .webp file")
        return 1
    if path.stat().st_size > FIGURE_MAX:
        print(f"ERROR the figure is over {FIGURE_MAX // 1048576} MB")
        return 1
    db = Supabase.from_env()
    try:
        subject = importer.find_subject(db, a.subject)
        topic = importer.find_topic(db, subject, a.topic)
    except LookupError as e:
        print(f"ERROR {e}")
        return 1
    fid = importer.upload_figure(db, subject, topic, path, a.page, a.label, a.caption)
    print(f"Figure stored (id {fid}). A question links to it with '**Figure:** {path.name}' in its Markdown.")
    return 0


def cmd_report(_a) -> int:
    print_report(Supabase.from_env(), None)
    return 0


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")  # Bangla must print on a Windows console
    p = argparse.ArgumentParser(prog="govtimport", description="Import questions, note PDFs and figures.")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("check", help="validate Markdown files, offline, writes nothing")
    c.add_argument("files", nargs="+")
    c.add_argument("--figures-dir", help="folder with figure images (default: a 'figures' folder next to each file)")
    c.set_defaults(fn=cmd_check)

    i = sub.add_parser("import", help="validate, then write questions to Supabase (as drafts unless --approve)")
    i.add_argument("files", nargs="+")
    i.add_argument("--approve", action="store_true", help="approve each question right after importing it")
    i.add_argument("--dry-run", action="store_true", help="read the database, but write nothing")
    i.add_argument("--figures-dir")
    i.set_defaults(fn=cmd_import)

    n = sub.add_parser("notes", help="upload a note PDF for a topic")
    n.add_argument("file")
    n.add_argument("--subject", required=True)
    n.add_argument("--topic", required=True, type=int, help="topic number")
    n.add_argument("--dry-run", action="store_true")
    n.set_defaults(fn=cmd_notes)

    f = sub.add_parser("figure", help="upload one figure image for a topic")
    f.add_argument("file")
    f.add_argument("--subject", required=True)
    f.add_argument("--topic", required=True, type=int)
    f.add_argument("--page", type=int)
    f.add_argument("--label")
    f.add_argument("--caption")
    f.set_defaults(fn=cmd_figure)

    r = sub.add_parser("report", help="list exams whose last set is short, and how many questions are missing")
    r.set_defaults(fn=cmd_report)

    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
