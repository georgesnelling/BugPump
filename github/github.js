//
// Simple CLI for working with Flyte github API
//

// everyone's favorite
const _ = require('lodash')
const util = require('util')

// which repo
const owner = 'georgesnelling'
const repo = 'testissues'
// const owner = 'lyft'
// const repo = 'flyte'
const jiraFile = 'jiras.csv'


// only one way to auth: Github personal access tokens as an env var
// args would be nice
const token = process.env.GITHUB_TOKEN
if (!token) die(strs.missing_token)


// These are constructors that don't actually call Github until a method is invoked
const Github = require("github-api")
const gh = new Github({ token: token})
const me = gh.getUser()
const ghIssues = gh.getIssues(owner, repo)


// Map jira names => github names
const gitHubUsers = {
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
  1737: 'documentation',
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

// read the jiras
function getJirasFromCSV(path) {

  const csv = require('csv-parser')
  const fs = require('fs')
  let jiras = []

  return new Promise(function(resolve, reject) {

    fs.createReadStream(path)
      .on('error', (error) => reject(error))
      .pipe(csv())
      .on('data', (row) => { jiras.push(row) })
      .on('end', () => {
        log('Jira count : ', jiras.length)
        resolve(jiras)
      })
    })
}


// Create an array of Github issues from an array of jiras
function toIssues(jiras) {

  let issues = []
  jiras.forEach(jira => {

    // log('from jira:', jira)
    // trim off leading MB-
    let epicId = jira['Custom field (Epic Link)'].substring(3)

    let issue = {
      title: jira.Summary,
      body: jira.Description || '',
      labels: [
        jira['Issue Type'],
        epics[epicId],
        priorities[jira.Priority],
      ],
    }

    // github doesn't like null values
    let assignee = gitHubUsers[jira.Assignee]
    if (assignee) { issue.assignees = [assignee] }

    // log('transformed to issue: ', issue)
    issues.push(issue)
  })
  return issues
}


// Create a labels array of the union of all issue labels
function getLabels(issues) {

  let labelMap = {}
  issues.forEach(issue => {
    issue.labels.forEach(label => {
      labelMap[label] = true
    })
  })
  // log(labelMap)

  return Object.keys(labelMap)
}


// Create github labels if they don't already exist
function upsertGitHubLabels(labels) {

  const blue = '0000ff'
  const sleep = 100
  let ghLabels =[]

  return new Promise(function(resolve, reject) {

    function upsertGitHubLabel(i) {

      log('upserting ', i)
      if (labels[i] && i < (labels.length - 1)) {

        setTimeout(_ => {

          let newLabel = {name: labels[i], color: blue}
          log({newLabel: newLabel})
          i = i + 1

          ghIssues.createLabel(newLabel)
            .then(ghLabel => {
              log({ghLabel: ghLabel})
              ghLabels.push(ghLabel)
              upsertGitHubLabels(i)  // recurse
            })
            .catch(ghErr => {
              try {
                if (ghErr.response.data.errors[0].code == 'already_exists') {
                  log('already exists')
                  upsertGitHubLabels(i)  // recurse              }
                }
              }
              catch (e) { return reject(ghErr) }
            })
        }, sleep)
      } else {
        return resolve(ghLabels)
      }
    }

    // Kick it off
    upsertGitHubLabel(0)
  })
}


function createGitHubIssues(issues) {

  log('createGitHubIssues', issues.length)

  let results = {issues: [], errors: []}
  const sleep = 100

  function insertIssue(i) {
    log('inserting issue ', i)
    setTimeout(function() {
      if (i < proms.length) {
        log('i:', i)
        proms[i]
           .then(issue => {
             log('proms issue.Summary', issue.Summary)
             results.issues.push(issue)
             insertIssue(++i)
           })
           .catch(err => {
             log('proms err', err)
             results.errors.push(err)
             insertIssue(++i)
           })
      } else {
        if (results.issues.length) {
          return resolve(results)
        } else {
          return reject(results)
        }
      }
    }, sleep)
  }

}


// soon to be translated into 90 languages
const strs = {
  missing_token: "env var GITHUB_TOKEN must be defined"
}


// lazy
let log = console.log


// don't panic, just die
let die = function(err) {
  console.error(util.inspect(err, {depth: 4}))
  process.exit(1)
}


// Just in case...
process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection')
  die(err)
})


// main
function main() {

  let issues = []
  issueFilter = {}

  me.getProfile()
    .then(_ => ghIssues.listIssues())
    .then(res => {
      let ghIssues = res.data
      log ('Github issues read ', ghIssues.length)
    })
    .then(_ => getJirasFromCSV(jiraFile))
    .then(jiras => {
      log('jiras read', jiras.length)
      issues = toIssues(jiras)
      return upsertGitHubLabels(getLabels(issues))
    })
    .then(labels => {
      log({ghLabels: labels})
      return createGitHubIssues(issues)
    })
    .then(results => log({results: results}))
    .catch(err => { die(err) })
}

// run main
main()
