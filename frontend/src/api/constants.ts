export const API_BASE = import.meta.env?.VITE_API_BASE || ""

export const WS_BASE = API_BASE.startsWith("http") ? API_BASE.replace(/^http/, "ws") : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`

