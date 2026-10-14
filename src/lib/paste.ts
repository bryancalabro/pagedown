// the app's own content security policy refuses inline styles, even in a document DOMParser
// builds from pasted html, and the converter needs none of them
/** pasted html without <style> blocks, stylesheet links or style attributes */
export function withoutStyles(html: string): string {
  return html
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
}
