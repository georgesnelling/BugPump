## Migrate Lyft Flyte Jiras to https://github.com/lyft/flyte/issues

1. From your Lyft github account generate a github token
1. Authorize the token to use 2fa
1. From the Jira UI, export the issues you want to a csv file
1. Checkin in that file here as jiras.csv, or edit the source to point to the new file 
1. Ensure that all users in the csv file have an entry in the Jira/github user map in github.js
1. Install node.js 
1. run it:

```
npm install
node github
```

If all works the issues will be uploaded to github.  Descriptions, epics, priorities, and assignedTo are preserved. Comments and reportedBy are not preserved. The jira tickets are unaffected.  I generally use the same query to perform a bulk edit and close them resolved as duplicates.  A nice feature would be to do so automatically via the Jira api and include a link to the spcific github issue.    
