// Migration 0: brings existing items and users in line with the field rules added in
// hub-be/src/validation/textFields.ts (lengths, username format, http(s)-only links). Payload
// checks every field on each save, so until this has run, items and profiles that break a rule
// can't be saved at all, also not by the hub itself (e.g. adding a new item to its author's list).
// Run it before (or right after) deploying that change.
//
// From the repository root, with hub-be's dependencies installed:
//   node scripts/migration/0-limit-field-lengths.js            fix what it can, ask about the rest
//   node scripts/migration/0-limit-field-lengths.js --yes      take the suggested fix for everything
//   node scripts/migration/0-limit-field-lengths.js --dry-run  only list what would change
// The database comes from DATABASE_URI, or else hub-be/.env. Running it again only touches
// values that still break a rule.
'use strict'

const path = require('path')
const readline = require('readline/promises')
const { createRequire } = require('module')

const hubBe = path.resolve(__dirname, '..', '..', 'hub-be')
const requireFromBackend = createRequire(path.join(hubBe, 'package.json'))
// npm installs the driver inside mongoose, out of reach of a plain require('mongodb')
const { MongoClient } = requireFromBackend('mongoose').mongo
requireFromBackend('dotenv').config({ path: path.join(hubBe, '.env'), quiet: true })

// The rules as of this migration; later changes to textFields.ts need a migration of their own
const TITLE_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 5000
const NAME_MAX_LENGTH = 100
const USERNAME_MAX_LENGTH = 40
const LINK_MAX_LENGTH = 500
const USERNAME_PATTERN = /^[a-z0-9_](?:[a-z0-9._-]*[a-z0-9_])?$/
const LINK_PATTERN = /^https?:\/\/[^\s/?#]+[^\s]*$/i

const isValidUsername = (value) =>
  typeof value === 'string' && value.length <= USERNAME_MAX_LENGTH && USERNAME_PATTERN.test(value)
const isValidLink = (value) =>
  !value || (typeof value === 'string' && value.length <= LINK_MAX_LENGTH && LINK_PATTERN.test(value))
const fitsIn = (max) => (value) => value.length > 0 && value.length <= max

// Shown in the terminal as JSON, so stored text can't send escape codes to it
const show = (value, max = 80) =>
  JSON.stringify(typeof value === 'string' && value.length > max ? `${value.slice(0, max)}…` : value)

// Cut to `max` characters ending in "…", without splitting a character made of two UTF-16 units
const shorten = (value, max) => {
  let cut = value.slice(0, max - 1)
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

// Same as uniqueUsername() in hub-be/src/payload.config.ts: "Jane Doe" -> "jane-doe", then
// "jane-doe-2", ... if that is taken
const freeUsername = (source, taken) => {
  const base =
    String(source ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .slice(0, USERNAME_MAX_LENGTH - 7)
      .replace(/^[-.]+|[-.]+$/g, '') || 'user'
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

// The profile page used to open links without a scheme as https://, so do the same here
const withScheme = (link) => {
  if (/^[a-z][a-z\d+\-.]*:/i.test(link)) return link
  return link.startsWith('//') ? `https:${link}` : `https://${link}`
}

// One value that breaks a rule. `fixed` is set when the fix loses nothing; otherwise
// `suggestion` is offered and `isValid` checks a replacement typed in instead
const tooLong = (collection, doc, label, field, max) => {
  const value = doc[field]
  if (typeof value !== 'string' || value.length <= max) return []
  const suggestion = shorten(value, max)
  return [
    {
      collection,
      doc,
      label,
      field,
      problem: `is ${value.length} characters long (at most ${max})`,
      suggestion,
      describe: `cut it to ${suggestion.length} characters, dropping ${show(value.slice(suggestion.length - 1), 60)}`,
      isValid: fitsIn(max),
    },
  ]
}

const findItemProblems = async (db) => {
  const items = await db
    .collection('items')
    .find({}, { projection: { title: 1, description: 1 } })
    .toArray()
  return items.flatMap((item) => {
    const label = `Item ${item._id} ${show(item.title, 60)}`
    return [
      ...tooLong('items', item, label, 'title', TITLE_MAX_LENGTH),
      ...tooLong('items', item, label, 'description', DESCRIPTION_MAX_LENGTH),
    ]
  })
}

const findUserProblems = async (db) => {
  const users = await db
    .collection('users')
    .find({}, { projection: { name: 1, username: 1, link: 1 } })
    .toArray()
  const taken = new Set(users.map((user) => user.username).filter(Boolean))

  return users.flatMap((user) => {
    const label = `User ${user._id} ${show(user.username, 60)}`
    const base = { collection: 'users', doc: user, label }
    const problems = tooLong('users', user, label, 'name', NAME_MAX_LENGTH)

    if (!isValidUsername(user.username)) {
      const fixed = freeUsername(user.username || user.name, taken)
      taken.add(fixed)
      problems.push({ ...base, field: 'username', problem: 'breaks the username rules', fixed })
    }

    if (!isValidLink(user.link)) {
      const trimmed = String(user.link).trim()
      const fixed = trimmed ? withScheme(trimmed) : ''
      problems.push(
        isValidLink(fixed)
          ? { ...base, field: 'link', problem: 'is not a full web address', fixed }
          : {
              ...base,
              field: 'link',
              problem: `${show(user.link)} is not an http(s) web address`,
              suggestion: '',
              describe: 'remove the link',
              isValid: (value) => isValidLink(value),
            },
      )
    }
    return problems
  })
}

// The new value for a problem, or undefined to leave it as it is for now
const decide = async (problem, { yes, dryRun }, rl) => {
  const where = `${problem.label}: ${problem.field} ${problem.problem}`
  if ('fixed' in problem) {
    console.log(`${where}\n  -> ${show(problem.fixed)}`)
    return problem.fixed
  }
  console.log(`${where}\n  Suggested: ${problem.describe}`)
  if (yes || dryRun) return problem.suggestion

  for (;;) {
    const answer = await rl.question(
      '  Enter = use the suggestion, :skip = leave it for now, or type a replacement: ',
    )
    if (answer === '') return problem.suggestion
    if (answer.trim() === ':skip') return undefined
    if (problem.isValid(answer.trim())) return answer.trim()
    console.log('  That breaks the rules too, try again.')
  }
}

const main = async () => {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => arg !== '--yes' && arg !== '--dry-run')
  if (unknown.length) {
    console.error(`Unknown option ${unknown[0]}. Use --yes, --dry-run or nothing.`)
    process.exitCode = 1
    return
  }
  const options = { yes: args.includes('--yes'), dryRun: args.includes('--dry-run') }

  const uri = process.env.DATABASE_URI
  if (!uri) {
    console.error(`DATABASE_URI is not set, neither in the environment nor in ${hubBe}/.env`)
    process.exitCode = 1
    return
  }

  const client = new MongoClient(uri)
  let rl
  try {
    await client.connect()
    const db = client.db()
    const problems = [...(await findItemProblems(db)), ...(await findUserProblems(db))]
    if (!problems.length) {
      console.log('Nothing to change: all items and users follow the rules.')
      return
    }

    const needsAnswers = problems.some((problem) => !('fixed' in problem))
    if (needsAnswers && !options.yes && !options.dryRun) {
      if (!process.stdin.isTTY) {
        console.error('Some values need a decision. Run this in a terminal, or pass --yes.')
        process.exitCode = 1
        return
      }
      rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    }

    console.log(`${problems.length} value(s) break the new rules${options.dryRun ? ' (dry run, nothing is saved)' : ''}.\n`)
    const changes = new Map()
    let skipped = 0
    for (const problem of problems) {
      const value = await decide(problem, options, rl)
      if (value === undefined) {
        skipped++
        continue
      }
      const { collection } = problem
      const key = `${collection}:${problem.doc._id}`
      const change = changes.get(key) ?? { collection, _id: problem.doc._id, set: {} }
      change.set[problem.field] = value
      // Items sort by this lowercased copy (see the beforeChange hook in Items.ts)
      if (collection === 'items' && problem.field === 'title') change.set.titleLower = value.toLowerCase()
      changes.set(key, change)
    }

    if (!options.dryRun) {
      for (const { collection, _id, set } of changes.values()) {
        await db.collection(collection).updateOne({ _id }, { $set: set })
      }
    }
    console.log(
      `\n${options.dryRun ? 'Would change' : 'Changed'} ${changes.size} document(s).` +
        (skipped ? ` Skipped ${skipped} value(s); run this again to fix them.` : ''),
    )
  } finally {
    rl?.close()
    await client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
