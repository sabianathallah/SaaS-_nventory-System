require('dotenv').config()

const port = process.env.PORT || 3000;
const app = require('../app')

// Bind to 0.0.0.0 to make it accessible from network (not just localhost)
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${port}`)
  console.log(`📱 Accessible from mobile: http://192.168.1.20:${port}`)
})
