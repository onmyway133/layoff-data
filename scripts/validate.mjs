#!/usr/bin/env node
// Validates every data file against schema/*.schema.json, then runs the cross-file checks
// (unique event ids and external ids, rejected ids, icons, press-only sources, event order,
// trusted domains). Exits 1 and lists every problem on failure.
//
// Usage: node scripts/validate.mjs [repo dir]   (defaults to the current directory)

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = resolve(process.argv[2] ?? '.')
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const errors = []
const add = (file, message) => errors.push({ file, message })
const rel = (path) => relative(root, path).split('\\').join('/')

// ---- Schemas ----

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv, ['date'])
// The schemas come from zod, whose URL check is the WHATWG URL parser on the trimmed value (what
// browsers accept), not RFC 3986: links with spaces or non-ASCII paths are valid there. Mirror it
// so CI agrees with the site build. The protocol (http(s) for sources, https for preview images)
// isn't in the JSON Schema, so it is checked below.
ajv.addFormat('uri', (value) => URL.canParse(value.trim()))
const validators = {}
for (const kind of ['company', 'trusted-domains', 'rejected']) {
  const schema = JSON.parse(readFileSync(join(root, 'schema', `${kind}.schema.json`), 'utf8'))
  validators[kind] = ajv.compile(schema)
}

/** Parses and schema-checks one file. Returns its value, or undefined when it's invalid. */
function load(path, kind) {
  const file = rel(path)
  let value
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    add(file, `not valid JSON: ${error.message}`)
    return undefined
  }
  const validate = validators[kind]
  if (!validate(value)) {
    for (const e of validate.errors) {
      const extra = e.params?.additionalProperty ? ` "${e.params.additionalProperty}"` : ''
      add(file, `${e.instancePath || '(root)'} ${e.message}${extra}`)
    }
    return undefined
  }
  return value
}

const list = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : [])
const isDir = (path) => statSync(path).isDirectory()

// zod trims text fields before `min(1)`, so a blank string fails the build; JSON Schema can't say so.
const blank = (value) => typeof value === 'string' && value.trim() === ''
function checkText(file, where, object, keys) {
  for (const key of keys) {
    if (blank(object[key])) add(file, `${where}/${key} must not be blank`)
  }
}

/** zod's `z.url({ protocol })`: the trimmed value parses as a URL with an allowed protocol. */
function checkProtocol(file, where, value, protocols) {
  if (value === undefined) return
  const protocol = new URL(value.trim()).protocol.slice(0, -1)
  if (!protocols.includes(protocol)) add(file, `${where} must be a ${protocols.join(' or ')} URL`)
}

// ---- Load ----

const companies = []
for (const name of list(join(root, 'companies'))) {
  const path = join(root, 'companies', name)
  if (isDir(path) || !name.endsWith('.json')) {
    add(rel(path), 'unexpected entry (only <slug>.json files belong here)')
    continue
  }
  companies.push({ slug: name.slice(0, -5), file: load(path, 'company') })
}

const iconFiles = new Set(list(join(root, 'icons')).filter((name) => !isDir(join(root, 'icons', name))))

const trustedPath = join(root, 'trusted-domains.json')
const trustedDomains = existsSync(trustedPath)
  ? load(trustedPath, 'trusted-domains')
  : add('trusted-domains.json', 'missing')
const rejectedPath = join(root, 'rejected.json')
const rejected = existsSync(rejectedPath) ? load(rejectedPath, 'rejected') : add('rejected.json', 'missing')

// ---- isCompanyOwnedUrl, ported from layoff-tracker's packages/shared/src/domain.ts ----

/** Hostname of a URL without a leading `www.`. */
const domainOfUrl = (url) => new URL(url).hostname.toLowerCase().replace(/^www\./, '')

/**
 * Hosts whose pages are always issued by the company itself, whoever it is: regulatory filings,
 * stock-exchange announcements, press-release wires, executives' social posts, archived copies.
 */
const COMPANY_ISSUED_HOSTS = [
  'sec.gov',
  'announcements.asx.com.au',
  'londonstockexchange.com',
  'mfn.se',
  'echanges.dila.gouv.fr',
  'businesswire.com',
  'prnewswire.com',
  'globenewswire.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'web.archive.org',
]

/**
 * Whether a source link is the company's own material rather than press coverage: its official
 * site (`domain`, or any subdomain), a host named after it (home.barclays, blogs.microsoft.com,
 * aboutamazon.com, hd.square-enix.com), or a company-issued host (filings, wires, social posts).
 */
function isCompanyOwnedUrl(url, company) {
  let host
  try {
    host = domainOfUrl(url)
  } catch {
    return false
  }
  const under = (d) => host === d || host.endsWith(`.${d}`)
  if (COMPANY_ISSUED_HOSTS.some(under)) return true
  if (company.domain && under(company.domain.toLowerCase().replace(/^www\./, ''))) return true

  const tokens = company.slug.toLowerCase().split('-').filter(Boolean)
  const names = new Set([tokens.join('-'), tokens.join('')])
  if (tokens[0] && tokens[0].length >= 4) names.add(tokens[0])
  // Every label but the public suffix (`com`, `co.uk`'s `uk`); `home.barclays` keeps `barclays`.
  const labels = host.split('.')
  const named = labels.length > 2 || labels[1].length > 3 ? labels : labels.slice(0, -1)
  return named.some((label) =>
    [...names].some(
      (n) => label === n || label === `about${n}` || label.replace(/-/g, '') === n || label.split('-')[0] === n,
    ),
  )
}

// ---- Cross-file checks (mirror checkDataset in layoff-tracker's packages/shared/src/data.ts) ----

const eventIds = new Map()
const externalIds = new Map()
const rejectedIds = new Set((rejected ?? []).map((r) => r.externalId))

for (const { slug, file } of companies) {
  const where = `companies/${slug}.json`
  if (!SLUG.test(slug)) add(where, 'file name must be a slug (a-z, 0-9, dashes)')
  if (!file) continue // schema errors already reported
  checkText(where, '', file, ['name', 'industry', 'hqCountry'])
  if (file.icon && !iconFiles.has(file.icon)) add(where, `icon ${file.icon} is not in icons/`)
  file.events.forEach((event, index) => {
    const at = `event ${event.id}`
    checkText(where, `/events/${index}`, event, ['country'])
    const seen = eventIds.get(event.id)
    if (seen) add(where, `${at}: duplicate event id (also in ${seen})`)
    else eventIds.set(event.id, where)
    if (event.externalId) {
      const other = externalIds.get(event.externalId)
      if (other) add(where, `${at}: duplicate externalId ${event.externalId} (also in ${other})`)
      else externalIds.set(event.externalId, `${where} ${at}`)
      if (rejectedIds.has(event.externalId)) add(where, `${at}: externalId ${event.externalId} is in rejected.json`)
    }
    event.sources.forEach((source, s) => {
      const path = `/events/${index}/sources/${s}`
      checkText(where, path, source, ['title', 'description', 'siteName'])
      checkProtocol(where, `${path}/url`, source.url, ['http', 'https'])
      checkProtocol(where, `${path}/image`, source.image, ['https'])
      let owned
      try {
        owned = isCompanyOwnedUrl(source.url.trim(), { slug, domain: file.domain })
      } catch {
        // The site build's checkDataset throws on such a host (e.g. `http://localhost`).
        add(where, `${at}: ${source.url} has no usable host`)
        return
      }
      if (owned) add(where, `${at}: ${source.url} is the company's own material; cite press coverage`)
    })
    const previous = file.events[index - 1]
    if (previous && previous.date < event.date) add(where, `${at}: events must be sorted newest first`)
  })
}

const domains = new Set()
for (const [index, entry] of (trustedDomains ?? []).entries()) {
  checkText('trusted-domains.json', `/${index}`, entry, ['label', 'region', 'category'])
  if (domains.has(entry.domain)) add('trusted-domains.json', `duplicate domain ${entry.domain}`)
  domains.add(entry.domain)
}
for (const [index, entry] of (rejected ?? []).entries()) {
  checkText('rejected.json', `/${index}`, entry, ['company', 'note'])
}

// ---- Report ----

if (errors.length === 0) {
  const events = companies.reduce((n, c) => n + c.file.events.length, 0)
  console.log(
    `OK: ${companies.length} companies, ${events} events, ${iconFiles.size} icons, ` +
      `${trustedDomains.length} trusted domains, ${rejected.length} rejected ids`,
  )
  process.exit(0)
}

// In GitHub Actions, also emit annotations. File names and values come from the PR, so escape
// them: a raw newline would let a file start its own workflow command line.
const inActions = process.env.GITHUB_ACTIONS === 'true'
const escapeData = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const escapeProperty = (s) => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C')
const oneLine = (s) => s.replace(/[\r\n]/g, ' ')

for (const { file, message } of errors) {
  if (inActions) console.log(`::error file=${escapeProperty(file)}::${escapeData(message)}`)
  else console.log(`${oneLine(file)}: ${oneLine(message)}`)
}
console.log(`\n${errors.length} problem(s) in ${new Set(errors.map((e) => e.file)).size} file(s)`)
process.exit(1)
