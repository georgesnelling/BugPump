//
// Simple CLI for working with Flyte github API
//

// which repo
const owner = 'georgesnelling'
const repo = 'TestIssues'
const jiraFile = 'jiras.csv'

// Map jira names => github names
let gitHubUsers = {
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

let epics = {
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

// everyone's favorite
const _ = require("lodash")


// only one way to auth: Github personal access tokens as an env var
// args would be nice
const token = process.env.GITHUB_TOKEN
if (!token) die(strs.missing_token)


// https://octokit.github.io/rest.js
const Octokit = require("@octokit/rest")
const ok = new Octokit({ auth: "token " + token })


// make sure we're singed in properly
// github will still return a 200 response for an unauthenticated user
// If the returned user has an id property it means they have been authenticated
async function authenticate() {

  return await ok.users.getAuthenticated()
    .then(resp => {
      if (resp.data && resp.data.id) {
        let user = resp.data
        log("Authenticated by Github: ", {user: user.login, id: user.id})
        return(user)
      }
      else {
        throw new Error('ERROR: Github authentication failed:', resp)
      }
    })
}


// get gitHub issues with a filter param
async function getIssues(filter) {

  _.merge(filter, { owner: owner, repo: repo })

  // this is a confusing sync command due to the design of Oktokit
  const issueCursor = ok.issues.listForRepo.endpoint.merge(filter)

  // returns a promise that returns an array of issues or an error
  return ok.paginate(issueCursor)
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



// Create a github issue from a jira issue
async function createGitHubIssue(jira) {

  // trim off leading MB-
  let epicId = jira['Custom field (Epic Link)'].substring(3)
  log('epicId:', epicId)


  let issue = {
    owner: gitHubUsers[jira.Reporter] || 'Unknown',
    title: jira.Summary,
    body: jira.Description,
    assignee: gitHubUsers[jira.Assignee],
    labels: [
      jira['Isssue Type'],
      epics.epicId,
      jira.Priority,
    ]
  }

  log('new Issue: ', issue)
  log('from Jira', jira)

  return ok.issues.create(issue)
}


// soon to be translated into 90 languages
const strs = {
  missing_token: "env var GITHUB_TOKEN must be defined"
}


// lazy
let log = console.log


// don't panic, just die
let die = function(err, code) {
  console.error(err || 'Error')
  process.exit(code || 1)
}


// main
function main() {

  authenticate()
    .then(_ => getIssues({}))
    .then(issues => {
      log('Issues: ', issues.length)
      issues.forEach(issue => { log(issue) })
    })
    .then(_ => getJirasFromCSV(jiraFile, 20))
    .then(jiras => { (createGitHubIssue(jiras[20])) })
    .then(issue => { log(issue) })
    .catch(err => { die(err) })
}

// run main
main()
