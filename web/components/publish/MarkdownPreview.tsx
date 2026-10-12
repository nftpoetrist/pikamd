"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// Rendered view of a guideline. rehype-sanitize strips raw HTML, scripts and
// javascript: links on display; the file itself is never changed (ARCHITECTURE §9.1).
export default function MarkdownPreview({ content }: { content: string }) {
  // Frontmatter isn't Markdown: show it as a small code block instead of a stray rule + heading.
  const front = content.match(/^---\n([\s\S]*?)\n---\n?/);
  const body = front ? content.slice(front[0].length) : content;

  return (
    <div className="md-render">
      {front && <pre className="md-render-front">{front[1]}</pre>}
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
