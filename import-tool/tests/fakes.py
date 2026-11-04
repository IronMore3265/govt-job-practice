"""An in-memory stand-in for the Supabase client. It understands the eq. and in. filters the tool uses."""
import itertools
import re

_ids = itertools.count(1)


class FakeDB:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {
            "subject": [], "topic": [], "question": [], "mcq_option": [], "figure": [], "exam": [], "exam_topic": [],
        }
        self.objects: dict[tuple, bytes] = {}
        self.mangle = None  # function applied to every text value on insert, to simulate lost characters
        self.fail_options = False

    # -- fixtures
    def add_subject(self, name: str) -> dict:
        return self._add("subject", {"name": name})

    def add_topic(self, subject: dict, number: int, title: str = "T") -> dict:
        return self._add("topic", {"subject_id": subject["id"], "number": number, "title": title, "note_path": None, "note_pages": None})

    def add_exam(self, name: str, topics: list, count: int = 20) -> dict:
        exam = self._add("exam", {"name": name, "question_count": count})
        for t in topics:
            self.tables["exam_topic"].append({"exam_id": exam["id"], "topic_id": t["id"]})
        return exam

    def _add(self, table: str, row: dict) -> dict:
        row = {"id": f"id{next(_ids)}", **row}
        self.tables[table].append(row)
        return row

    # -- client interface
    def _match(self, row: dict, params: dict) -> bool:
        for key, cond in (params or {}).items():
            if key in ("select", "order"):
                continue
            op, _, val = cond.partition(".")
            if op == "eq" and str(row.get(key)) != val:
                return False
            if op == "in" and str(row.get(key)) not in re.sub(r"[()]", "", val).split(","):
                return False
        return True

    def select(self, table, params=None):
        return [dict(r) for r in self.tables[table] if self._match(r, params)]

    def insert(self, table, rows):
        if table == "mcq_option" and self.fail_options:
            raise RuntimeError("insert into mcq_option failed (simulated)")
        out = []
        for row in rows:
            row = {k: (self.mangle(v) if self.mangle and isinstance(v, str) and k in ("text", "explanation") else v) for k, v in row.items()}
            out.append(dict(self._add(table, row)))
        return out

    def update(self, table, params, values):
        hit = [r for r in self.tables[table] if self._match(r, params)]
        for r in hit:
            r.update(values)
        return [dict(r) for r in hit]

    def delete(self, table, params):
        gone = [r for r in self.tables[table] if self._match(r, params)]
        self.tables[table] = [r for r in self.tables[table] if r not in gone]
        if table == "question":
            ids = {r["id"] for r in gone}
            self.tables["mcq_option"] = [o for o in self.tables["mcq_option"] if o["question_id"] not in ids]

    def put_object(self, bucket, path, data, mime):
        self.objects[(bucket, path)] = data
