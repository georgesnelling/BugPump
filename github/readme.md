# Migrate Flyte Lyft Jiras to https://github.com/lyft/flyte/issues

1. From your Lyft github account generate a github token
2. Authorize it to use 2fa
3. From the Jira UI, export the issues you want to a csv file
4. Checkin that file here as jiras.csv 
5. Install node.js 
6. run it

''''
npm install
node github

If all works the issues will be uplodaed to github.  The jira tickets are unaffected.  I generally use the same query to perform a bulk edit and close them resolved as duplicates.  A nice feature would be to do so automatically via the Jira api and include a link to the spcific github issue.  
