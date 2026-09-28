import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
import { friendlyError, useAppStore } from './app'
import type {
  CropResultSet,
  ErrorType,
  ImageEditSpec,
  ImportedImage,
  PagePreview,
  SelectionRegion,
} from '@shared/types'

export interface WorkspaceImage extends ImportedImage {
  quarterTurns: number
  fineAngle: number
  selections: SelectionRegion[]
}

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    images: [] as WorkspaceImage[],
    activeImageId: null as string | null,
    revision: 0,
    result: null as CropResultSet | null,
    pagePreview: null as PagePreview | null,
    busy: false,
    outputBusy: null as null | 'save' | 'print',
    error: null as string | null,
    erasedRevision: -1,
    resultRevision: -1,
  }),
  getters: {
    activeImage: (state) => state.images.find((image) => image.id === state.activeImageId) ?? null,
    questionCount: (state) =>
      state.images.reduce((count, image) => count + image.selections.length, 0),
    editSpecs: (state): ImageEditSpec[] =>
      state.images.map(({ id, quarterTurns, fineAngle, selections }) => ({
        imageId: id,
        quarterTurns,
        fineAngle,
        selections,
      })),
    isErased: (state) => state.erasedRevision === state.revision,
    resultStale: (state) => state.result !== null && state.resultRevision !== state.revision,
  },
  actions: {
    async importImages() {
      this.error = null
      try {
        const selected = await desktopAPI.selectImages()
        this.images.push(
          ...selected.map((image) => ({ ...image, quarterTurns: 0, fineAngle: 0, selections: [] })),
        )
        this.activeImageId ||= selected[0]?.id ?? null
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    removeImage(id: string) {
      this.images = this.images.filter((image) => image.id !== id)
      if (this.activeImageId === id) this.activeImageId = this.images[0]?.id ?? null
      this.changed()
    },
    changed() {
      if (this.erasedRevision === this.revision) {
        this.result = null
        this.pagePreview = null
      }
      this.revision += 1
      this.erasedRevision = -1
    },
    setSelections(regions: SelectionRegion[]) {
      if (!this.activeImage) return
      this.activeImage.selections = regions
      this.changed()
    },
    rotateQuarter(delta: number) {
      if (!this.activeImage) return
      const image = this.activeImage
      const oldAngle = image.quarterTurns * 90 + image.fineAngle
      image.quarterTurns += delta
      image.selections = reprojectRegions(
        image,
        oldAngle,
        image.quarterTurns * 90 + image.fineAngle,
      )
      this.changed()
    },
    setFineAngle(value: number) {
      if (!this.activeImage) return
      const image = this.activeImage
      const oldAngle = image.quarterTurns * 90 + image.fineAngle
      image.fineAngle = value
      image.selections = reprojectRegions(
        image,
        oldAngle,
        image.quarterTurns * 90 + image.fineAngle,
      )
      this.changed()
    },
    async refreshCrops() {
      if (!this.questionCount) {
        this.result = null
        this.pagePreview = null
        this.resultRevision = this.revision
        return
      }
      const revision = this.revision
      const app = useAppStore()
      try {
        const result = await desktopAPI.processCrops({
          revision,
          images: plainEditSpecs(this.images),
          processing: { ...app.config.processing },
        })
        if (revision !== this.revision) return
        this.result = result
        this.resultRevision = revision
        await this.refreshPagePreview()
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    async refreshPagePreview() {
      if (!this.result) return
      const app = useAppStore()
      try {
        this.pagePreview = await desktopAPI.buildPagePreview({
          resultSetId: this.result.resultSetId,
          layout: { ...app.config.layout },
        })
      } catch (error) {
        this.error = friendlyError(error)
      }
    },
    async addToBook(errorTypes: ErrorType[]): Promise<number> {
      if (!this.result) return 0
      const app = useAppStore()
      return desktopAPI.addBookEntries({
        resultSetId: this.result.resultSetId,
        grade: app.config.grade,
        term: app.config.term,
        subject: app.config.subject,
        items: errorTypes.map((errorType) => ({ errorType })),
      })
    },
    async erase() {
      const app = useAppStore()
      if (!this.questionCount) return
      this.busy = true
      this.error = null
      const revision = this.revision
      try {
        const result = await desktopAPI.eraseHandwriting({
          revision,
          images: plainEditSpecs(this.images),
          processing: { ...app.config.processing },
        })
        if (revision !== this.revision) return
        this.result = result
        this.resultRevision = revision
        this.erasedRevision = revision
        await this.refreshPagePreview()
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.busy = false
      }
    },
    async save() {
      if (this.outputBusy) return
      this.outputBusy = 'save'
      this.error = null
      try {
        if (!this.result || this.resultStale) await this.refreshCrops()
        if (!this.result || this.resultStale) return
        const app = useAppStore()
        await desktopAPI.savePage({
          resultSetId: this.result.resultSetId,
          layout: { ...app.config.layout },
        })
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.outputBusy = null
      }
    },
    async print() {
      if (this.outputBusy) return
      this.outputBusy = 'print'
      this.error = null
      try {
        if (!this.result || this.resultStale) await this.refreshCrops()
        if (!this.result || this.resultStale) return
        const app = useAppStore()
        const success = await desktopAPI.printPage({
          resultSetId: this.result.resultSetId,
          layout: { ...app.config.layout },
        })
        if (!success) this.error = '打印未完成，请检查打印机或在打印对话框中重试。'
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.outputBusy = null
      }
    },
  },
})

function plainEditSpecs(images: WorkspaceImage[]): ImageEditSpec[] {
  return images.map((image) => ({
    imageId: image.id,
    quarterTurns: image.quarterTurns,
    fineAngle: image.fineAngle,
    selections: image.selections.map((region) => ({ ...region })),
  }))
}

function reprojectRegions(
  image: WorkspaceImage,
  oldDegrees: number,
  newDegrees: number,
): SelectionRegion[] {
  const oldSize = rotatedSize(image.width, image.height, oldDegrees)
  const newSize = rotatedSize(image.width, image.height, newDegrees)
  const oldRad = (oldDegrees * Math.PI) / 180
  const newRad = (newDegrees * Math.PI) / 180
  return image.selections.map((region) => {
    const points = [
      [region.x, region.y],
      [region.x + region.width, region.y],
      [region.x + region.width, region.y + region.height],
      [region.x, region.y + region.height],
    ].map(([nx, ny]) => {
      const px = nx! * oldSize.width - oldSize.width / 2
      const py = ny! * oldSize.height - oldSize.height / 2
      const sx = Math.cos(oldRad) * px + Math.sin(oldRad) * py
      const sy = -Math.sin(oldRad) * px + Math.cos(oldRad) * py
      const rx = Math.cos(newRad) * sx - Math.sin(newRad) * sy
      const ry = Math.sin(newRad) * sx + Math.cos(newRad) * sy
      return { x: rx / newSize.width + 0.5, y: ry / newSize.height + 0.5 }
    })
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const left = clamp(Math.min(...xs), 0, 1)
    const top = clamp(Math.min(...ys), 0, 1)
    const right = clamp(Math.max(...xs), 0, 1)
    const bottom = clamp(Math.max(...ys), 0, 1)
    return {
      ...region,
      x: left,
      y: top,
      width: Math.max(0.005, right - left),
      height: Math.max(0.005, bottom - top),
    }
  })
}
function rotatedSize(
  width: number,
  height: number,
  degrees: number,
): { width: number; height: number } {
  const angle = Math.abs((degrees * Math.PI) / 180)
  return {
    width: Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)),
    height: Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle)),
  }
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
