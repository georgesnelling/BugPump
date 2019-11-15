//
// Simple CLI for working with Flyte github API
//

// everyone's favorite
const _ = require("lodash")

// which repo
const owner = 'georgesnelling'
const repo = 'TestIssues'
const jiraFile = 'jiras.csv'


// only one way to auth: Github personal access tokens as an env var
// args would be nice
const token = process.env.GITHUB_TOKEN
if (!token) die(strs.missing_token)


// These are constructors that don't actually call Github
const Github = require("github-api")
const gh = new Github({ token: token})
const me = gh.getUser()
const ghIssues = gh.getIssues(owner, repo)


// Map jira names => github names
const gitHubUsers = {
  jiraUser: 'gitHubUser',
  achan: 'chanadian',
  ssingh: 'surindersinghp',
  krogan: 'katrogan',
  ytong: 'wild-endeavor',
  rschott: 'schottra',
  aswaminathan: 'anandswaminathan',
  jburns: 'jonathanburns',
  kumare: 'kumare3',
  matthewsmith: 'matthewphsmith',
  akhurana: 'akhurana001',
  changhonghsu: 'bnsblue',
  habuelfutuh: 'enghabu',
  gsnelling: 'georgesnelling',
}

const epics = {
  1924: 'Pollish',
  1921: 'Cost',
  1867: 'OSS',
  1848: 'Compliance',
  1838: 'Compliance',
  1737: 'Docs',
  1564: 'Pollish',
  1563: 'Later',
  1525: 'Trust',
  1524: 'Compliance',
  1519: 'Compatibility',
}

const priorities = {
  'Blocker': 'Pri0',
  'Critical': 'Pri1',
  'Major': 'Pri2',
  'Minor': 'Pri3',
}


// get gitHub issues with a filter param
async function getIssues(filter) {

  _.merge(filter, { owner: owner, repo: repo })

  // this is a confusing sync command due to the design of Oktokit
  const issueCursor = gh.issues.listForRepo.endpoint.merge(filter)

  // returns a promise that returns an array of issues or an error
  return gh.paginate(issueCursor)
}


// read the jiras
async function getJirasFromCSV(path, sampleEvery) {

  const csv = require('csv-parser')
  const fs = require('fs')
  let jiras = []
  sampleEvery = sampleEvery || 1

  return new Promise(function(resolve, reject) {

    fs.createReadStream(path)
      .on('error', (error) => reject(error))
      .pipe(csv())
      .on('data', (row) => { jiras.push(row) })
      .on('end', () => {
        log('Jira count : ', jiras.length)
        log('Log every ' + sampleEvery + ' Jiras:')
        jiras.forEach((jira, i) => { if (i % sampleEvery == 0) log(jira) })
        resolve(jiras)
      })
    })
}


// Create a github labels if they don't already exist
async function createGitHubLabels(labelNames) {
  log('creating labels', labelNames)
  let blue = '0000ff'

  function createGitHubLabel(labelName) {

    return ghIssues.createLabel( {name: labelName, color: blue} )
      .then(label => { log ('label created', label); return nil })
      .catch(ghErr => {
        log ('error creating ', labelName)
        try {
          if (ghErr.reponse.data.errors[0].code == 'already_exists') {
            log(lableName, ' already exists')
            return nil  // success
          }
        }
        catch (e) {
          throw ghErr
        }
      })
  }

  // This does not work
  return Promise.all(labelNames.forEach(labelName => {createGitHubLabel(labelName)}))
}

// Create a github issue from a jira issue
async function createGitHubIssue(jira) {

  log('from Jira', jira)

  // trim off leading MB-
  let epicId = jira['Custom field (Epic Link)'].substring(3)

  let issue = {
    title: jira.Summary,
    body: jira.Description,
    labels: [
      jira['Issue Type'],
      epics[epicId],
      priorities[jira.Priority],
    ],
    assignees: [gitHubUsers[jira.Assignee]],  // reporter?
  }

  log('new Issue: ', issue)

  createGitHubLabels(issue.labels)
    .then(_ => { return ghIssues.createIssue(issue) })
    .catch(e => {throw e})

  }


// soon to be translated into 90 languages
const strs = {
  missing_token: "env var GITHUB_TOKEN must be defined"
}


// lazy
let log = console.log


// don't panic, just die
let die = function(err, code) {
  console.error(err || 'Error', {depth: null})
  process.exit(code || 1)
}


// main
function main() {

  me.getProfile()
    .then(_ => ghIssues.listIssues())
    .then(res => {
      let issues = res.data
      log ('Github issues read ', issues.length)
    })
    .then(_ => getJirasFromCSV(jiraFile, 81))
    .then(jiras => { (createGitHubIssue(jiras[81])) })
    .then(issue => { log('Saved Github issue', issue) })
    .catch(err => { die(err) })
}

// run main
main()
