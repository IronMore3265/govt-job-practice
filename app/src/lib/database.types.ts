// Types for the Phase 1 schema (supabase/migrations). Written by hand to match the migrations.
// Once the Supabase CLI is linked, regenerate with: npx supabase gen types typescript --project-id kjeolamvvggqobhlcwhn
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel<Name extends string, Cols extends string[], Ref extends string, RefCols extends string[]> = {
  foreignKeyName: Name;
  columns: Cols;
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: RefCols;
};

type UserRole = "student" | "admin";
type UserStatus = "pending" | "active" | "disabled";
type QuestionLang = "en" | "bn";
type QuestionOrigin = "manual" | "import";
type QuestionStatus = "draft" | "approved";
type SetOrigin = "auto" | "curated";
type SetStatus = "draft" | "live";
type ReportStatus = "open" | "resolved";
type NotificationKind = "new_signup" | "question_report";

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  invite_limit: number;
  invited_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  leaderboard_since: string | null;
  created_at: string;
};

type InviteRow = {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
};

type SubjectRow = { id: string; name: string; sort_order: number; created_at: string };

type TopicRow = {
  id: string;
  subject_id: string;
  number: number;
  title: string;
  note_path: string | null;
  note_pages: number | null;
  created_at: string;
};

type FigureRow = {
  id: string;
  topic_id: string;
  page: number | null;
  label: string | null;
  caption: string | null;
  blob_path: string;
  created_at: string;
};

type QuestionRow = {
  id: string;
  subject_id: string;
  topic_id: string;
  lang: QuestionLang;
  text: string;
  figure_id: string | null;
  source_page: number | null;
  origin: QuestionOrigin;
  status: QuestionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type McqOptionRow = {
  id: string;
  question_id: string;
  label: "A" | "B" | "C" | "D";
  text: string;
  is_correct: boolean;
  explanation: string | null;
};

type ExamRow = {
  id: string;
  subject_id: string | null;
  name: string;
  question_count: number;
  marks_per_question: number;
  negative_mark: number;
  time_seconds: number;
  sort_order: number;
  all_topics: boolean;
  created_at: string;
};

type ExamTopicRow = { exam_id: string; topic_id: string };

type QuestionSetRow = {
  id: string;
  exam_id: string;
  name: string;
  origin: SetOrigin;
  status: SetStatus;
  question_ids: string[];
  created_by: string | null;
  created_at: string;
};

type SessionRunRow = {
  id: string;
  user_id: string;
  exam_id: string;
  set_id: string | null;
  retry_of: string | null;
  topic_ids: string[];
  chunk: number | null;
  created_at: string;
  started_at: string | null;
  deadline_at: string | null;
  finished_at: string | null;
  timed_out: boolean;
  score: number | null;
  negative_applied: number | null;
  max_score: number | null;
};

type AttemptRow = {
  id: string;
  session_run_id: string;
  question_id: string;
  user_id: string;
  position: number;
  selected_option: string | null;
  is_correct: boolean | null;
  marked_for_review: boolean;
  seconds_spent: number;
  answered_at: string | null;
};

type NoteProgressRow = { user_id: string; topic_id: string; last_page: number; updated_at: string };

type NoteAnnotationRow = {
  id: string;
  user_id: string;
  topic_id: string;
  page: number;
  kind: "highlight" | "comment";
  color: "yellow" | "green" | "pink";
  quote: string;
  rects: Json;
  comment: string | null;
  clip: string | null;
  has_clip: boolean;
  created_at: string;
  updated_at: string;
};

type QuestionReportRow = {
  id: string;
  question_id: string;
  user_id: string;
  note: string;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  ref_profile_id: string | null;
  ref_report_id: string | null;
  created_at: string;
  read_at: string | null;
};

type AppSettingRow = { id: number; leaderboard_on: boolean; updated_at: string };

// Insert: columns with a default (or nullable) are optional. Update: everything optional.
type Table<Row, Required extends keyof Row, Relationships extends unknown[]> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14";
  };
  public: {
    Tables: {
      profile: Table<
        ProfileRow,
        "id" | "name" | "email",
        [
          Rel<"profile_invited_by_fkey", ["invited_by"], "profile", ["id"]>,
          Rel<"profile_approved_by_fkey", ["approved_by"], "profile", ["id"]>,
        ]
      >;
      invite: Table<
        InviteRow,
        "code" | "created_by",
        [
          Rel<"invite_created_by_fkey", ["created_by"], "profile", ["id"]>,
          Rel<"invite_used_by_fkey", ["used_by"], "profile", ["id"]>,
        ]
      >;
      subject: Table<SubjectRow, "name", []>;
      topic: Table<TopicRow, "subject_id" | "number" | "title", [Rel<"topic_subject_id_fkey", ["subject_id"], "subject", ["id"]>]>;
      figure: Table<FigureRow, "topic_id" | "blob_path", [Rel<"figure_topic_id_fkey", ["topic_id"], "topic", ["id"]>]>;
      question: Table<
        QuestionRow,
        "subject_id" | "topic_id" | "text",
        [
          Rel<"question_topic_id_subject_id_fkey", ["topic_id", "subject_id"], "topic", ["id", "subject_id"]>,
          Rel<"question_figure_id_fkey", ["figure_id"], "figure", ["id"]>,
          Rel<"question_created_by_fkey", ["created_by"], "profile", ["id"]>,
        ]
      >;
      mcq_option: Table<
        McqOptionRow,
        "question_id" | "label" | "text",
        [Rel<"mcq_option_question_id_fkey", ["question_id"], "question", ["id"]>]
      >;
      exam: Table<ExamRow, "name", [Rel<"exam_subject_id_fkey", ["subject_id"], "subject", ["id"]>]>;
      exam_topic: Table<
        ExamTopicRow,
        "exam_id" | "topic_id",
        [
          Rel<"exam_topic_exam_id_fkey", ["exam_id"], "exam", ["id"]>,
          Rel<"exam_topic_topic_id_fkey", ["topic_id"], "topic", ["id"]>,
        ]
      >;
      question_set: Table<
        QuestionSetRow,
        "exam_id" | "name",
        [
          Rel<"question_set_exam_id_fkey", ["exam_id"], "exam", ["id"]>,
          Rel<"question_set_created_by_fkey", ["created_by"], "profile", ["id"]>,
        ]
      >;
      session_run: Table<
        SessionRunRow,
        "user_id" | "exam_id",
        [
          Rel<"session_run_user_id_fkey", ["user_id"], "profile", ["id"]>,
          Rel<"session_run_exam_id_fkey", ["exam_id"], "exam", ["id"]>,
          Rel<"session_run_set_id_fkey", ["set_id"], "question_set", ["id"]>,
          Rel<"session_run_retry_of_fkey", ["retry_of"], "session_run", ["id"]>,
        ]
      >;
      attempt: Table<
        AttemptRow,
        "session_run_id" | "question_id" | "user_id" | "position",
        [
          Rel<"attempt_session_run_id_user_id_fkey", ["session_run_id", "user_id"], "session_run", ["id", "user_id"]>,
          Rel<"attempt_question_id_fkey", ["question_id"], "question", ["id"]>,
          Rel<"attempt_selected_option_fkey", ["selected_option"], "mcq_option", ["id"]>,
        ]
      >;
      note_progress: Table<
        NoteProgressRow,
        "user_id" | "topic_id",
        [
          Rel<"note_progress_user_id_fkey", ["user_id"], "profile", ["id"]>,
          Rel<"note_progress_topic_id_fkey", ["topic_id"], "topic", ["id"]>,
        ]
      >;
      note_annotation: Table<
        NoteAnnotationRow,
        "user_id" | "topic_id" | "page",
        [
          Rel<"note_annotation_user_id_fkey", ["user_id"], "profile", ["id"]>,
          Rel<"note_annotation_topic_id_fkey", ["topic_id"], "topic", ["id"]>,
        ]
      >;
      question_report: Table<
        QuestionReportRow,
        "question_id" | "user_id" | "note",
        [
          Rel<"question_report_question_id_fkey", ["question_id"], "question", ["id"]>,
          Rel<"question_report_user_id_fkey", ["user_id"], "profile", ["id"]>,
          Rel<"question_report_resolved_by_fkey", ["resolved_by"], "profile", ["id"]>,
        ]
      >;
      notification: Table<
        NotificationRow,
        "user_id" | "kind",
        [
          Rel<"notification_user_id_fkey", ["user_id"], "profile", ["id"]>,
          Rel<"notification_ref_profile_id_fkey", ["ref_profile_id"], "profile", ["id"]>,
          Rel<"notification_ref_report_id_fkey", ["ref_report_id"], "question_report", ["id"]>,
        ]
      >;
      app_setting: Table<AppSettingRow, never, []>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_invite: { Args: never; Returns: InviteRow };
      redeem_invite: { Args: { p_code: string; p_user_id: string; p_name: string; p_email: string }; Returns: undefined };
      start_session: { Args: { p_exam_id: string; p_set_id: string | null; p_topic_ids: string[] | null; p_retry_of: string | null; p_chunk?: number | null }; Returns: string };
      topic_sets: { Args: { p_exam_id: string }; Returns: { topic_id: string; chunk: number; size: number; best_score: number | null; last_score: number | null; max_score: number | null; tries: number }[] };
      my_revision: { Args: never; Returns: Json };
      mark_revised: { Args: { p_question_ids: string[] }; Returns: number };
      begin_session: { Args: { p_session_id: string }; Returns: string };
      session_state: { Args: { p_session_id: string }; Returns: Json };
      save_answer: { Args: { p_session_id: string; p_question_id: string; p_option_id: string | null; p_marked: boolean; p_seconds: number }; Returns: string };
      finish_session: { Args: { p_session_id: string; p_timed_out: boolean }; Returns: Json };
      get_review: { Args: { p_session_id: string }; Returns: Json };
      my_history: {
        Args: never;
        Returns: {
          session_id: string;
          exam_id: string;
          exam_name: string;
          set_name: string | null;
          is_retry: boolean;
          finished_at: string;
          timed_out: boolean;
          score: number;
          max_score: number;
          negative_applied: number;
          correct: number;
          wrong: number;
          skipped: number;
          total: number;
          seconds_used: number;
        }[];
      };
      my_topic_stats: {
        Args: never;
        Returns: { topic_id: string; topic_number: number; topic_title: string; subject_name: string; asked: number; correct: number }[];
      };
      my_set_scores: { Args: { p_exam_id: string }; Returns: { set_id: string; best_score: number; last_score: number; max_score: number; tries: number }[] };
      my_open_session: { Args: never; Returns: Json };
      join_leaderboard: { Args: never; Returns: undefined };
      leave_leaderboard: { Args: never; Returns: undefined };
      leaderboard: { Args: { p_exam_id: string }; Returns: Json };
      admin_storage_usage: { Args: never; Returns: Json };
      admin_save_question: {
        Args: {
          p_id: string | null;
          p_topic_id: string;
          p_lang: QuestionLang;
          p_text: string;
          p_figure_id: string | null;
          p_source_page: number | null;
          p_options: Json;
          p_correct: string;
          p_explanation: string;
          p_status: QuestionStatus;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      question_lang: QuestionLang;
      question_origin: QuestionOrigin;
      question_status: QuestionStatus;
      set_origin: SetOrigin;
      set_status: SetStatus;
      report_status: ReportStatus;
      notification_kind: NotificationKind;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = ProfileRow;
export type Invite = InviteRow;
export type Subject = SubjectRow;
export type Topic = TopicRow;
export type Exam = ExamRow;
export type Notification = NotificationRow;
