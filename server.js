import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { createApp } from 'json-server/lib/app.js'

const db = new Low(new JSONFile('db.json'), {})
await db.read()

const PORT = parseInt(process.env.PORT ?? '3000')
const HOST = process.env.HOST ?? '0.0.0.0'

const app = createApp(db)
app.listen(PORT, () => {
  console.log(`JSON Server running on port ${PORT}`)
  console.log(`Policies: http://${HOST}:${PORT}/policy`)
}, HOST)
