let log = console.log

let a = [1,2,3,4,5]

let util = require("util")

let sleep = 500

function go(i) {
  setTimeout(function() {
    log(a[i])
    if (i < (a.length - 1)) {
      go(++i)
    } else {
      log('last statement')
    }
  }, sleep)
}

log('before')
go(0)
log('after')
