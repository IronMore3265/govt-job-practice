"""Import tool for the Govt Job practice site. Runs on the laptop, never deployed.

Reads question Markdown files (docs/QUESTION_FORMAT.md), validates them, and writes questions, note PDFs and figures
to the Supabase project with the service role key from import-tool/.env. No AI is called anywhere.
"""
