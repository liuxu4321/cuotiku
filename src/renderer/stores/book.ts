import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
import { friendlyError } from './app'
import type { CollectionEntry, PagePreview, PaperSize } from '@shared/types'

export const useBookStore = defineStore('book', {
  state: () => ({
    entries: [] as CollectionEntry[],
    loading: false,
    error: null as string | null,
    preview: null as PagePreview | null,
    previewBusy: false,
    printing: false,
  }),
  actions: {
    async refresh() {
      this.loading = true
      this.error = null
      try {
        this.entries = await desktopAPI.listBookEntries()
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.loading = false
      }
    },
    async remove(id: string) {
      this.error = null
      try {
        this.entries = await desktopAPI.removeBookEntry(id)
        this.preview = null
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    async refreshPreview(entryIds: string[], paper: PaperSize) {
      const ids = entryIds.slice()
      if (!ids.length) {
        this.preview = null
        return
      }
      this.previewBusy = true
      this.error = null
      try {
        this.preview = await desktopAPI.buildBookPreview({ entryIds: ids, paper })
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.previewBusy = false
      }
    },
    async printBook(entryIds: string[], paper: PaperSize) {
      const ids = entryIds.slice()
      if (!ids.length || this.printing) return
      this.printing = true
      this.error = null
      try {
        const success = await desktopAPI.printBook({ entryIds: ids, paper })
        if (!success) this.error = '打印未完成，请在打印对话框中重试。'
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.printing = false
      }
    },
  },
})
