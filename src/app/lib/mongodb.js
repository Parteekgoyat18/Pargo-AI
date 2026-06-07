import { MongoClient } from 'mongodb'
import tls from 'node:tls'

// Force TLS 1.2 max — Turbopack's worker context causes TLS 1.3 handshake
// failures with MongoDB Atlas. TLS 1.2 is still secure and Atlas supports it.
tls.DEFAULT_MAX_VERSION = 'TLSv1.2'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI is not defined')

let _client = null
let _clientPromise = null

export function getClientPromise() {
  if (_clientPromise) return _clientPromise

  _client = new MongoClient(uri, {
    family: 4,
    serverSelectionTimeoutMS: 10000,
  })
  _clientPromise = _client.connect()

  _clientPromise.catch(() => {
    _client = null
    _clientPromise = null
  })

  return _clientPromise
}
