import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
import { friendlyError } from './app'
import type { AbilityRequest, AbilityResponse } from '@shared/types'

export const useAbilityStore = defineStore('ability', {
  state: () => ({
    data: null as AbilityResponse | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetch(request: AbilityRequest) {
      this.loading = true
      this.error = null
      try {
        this.data = await desktopAPI.getAbility(request)
      } catch (error) {
        this.error = friendlyError(error)
        this.data = null
      } finally {
        this.loading = false
      }
    },
  },
})
