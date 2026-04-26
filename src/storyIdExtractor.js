const KEYWORDS = ['fixed', 'fixes', 'finish', 'finishes', 'finished', 'completes', 'completed', 'delivers', 'delivered']
const KW = `(?:${KEYWORDS.join('|')})`
const STORY_PATTERN = new RegExp(`\\[(?:${KW}\\s+)?#([0-9]{9})(?:\\s+${KW})?\\]`, 'g')

export function extractStoryIds(commitMessage) {
  const ids = new Set()
  for (const match of commitMessage.matchAll(STORY_PATTERN)) {
    ids.add(match[1])
  }
  return Array.from(ids)
}
