// Simple CLI for working with Flyte github API

var GitHub = require("@octokit/rest")  // https://octokit.github.io/rest.js

var init = {
  auth: process.env.GITHUB_TOKEN,
}

if (!init.auth) {die(messages.auth)}

var gh = new GitHub({init})

console.log(gh.users)

// var user = gh.users.getAuthenticated()

var messages = {
  auth: "env var GITHUB_TOKEN must be defined."
}

function die(msg) {
  if (msg) console.error(msg)
  process.exit(1)
}
