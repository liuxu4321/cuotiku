import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
import type { AuthSession, LoginRequest } from '@shared/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null as AuthSession | null,
    subscribed: false,
  }),
  getters: {
    loggedIn: (state) => state.session !== null,
    aiEnabled: (state) => state.session?.aiEnabled === true,
  },
  actions: {
    subscribe() {
      if (this.subscribed) return
      this.subscribed = true
      desktopAPI.onAuthStateChanged((session) => {
        this.session = session
      })
    },
    async refresh() {
      this.subscribe()
      try {
        this.session = await desktopAPI.getAuthSession()
      } catch {
        this.session = null
      }
    },
    async login(request: LoginRequest): Promise<AuthSession> {
      const session = await desktopAPI.login(request)
      this.session = session
      return session
    },
    async logout() {
      await desktopAPI.logout()
      this.session = null
    },
  },
})
