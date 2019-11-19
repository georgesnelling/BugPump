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

// sleep interval in ms between github calls to prevent rate limiting
const sleep = 10


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
//
// @query: project = MB
//   AND status != closed 
//   AND type != Epic 
//   AND labels in (flyte_public) 
//   ORDER BY Rank ASC
//
function toIssues(jiras) {

  let issues = []
  jiras.forEach(jira => {

    // log('from jira:', jira)
    let issue = {
      title: jira.Summary,
      body: jira.Description || '',
    }

    // compose the optional properties
    let assignee = gitHubUsers[jira.Assignee]
    if (assignee) issue.assignees = [assignee]

    let labels = []

    let type = jira['Issue Type']
    if (type == 'Docs') type = 'documentation'
    if (type) labels.push(type)

    let priority = priorities[jira.Priority]
    if (priority) labels.push(priority)

    let epic = epics[jira['Custom field (Epic Link)'].substring(3)] // trim off leading MB-
    if (epic) labels.push(epic)

    if (labels.length) issue.labels = labels

    // log('transformed to issue: ', issue)
    issues.push(issue)
  })

  return issues
}


// Create a labels array of the union of all labels for all issues
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


// Create github labels if they don't already exist sleeping a fixed
// interval between Github API calls to avoid rate-limiting
function upsertGitHubLabels(labels) {

  return new Promise(function(resolve, reject) {

    let ghLabels = []

    function upsertGitHubLabel(i) {

      const blue = '0000ff'  // color is required but can be changed later

      if (labels[i] && i < (labels.length - 1)) {

        setTimeout(_ => {

          let newLabel = {name: labels[i], color: blue}
          log('ensuring', newLabel.name)

          i++

          ghIssues.createLabel(newLabel)

            .then(resp => {
              ghLabels.push(resp.data.name)
              return upsertGitHubLabel(i)  // recurse
            })

            .catch(ghErr => {
              try {
                if (ghErr.response.data.errors[0].code == 'already_exists') {
                  ghLabels.push(newLabel.name)
                  return upsertGitHubLabel(i)  // recurse
                }
              }
              catch (propertyNotFoundErr) {
                return reject(ghErr) // unexpected err
              }
            })
        }, sleep)

      } else {
        return resolve(ghLabels)  // done
      }
    }

    // Kick it off
    upsertGitHubLabel(0)
  })
}


// Create github issues sleeping a fixed interval between calls
// to avoid rate limiting
function createGitHubIssues(issues) {

  log('createGitHubIssues', issues.length)
  let results = {issues: [], errors: []}

  return new Promise(function(resolve, reject) {

    function insertIssue(i) {

      if (issues[i] && i < (issues.length -1)) {
        setTimeout(_ => {
          let newIssue = issues[i]
          log('inserting issue', newIssue.title)

          ghIssues.createIssue(newIssue)
             .then(resp => {
               log('inserted')
               results.issues.push(resp.data)
               return insertIssue(++i)
             })
             .catch(err => {
               log('error')
               results.errors.push({ request: err.request, error: err.response.data })
               return insertIssue(++i)
             })
        }, sleep)

      } else {
        if (results.issues.length) {
          return resolve(results)
        } else {
          return reject(results)
        }
      }
    }

    // kick it off
    insertIssue(0)
  })

}


// soon to be translated into 90 languages
const strs = {
  missing_token: "env var GITHUB_TOKEN must be defined"
}


// lazy
let log = console.log
let inspect = util.inspect
let die = function(err) {
  console.error(inspect(err, {depth:6}))
  process.exit(1)
}


// not that I'd ever write one of these...
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection')
  die(err)
})


// main
function main() {

  let issues = []
  issueFilter = {}

  me.getProfile()

    // list existing github issues
    .then(_ => ghIssues.listIssues())
    .then(res => {
      let ghIssues = res.data
      log ('Github issues read ', ghIssues.length)
    })

    // read Jiras from an exported CSV file
    .then(_ => getJirasFromCSV(jiraFile))

    // tranfrom jiras to issues, build an array of all new labels
    // that must be upserted first and upsert them
    .then(jiras => {
      log('jiras', jiras.length)
      issues = toIssues(jiras)
      return upsertGitHubLabels(getLabels(issues))
    })

    // now insert the issues
    .then(labels => {
      log({ghLabels: labels})
      return createGitHubIssues(issues)
    })

    // log the results
    .then(results => {
      log(inspect({errors: results.errors}, {depth:5}))
      log('inserted:', results.issues.length)
      log('errors:', results.errors.length)
    })

    .catch(err => { die(err) })
}

// run main
main()
