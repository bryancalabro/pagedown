// assembles the final document and the numbers in the strip: title line, optional yaml
// front matter, word count, reading time and a token estimate.

export interface Meta {
  title: string
  byline: string
  url: string
  fetchedAt: string
}

/** yaml double-quoted scalar: escapes backslashes, quotes and control characters */
export function yamlString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r\t]/g, ' ')}"`
}

export function frontMatter(meta: Meta): string {
  return ['---', `title: ${yamlString(meta.title)}`, `source: ${yamlString(meta.url)}`, `byline: ${yamlString(meta.byline)}`, `fetched: ${meta.fetchedAt.slice(0, 10)}`, '---'].join('\n')
}

/** the document a reader copies or downloads */
export function compose(body: string, meta: Meta, withFrontMatter: boolean): string {
  const head = `# ${meta.title.replace(/\n/g, ' ')}`
  const doc = body.startsWith('# ') ? body : `${head}\n\n${body}`
  return (withFrontMatter ? `${frontMatter(meta)}\n\n${doc}` : doc) + '\n'
}

/** words a person would read: markdown syntax and bare urls do not count */
export function countWords(markdown: string): number {
  const text = markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\[\d+\]: .*$/gm, '')
    .replace(/[#>*_`|~-]/g, ' ')
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** minutes at 230 words a minute, never less than one */
export const readingMinutes = (words: number) => Math.max(1, Math.ceil(words / 230))

/** a rough token count for pasting into a chat model: four characters a token, rounded up */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4)
