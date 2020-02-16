//
// Script to migrate Jiras from an exported .csv file to a github issue tracker
// Author:  georgesnelling
//
var util = require('util');
var _ = require('lodash'); // everyone's favorite
// Generally the config file should be edited for every export
var config = require("./config.json");
// Soon to be translated into 90 languages
var strs = {
    missing_token: "env var GITHUB_TOKEN must be defined"
};
// Abbreviations
var log = console.log;
var die = function (err) {
    console.error(util.inspect(err, { depth: 6 }));
    process.exit(1);
};
// Sleep interval in ms between github calls to prevent rate limiting
var sleep = 10;
// Only one way to auth: Github personal access tokens as an env var
// See readme for how to create one.  Args would be nice here
var token = process.env.GITHUB_TOKEN;
if (!token)
    die(strs.missing_token);
// These are constructors that don't actually call Github until a method is invoked
// There's probably a way to import typescript types for these, but I haven't bothered
var Github = require("github-api");
var gh = new Github({ token: token });
var me = gh.getUser();
var ghIssues = gh.getIssues(config.repoOwner, config.repoName);
// Read the jiras
function getJirasFromCSV(path) {
    var csv = require('csv-parser');
    var fs = require('fs');
    var jiras = [];
    return new Promise(function (resolve, reject) {
        fs.createReadStream(path)
            .on('error', function (error) { return reject(error); })
            .pipe(csv())
            .on('data', function (row) { jiras.push(row); })
            .on('end', function () {
            log('Jira count : ', jiras.length);
            resolve(jiras);
        });
    });
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
    var issues = [];
    jiras.forEach(function (jira) {
        // log('from jira:', jira)
        var issue = {
            title: jira.Summary,
            body: jira.Description || '',
            assignees: [],
            labels: []
        };
        // compose the optional properties
        var assignee = config.userMap[jira.Assignee];
        if (assignee)
            issue.assignees = [assignee];
        var labels = [];
        var type = jira['Issue Type'];
        if (type == 'Docs')
            type = 'documentation';
        if (type)
            labels.push(type);
        var priority = config.priorityMap[jira.Priority];
        if (priority)
            labels.push(priority);
        var epic = config.epicMap[jira['Custom field (Epic Link)']];
        if (epic)
            labels.push(epic);
        if (labels.length)
            issue.labels = labels;
        // log('transformed to issue: ', issue)
        issues.push(issue);
    });
    return issues;
}
// Create a de-duped array of labels from the union of all labels on all issues
function getLabels(issues) {
    var labelMap = {};
    issues.forEach(function (issue) {
        issue.labels.forEach(function (label) {
            labelMap[label] = true;
        });
    });
    // log(labelMap)
    // map => array of the keys
    return Object.keys(labelMap);
}
// Create github labels if they don't already exist sleeping a fixed
// interval between Github API calls to avoid rate-limiting
function upsertGitHubLabels(labels) {
    return new Promise(function (resolve, reject) {
        var ghLabels = [];
        // Kick it off
        upsertGitHubLabel(0);
        function upsertGitHubLabel(i) {
            if (i >= labels.length) {
                return resolve(ghLabels);
            }
            var blue = '0000ff'; // color is required but can be changed later
            setTimeout(function (_) {
                var newLabel = { name: labels[i], color: blue };
                log('ensuring', newLabel.name);
                ghIssues.createLabel(newLabel)
                    .then(function (resp) {
                    ghLabels.push(resp.data.name);
                    return upsertGitHubLabel(++i); // recurse
                })["catch"](function (ghErr) {
                    // try-catch block just to search for a deeply nested property name
                    try {
                        // this is ok -- effectively an upsert -- relies on github keeping this API
                        if (ghErr.response.data.errors[0].code == 'already_exists') {
                            ghLabels.push(newLabel.name);
                            return upsertGitHubLabel(++i); // recurse
                        }
                    }
                    catch (propertyNotFoundErr) {
                        return reject(ghErr); // unexpected err
                    }
                });
            }, sleep);
        }
    });
}
// Create github issues sleeping a fixed interval between calls
// to avoid rate limiting
function createGitHubIssues(issues) {
    var results = { issues: [], errors: [] };
    return new Promise(function (resolve, reject) {
        // kick it off
        insertIssue(0);
        function insertIssue(i) {
            if (i < issues.length) {
                setTimeout(function (_) {
                    var newIssue = issues[i];
                    log('inserting issue:', newIssue.title);
                    ghIssues.createIssue(newIssue)
                        .then(function (resp) {
                        log('inserted');
                        results.issues.push(resp.data);
                        return insertIssue(++i);
                    })["catch"](function (err) {
                        log('ERROR');
                        results.errors.push({ request: err.request, error: err.response.data });
                        return insertIssue(++i);
                    });
                }, sleep);
            }
            else {
                if (results.issues.length) {
                    return resolve(results);
                }
                else {
                    return reject(results);
                }
            }
        }
    });
}
// Not that I'd ever write one of these...
process.on('unhandledRejection', function (err) {
    console.error('Unhandled rejection');
    die(err);
});
// main
function main() {
    var issues = [];
    var issueFilter = {};
    me.getProfile()
        // list existing github issues
        .then(function (_) { return ghIssues.listIssues(); })
        .then(function (res) {
        // This is vulnerable to github or the module changing their response format
        var ghIssues = res.data;
        log('Github issues read ', ghIssues.length);
    })
        // read Jiras from an exported CSV file
        .then(function (_) { return getJirasFromCSV(config.jiraFile); })
        // tranfrom jiras to issues, build an array of all new labels
        // that must be upserted first and upsert them
        // both lables and owners must exist in github before issues
        // to which they apply
        .then(function (jiras) {
        log('jiras', jiras.length);
        issues = toIssues(jiras);
        return upsertGitHubLabels(getLabels(issues));
    })
        // now insert the issues
        .then(function (labels) {
        log({ ghLabels: labels });
        return createGitHubIssues(issues);
    })
        // log the results
        .then(function (results) {
        log(util.inspect({ errors: results.errors }, { depth: 5 }));
        log('inserted:', results.issues.length);
        log('errors:', results.errors.length);
    })["catch"](function (err) { die(err); });
}
// run main
main();
