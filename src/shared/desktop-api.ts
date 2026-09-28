import type { DesktopAPI } from './types'

export function createDesktopAPI(
  partialBridge: Partial<DesktopAPI> | undefined,
  fallback: DesktopAPI,
): DesktopAPI {
  return {
    getVersion: partialBridge?.getVersion ?? fallback.getVersion,
    getPlatformInfo: partialBridge?.getPlatformInfo ?? fallback.getPlatformInfo,
    openExternal: partialBridge?.openExternal ?? fallback.openExternal,
    selectImages: partialBridge?.selectImages ?? fallback.selectImages,
    processCrops: partialBridge?.processCrops ?? fallback.processCrops,
    eraseHandwriting: partialBridge?.eraseHandwriting ?? fallback.eraseHandwriting,
    buildPagePreview: partialBridge?.buildPagePreview ?? fallback.buildPagePreview,
    savePage: partialBridge?.savePage ?? fallback.savePage,
    printPage: partialBridge?.printPage ?? fallback.printPage,
    listBookEntries: partialBridge?.listBookEntries ?? fallback.listBookEntries,
    addBookEntries: partialBridge?.addBookEntries ?? fallback.addBookEntries,
    removeBookEntry: partialBridge?.removeBookEntry ?? fallback.removeBookEntry,
    generateAnalogy: partialBridge?.generateAnalogy ?? fallback.generateAnalogy,
    printAnalogy: partialBridge?.printAnalogy ?? fallback.printAnalogy,
    buildBookPreview: partialBridge?.buildBookPreview ?? fallback.buildBookPreview,
    printBook: partialBridge?.printBook ?? fallback.printBook,
    openLogDirectory: partialBridge?.openLogDirectory ?? fallback.openLogDirectory,
    selectDirectory: partialBridge?.selectDirectory ?? fallback.selectDirectory,
    getConfig: partialBridge?.getConfig ?? fallback.getConfig,
    setConfig: partialBridge?.setConfig ?? fallback.setConfig,
    getUpdateState: partialBridge?.getUpdateState ?? fallback.getUpdateState,
    checkForUpdates: partialBridge?.checkForUpdates ?? fallback.checkForUpdates,
    installUpdate: partialBridge?.installUpdate ?? fallback.installUpdate,
    onUpdateStateChanged: partialBridge?.onUpdateStateChanged ?? fallback.onUpdateStateChanged,
  }
}
