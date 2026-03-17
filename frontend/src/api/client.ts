import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
export const API_TIMEOUT_MS = 120000

export const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
})

export const assetBase = API_BASE
