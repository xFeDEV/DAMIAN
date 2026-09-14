import PocketBase from 'pocketbase'

export const PB_URL = (process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090').replace(/\/+$/, '')

export const pb = new PocketBase(PB_URL)

// Avoid aborting concurrent requests that share the same collection/query.
pb.autoCancellation(false)
