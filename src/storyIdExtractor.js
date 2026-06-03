const FINISH_KEYWORDS = new Set(['finish', 'finishes', 'finished'])
const KEYWORDS = ['fixed', 'fixes', 'finish', 'finishes', 'finished', 'completes', 'completed', 'delivers', 'delivered']
const KW = `(?:${KEYWORDS.join('|')})`
const STORY_PATTERN = new RegExp(`\\[(?:(${KW})\\s+)?#([0-9]{9})(?:\\s+(${KW}))?\\]`, 'gi')

export function extractStoryRefs(commitMessage) {
  const seen = new Set()
  const refs = []
  for (const match of commitMessage.matchAll(STORY_PATTERN)) {
    const id = match[2]
    if (seen.has(id)) continue
    seen.add(id)
    const keyword = (match[1] ?? match[3] ?? '').toLowerCase()
    refs.push({ id, shouldFinish: FINISH_KEYWORDS.has(keyword) })
  }
  return refs
}

export function extractStoryIds(commitMessage) {
  return extractStoryRefs(commitMessage).map(ref => ref.id)
}
