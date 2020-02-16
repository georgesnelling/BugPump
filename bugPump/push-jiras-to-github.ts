//
// Script to migrate Jiras from an exported .csv file to a github issue tracker
// Author:  georgesnelling
//

const util = require('util')
const _ = require('lodash')  // everyone's favorite

// Generally the config file should be edited for every export
const config: StringMap = require("./config.json")

// StringMap interface
interface StringMap {
  [key: string]: string
}

// Github issue interface
interface Issue {
  title: string,
  body: string,
  assignees: string[],
  labels: string[],
}

// Jira issue interface, key names are Jira's default export format
interface Jira {
  Summary: string,
  Description: string,
  Assignee: string,
  Priority: string,
  'Issue Type': string,
  'Custom field (Epic Link)': string,
}

// Errors inserting individual issues
interface GitHubInsertError {
  request: string,
  error: string,
}

// Final resluts object, can partially succeed and partially fail
interface Results {
  issues: Issue[],
  errors: GitHubInsertError[],
}

// Soon to be translated into 90 languages
const strs: StringMap = {
  missing_token: "env var GITHUB_TOKEN must be defined"
}


// Abbreviations
let log = console.log
let die = function(err: any): void {
  console.error(util.inspect(err, {depth:6}))
  process.exit(1)
}

// Sleep interval in ms between github calls to prevent rate limiting
const sleep: number = 10


// Only one way to auth: Github personal access tokens as an env var
// See readme for how to create one.  Args would be nice here
const token: string = process.env.GITHUB_TOKEN
if (!token) die(strs.missing_token)


// These are constructors that don't actually call Github until a method is invoked
// There's probably a way to import typescript types for these, but I haven't bothered
const Github = require("github-api")
const gh = new Github({token: token})
const me = gh.getUser()
const ghIssues = gh.getIssues(config.repoOwner, config.repoName)


// Read the jiras
function getJirasFromCSV(path: string) {

  const csv = require('csv-parser')
  const fs = require('fs')
  let jiras: Jira[] = []

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
function toIssues(jiras: Jira[]): Issue[] {

  let issues: Issue[] = []
  jiras.forEach(jira => {

    // log('from jira:', jira)
    let issue: Issue = {
      title: jira.Summary,
      body: jira.Description || '',
      assignees: [],
      labels: [],
    }

    // compose the optional properties
    let assignee = config.userMap[jira.Assignee]
    if (assignee) issue.assignees = [assignee]

    let labels: string[] = []

    let type: string = jira['Issue Type']
    if (type == 'Docs') type = 'documentation'
    if (type) labels.push(type)

    let priority: string = config.priorityMap[jira.Priority]
    if (priority) labels.push(priority)

    let epic: string = config.epicMap[jira['Custom field (Epic Link)']]
    if (epic) labels.push(epic)

    if (labels.length) issue.labels = labels

    // log('transformed to issue: ', issue)
    issues.push(issue)
  })

  return issues
}


// Create a de-duped array of labels from the union of all labels on all issues
function getLabels(issues: Issue[]): string[] {

  let labelMap = {}
  issues.forEach(issue => {
    issue.labels.forEach(label => {
      labelMap[label] = true
    })
  })
  // log(labelMap)

  // map => array of the keys
  return Object.keys(labelMap)
}


// Create github labels if they don't already exist sleeping a fixed
// interval between Github API calls to avoid rate-limiting
function upsertGitHubLabels(labels: string[]): Promise<string[]> {

  return new Promise(function(resolve, reject) {

    let ghLabels: string[] = []

    // Kick it off
    upsertGitHubLabel(0)

    function upsertGitHubLabel(i: number) {

      if (i >= labels.length) {
        return resolve(ghLabels)
      }

      const blue: string = '0000ff'  // color is required but can be changed later

      setTimeout(_ => {

        let newLabel = {name: labels[i], color: blue}
        log('ensuring', newLabel.name)

        ghIssues.createLabel(newLabel)

          .then(resp => {
            ghLabels.push(resp.data.name)
            return upsertGitHubLabel(++i)  // recurse
          })

          .catch(ghErr => {
            // try-catch block just to search for a deeply nested property name
            try {
              // this is ok -- effectively an upsert -- relies on github keeping this API
              if (ghErr.response.data.errors[0].code == 'already_exists') {
                ghLabels.push(newLabel.name)
                return upsertGitHubLabel(++i)  // recurse
              }
            }
            catch (propertyNotFoundErr) {
              return reject(ghErr) // unexpected err
            }
          })
      }, sleep)
    }
  })
}


// Create github issues sleeping a fixed interval between calls
// to avoid rate limiting
function createGitHubIssues(issues: Issue[]): Promise<Results> {

  let results: Results = {issues: [], errors: []}

  return new Promise(function(resolve, reject) {

    // kick it off
    insertIssue(0)

    function insertIssue(i: number) {

      if (i < issues.length) {
        setTimeout(_ => {
          let newIssue = issues[i]
          log('inserting issue:', newIssue.title)

          ghIssues.createIssue(newIssue)
             .then(resp => {
               log('inserted')
               results.issues.push(resp.data)
               return insertIssue(++i)
             })
             .catch(err => {
               log('ERROR')
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
  })
}


// Not that I'd ever write one of these...
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection')
  die(err)
})


// main
function main() {

  let issues: Issue[] = []
  let issueFilter: StringMap = {}

  me.getProfile()

    // list existing github issues
    .then(_ => ghIssues.listIssues())
    .then(res => {
      // This is vulnerable to github or the module changing their response format
      let ghIssues = res.data
      log ('Github issues read ', ghIssues.length)
    })

    // read Jiras from an exported CSV file
    .then(_ => getJirasFromCSV(config.jiraFile))

    // tranfrom jiras to issues, build an array of all new labels
    // that must be upserted first and upsert them
    // both lables and owners must exist in github before issues
    // to which they apply
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
      log(util.inspect({errors: results.errors}, {depth:5}))
      log('inserted:', results.issues.length)
      log('errors:', results.errors.length)
    })

    // Die on unexpected error
    .catch(err => { die(err) })
}

// run main
main()
