//
// Simple CLI for working with Flyte github API
//

// which repo
const owner = 'georgesnelling'
const repo = 'stuff'
const jiraFile = 'jiras.csv'


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
// github will return a 200 response for an unauthenticated user
// If the the returned user has an id property it means they have been authenticated
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


// get issues with a filter param
async function getIssues(filter) {

  _.merge(filter, { owner: owner, repo: repo })

  // this is a confusing sync command due to the design of Oktokit
  const issueCursor = ok.issues.listForRepo.endpoint.merge(filter)

  // returns a promise that returns an array of issues
  return ok.paginate(issueCursor)
}


// read the jiras
async function getJirasFromCSV(path) {

  const csv = require('csv-parser')
  const fs = require('fs')
  let jiras = []

  return new Promise(function(resolve, reject) {

    fs.createReadStream(path)
      .on('error', (error) => reject(error))
      .pipe(csv())
      .on('data', (row) => { jiras.push(row) })
      .on('end', () => {
        log('Jiras read: ', jiras.length)
        resolve(jiras)
      })
    })
}



// Create a github issue from a jira issue
async function createGitHubIssue(jira) {

}


// Delete all jiras in the repo
async function deleteAllGitHubIssues() {

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
      log("Issues: ", issues.length)
      issues.forEach(issue => { log(issue) })
    })
    .then(_ => getJirasFromCSV(jiraFile))
    .then(jiras => {
      log('Jira count: ', jiras.length)
      jiras.forEach(jira => { log(jira) }) })
    .catch(err => { die(err) })
}

// execute main
main()
