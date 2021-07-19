// For testing locally: `node test.js`
const Util = require('./Util')

new Util().sendStatus().then((response) => {
  console.log(response)
})
