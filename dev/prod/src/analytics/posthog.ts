import { type AnalyticProvider } from "@hcengineering/analytics"
import posthog from 'posthog-js'

// Error type definitions
interface ErrorCategories {
  WebRTC: string[]
  Database: string[]
  APIServer: string[]
}

const ERROR_PATTERNS: ErrorCategories = {
  WebRTC: [
    'RTCPeerConnection',
    'MediaStream',
    'AudioContext',
    'AudioNode',
    'Track connection',
    'WebRTC'
  ],
  Database: [
    'Invalid Id',
    'Invalid lookup',
    'duplicate key',
    'ancestor',
    'DB structure'
  ],
  APIServer: [
    'Internal Server Error',
    'Bad Gateway',
    'Service Unavailable',
    'Server Timeout',
    'Request Processing'
  ]
}

export class PosthogAnalyticProvider implements AnalyticProvider {
  init(config: Record<string, any>): boolean {
    if (config.POSTHOG_API_KEY !== undefined && config.POSTHOG_API_KEY !== '' && config.POSTHOG_HOST !== null) {
      posthog.init(config.POSTHOG_API_KEY, {
        api_host: config.POSTHOG_HOST,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false
      })
      return true
    }
    return false
  }

  setUser(email: string): void {
    if (!posthog._isIdentified()) {
      posthog.identify(email, { email: email })
    }
  }
  setTag(key: string, value: string): void {
    posthog.setPersonProperties({ [key]: value })
  }
  setWorkspace(ws: string): void {
    this.setTag('workspace', ws)
    posthog.group('workspace', ws, {
      name: `${ws}`
    })
  }
  logout(): void {
    posthog.reset()
  }
  handleEvent(event: string, params: Record<string, any>): void {
    posthog.capture(event, params)
  }
  handleError(error: Error): void {
    const env = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
      ? 'production'
      : 'development'

    posthog.capture('error', {
      error_message: error.message,
      error_type: this.categorizeError(error),
      environment: env,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      stack: error.stack
    })
  }
  navigate(path: string): void {
    posthog.capture('$pageview')
  }

  private categorizeError(error: Error): string {
    const errorMessage = error.message.toLowerCase()

    if (ERROR_PATTERNS.WebRTC.some(pattern =>
      errorMessage.includes(pattern.toLowerCase()))) {
      return 'WebRTC'
    }

    if (ERROR_PATTERNS.Database.some(pattern =>
      errorMessage.includes(pattern.toLowerCase()))) {
      return 'Database'
    }

    return 'API/Server'
  }
}
