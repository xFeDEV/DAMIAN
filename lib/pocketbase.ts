import PocketBase from 'pocketbase'

// URL del backend. En Vercel se define con NEXT_PUBLIC_POCKETBASE_URL (build time).
// El dominio anterior (apidamian.feexel.tech) venció; si el entorno todavía lo
// trae, caemos al dominio vigente para no dejar el sistema caído.
const ENV_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL
const CURRENT_API = 'https://apidamian.glamvestidospereira.com'
const LOCAL_FALLBACK = 'http://127.0.0.1:8090'

const source = ENV_URL ? (/feexel\.tech/i.test(ENV_URL) ? CURRENT_API : ENV_URL) : LOCAL_FALLBACK

export const PB_URL = (source || LOCAL_FALLBACK).replace(/\/+$/, '')

export const pb = new PocketBase(PB_URL)

// Avoid aborting concurrent requests that share the same collection/query.
pb.autoCancellation(false)
