import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:8000' : '/api')
const ASSET_BASE = import.meta.env.VITE_ASSET_BASE || (import.meta.env.DEV ? 'http://localhost:8000' : '')
export const API_TIMEOUT_MS = 120000

export const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
})

export const assetBase = ASSET_BASE
