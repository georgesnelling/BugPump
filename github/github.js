//
// Simple CLI for working with Flyte github API
//

// everyone's favorite
const _ = require("lodash")

// https://octokit.github.io/rest.js
const Octokit = require("@octokit/rest")


// only one way to auth: Github personal access tokens as an env var
// args would be nice
const token = process.env.GITHUB_TOKEN
if (!token) reject(strs.missing_token)
const ok = new Octokit({ auth: "token " + token })


// which repo
const owner = 'georgesnelling'
const repo = 'stuff'

// execute main
main()

// main
function main() {

  authenticate()
    .then(res => {
      console.log("user: ", {login: res.data.login, id: res.data.id})
      listIssues({state: 'open'})
        .then(issues => {
          console.log("Count of issues: ", issues.length)
          issues.forEach(issue => {
            console.log("issue", issue)
          })
        })
    })
    .catch(err => { die(err) })
}


// make sure we're singed in properly
async function authenticate() {

  return new Promise(function(resolve, reject) {
    ok.users.getAuthenticated()
      .then(response => {
        if (response.data && response.data.id) {
          resolve(response)
        } else {
          reject(new Error('ERROR: Authentication failed', response))
        }
      })
      .catch(err => { reject(err) })
  })
}


// get issues with a filter param
async function listIssues(ops) {

  _.merge(ops, { owner: owner, repo: repo })

  // this is a weird command due to the design of Oktokit
  const issueCursor = ok.issues.listForRepo.endpoint.merge(ops)

  // returns an arry of issues or an error, max number of issues
  // returned is up to github: 3,000 as of Nov 2019
  return new Promise(function(resolve, reject) {
    ok.paginate(issueCursor)
      .then(issues => { resolve(issues) })
      .catch(err => { reject(err) })
  })
}


// soon to be translated into 90 languages
const strs = {
  missing_token: "env var GITHUB_TOKEN must be defined"
}


// don't panic, just die
var die = function(err, code) {
  console.error(err || 'Error')
  process.exit(code || 1)
}
