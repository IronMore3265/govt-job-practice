// Reads a JSON array of LaTeX strings on stdin and prints a JSON array with null (parses) or an error message.
// Uses the KaTeX that the website already installs, so the importer accepts exactly what the site can draw.
const path = require("path");
const katexPath = process.argv[2];
let katex;
try {
  katex = require(path.resolve(katexPath));
} catch (e) {
  process.stdout.write(JSON.stringify({ unavailable: String(e.message).split("\n")[0] }));
  process.exit(0);
}
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const items = JSON.parse(input);
  const out = items.map((latex) => {
    try {
      katex.renderToString(latex, { throwOnError: true, strict: false });
      return null;
    } catch (e) {
      return String(e.message).replace(/^KaTeX parse error: /, "");
    }
  });
  process.stdout.write(JSON.stringify({ results: out }));
});
