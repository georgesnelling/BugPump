//
// Simple CLI for working with Flyte github API
//

// everyone's favorite
const _ = require("lodash")


// only one way to auth: Github personal access tokens as an env var
// args would be nice
const token = process.env.GITHUB_TOKEN
if (!token) reject(strs.missing_token)


// https://octokit.github.io/rest.js
const Octokit = require("@octokit/rest")
const ok = new Octokit({ auth: "token " + token })


// which repo
const owner = 'georgesnelling'
const repo = 'stuff'


// make sure we're singed in properly
async function authenticate() {

  return await ok.users.getAuthenticated()
    .then(resp => {
      // missing res.data.id means not authenticated
      if (resp.data && resp.data.id) {
        return(resp.data)
      }
      else {
        throw new Error('ERROR: Authentication failed', resp)
      }
    })
}


// get issues with a filter param
async function listIssues(ops) {

  _.merge(ops, { owner: owner, repo: repo })

  // this is a weird sync command due to the design of Oktokit
  const issueCursor = ok.issues.listForRepo.endpoint.merge(ops)

  return ok.paginate(issueCursor)
}

// soon to be translated into 90 languages
const strs = {
  missing_token: "env var GITHUB_TOKEN must be defined"
}

// very lazy
let log = console.log

// don't panic, just die
let die = function(err, code) {
  console.error(err || 'Error')
  process.exit(code || 1)
}

// main
function main() {

  authenticate()
    .then(data => { log("user: ", {login: data.login, id: data.id}) })
    .then(_ => listIssues({state: 'open'}))
    .then(issues => {
      log("Count of issues: ", issues.length)
      issues.forEach(issue => { log("issue: ", issue) })
    })
    .catch(err => { die(err) })
}

// execute main
main()
