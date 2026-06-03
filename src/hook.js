import readline from 'readline'
import { createReadStream } from 'fs'
import { getConfig, setGlobalConfig, setLocalConfig } from './configManager.js'
import { createComment, updateStoryStatus } from './apiClient.js'
import { parsePushInput } from './pushInputParser.js'
import { getCommitsInRange } from './gitClient.js'
import { buildCommentContent } from './commentBuilder.js'
import { extractStoryRefs } from './storyIdExtractor.js'
import { detectLang, t } from './i18n.js'
import { checkForUpdate } from './updateChecker.js'

function debug(msg) {
  if (process.env.TRACKER_DEBUG) {
    process.stderr.write(`[tracker-boot debug] ${msg}\n`)
  }
}

function openTtyPrompt(question) {
  return new Promise((resolve, reject) => {
    const tty = createReadStream('/dev/tty')
    tty.on('error', (err) => {
      reject(new Error(`Interactive setup required — run git push from a terminal first (${err.message})`))
    })
    const rl = readline.createInterface({ input: tty, output: process.stderr })
    rl.question(question, (answer) => {
      rl.close()
      tty.destroy()
      resolve(answer.trim())
    })
  })
}

async function ensureCredentials({ lang, deps }) {
  let apiKey = process.env.TRACKER_BOOT_API_KEY || deps.getConfig('tracker.apiKey', { global: true })
  let projectId = process.env.TRACKER_BOOT_PROJECT_ID || deps.getConfig('tracker.projectId', { local: true })

  if (!apiKey) {
    apiKey = await deps.prompt(t('promptApiKey', lang))
    deps.setGlobalConfig('tracker.apiKey', apiKey)
    process.stderr.write(t('apiKeyStored', lang) + '\n')
  }

  if (!projectId) {
    projectId = await deps.prompt(t('promptProjectId', lang))
    deps.setLocalConfig('tracker.projectId', projectId)
    process.stderr.write(t('projectIdStored', lang) + '\n')
  }

  return { apiKey, projectId }
}

export async function runHook({ stdin, mutationUrl, remoteName, remoteUrl }, inject = {}) {
  const lang = detectLang(process.env.LANG)
  const deps = {
    getConfig,
    setGlobalConfig,
    setLocalConfig,
    createComment,
    updateStoryStatus,
    getCommitsInRange,
    prompt: openTtyPrompt,
    checkForUpdate,
    ...inject,
  }

  const updateCheck = deps.checkForUpdate()

  debug(`stdin: ${JSON.stringify(stdin)}`)
  debug(`mutationUrl: ${mutationUrl}`)

  const ranges = parsePushInput(stdin)
  debug(`parsed ${ranges.length} ref range(s): ${JSON.stringify(ranges)}`)

  const work = []
  for (const { localSha, remoteSha } of ranges) {
    let commits
    try {
      commits = deps.getCommitsInRange(remoteSha, localSha, { remote: remoteName })
    } catch (err) {
      process.stderr.write(`tracker-boot-git-hooks: ${err.message}\n`)
      continue
    }
    debug(`found ${commits.length} commit(s) in ${remoteSha}..${localSha}`)
    for (const commit of commits) {
      const text = commit.body ? `${commit.subject}\n${commit.body}` : commit.subject
      const refs = extractStoryRefs(text)
      debug(`commit ${commit.sha}: subject="${commit.subject}" refs=${JSON.stringify(refs)}`)
      for (const { id: storyId, shouldFinish } of refs) {
        work.push({ commit, storyId, shouldFinish })
      }
    }
  }

  if (work.length === 0) return

  let credentials
  try {
    credentials = await ensureCredentials({ lang, deps })
  } catch (err) {
    process.stderr.write(`tracker-boot-git-hooks: setup failed: ${err.message}\n`)
    return
  }
  const { apiKey, projectId } = credentials
  debug(`projectId: ${projectId}`)

  for (const { commit, storyId, shouldFinish } of work) {
    const content = buildCommentContent({ ...commit, remoteUrl })
    debug(`posting comment for story ${storyId}`)
    let commentOk = false
    try {
      await deps.createComment({ mutationUrl, apiKey, projectId, storyId, content })
      commentOk = true
    } catch (err) {
      process.stderr.write(t('apiError', lang, { storyId, message: err.message }) + '\n')
    }
    if (commentOk && shouldFinish) {
      debug(`updating status to Finished for story ${storyId}`)
      try {
        await deps.updateStoryStatus({ mutationUrl, apiKey, projectId, storyId, status: 'Finished' })
        process.stderr.write(t('commentPostedAndFinished', lang, { storyId }) + '\n')
      } catch (err) {
        process.stderr.write(t('commentPosted', lang, { storyId }) + '\n')
        process.stderr.write(t('statusUpdateError', lang, { storyId, message: err.message }) + '\n')
      }
    } else if (commentOk) {
      process.stderr.write(t('commentPosted', lang, { storyId }) + '\n')
    }
  }

  const update = await updateCheck
  if (update) {
    process.stderr.write(t('updateAvailable', lang, { latest: update.latest, current: update.current }) + '\n')
  }
}
