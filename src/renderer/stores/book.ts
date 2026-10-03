import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
import { friendlyError } from './app'
import type {
  BookPageRequest,
  BookPracticeRecordRequest,
  BookUpdateRequest,
  CollectionEntry,
  PagePreview,
} from '@shared/types'

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
        await desktopAPI.removeBookEntry(id)
        this.entries = this.entries.filter((entry) => entry.id !== id)
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    async removeMany(ids: string[]) {
      if (!ids.length) return
      this.error = null
      try {
        for (const id of ids) await desktopAPI.removeBookEntry(id)
        this.entries = this.entries.filter((entry) => !ids.includes(entry.id))
      } catch (error) {
        this.error = friendlyError(error)
        await this.refresh()
      }
    },
    async update(id: string, request: BookUpdateRequest) {
      this.error = null
      try {
        await desktopAPI.updateBookEntry(id, request)
        await this.refresh()
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    async addPractice(id: string, request: BookPracticeRecordRequest) {
      this.error = null
      try {
        await desktopAPI.addBookPractice(id, request)
        await this.refresh()
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    async refreshPreview(request: BookPageRequest) {
      if (!request.entryIds.length) {
        this.preview = null
        return
      }
      this.previewBusy = true
      this.error = null
      try {
        this.preview = await desktopAPI.buildBookPreview(request)
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.previewBusy = false
      }
    },
    async bumpPractice(ids: string[]) {
      if (!ids.length) return
      try {
        await desktopAPI.bumpBookPractice(ids.slice())
        await this.refresh()
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    async printBook(request: BookPageRequest): Promise<boolean> {
      if (!request.entryIds.length || this.printing) return false
      this.printing = true
      this.error = null
      try {
        const success = await desktopAPI.printBook(request)
        if (!success) this.error = '打印未完成，请在打印对话框中重试。'
        return success
      } catch (error) {
        this.error = friendlyError(error)
        return false
      } finally {
        this.printing = false
      }
    },
  },
})
