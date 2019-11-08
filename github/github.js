//
// Simple CLI for working with Flyte github API
//


// https://octokit.github.io/rest.js
var Octokit = require("@octokit/rest")


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
  .then(user => { console.log("user:", user) })
  .catch(err => { die(err) })


// don't panic, just die
function die(msg) {
  console.error(msg)
  process.exit(1)
}
