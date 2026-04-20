const express = require('express')
const routes = require('./server/routes')

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(routes)



app.listen(port, () => {
  console.log(`Server running on http://0.0.0.0:${port}`)
})

