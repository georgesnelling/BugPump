//
// Simple CLI for working with Flyte github API
//


// https://octokit.github.io/rest.js
var Octokit = require("@octokit/rest")
var _ = require("lodash")


const owner = 'georgesnelling'
const repo = 'stuff'


// soon to be translated into 90 languages
const strs = {
  missing_token: "env var GITHUB_TOKEN must be defined"
}


// only one way to auth: Github personal access tokens as an env var
// args would be nice
const token = process.env.GITHUB_TOKEN
if (!token) die(strs.missing_token)


// init
const gh = new Octokit({ auth: "token " + token })


// make sure we're singed in properly
gh.users
  .getAuthenticated()
  .then(res => {
    if (res.data && res.data.id) {
      console.log("user: ", res.data.login, "id: ", res.data.id)
    } else {
      die('ERROR: Authentication failed')
    }
  })
  .catch(err => { die(err) })


async function listIssues(ops) {
  _.merge(ops, { owner: owner, repo: repo })
  const issueCursor = gh.issues.listForRepo.endpoint.merge(ops)

  gh.paginate(issueCursor)
    .then(issues => { console.log(issues); return issues })
    .catch(err => die(err))
}


listIssues({state: 'open'})
  .then(issues => {
    console.log('ran')
    // console.log("Count of issues: ", issues.length)
    // issues.forEach(issue => {
    //  console.log("issue", issue)
    // })
  })
  .catch(err => { die(err) })


// don't panic, just die
function die(msg) {
  console.error(msg || 'Error')
  process.exit(1)
}
