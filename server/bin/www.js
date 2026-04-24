require('dotenv').config()

const port = process.env.PORT || 3000;
const app = require('../app')

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
})
