export interface UnityConfig {
  dataUrl: string
  frameworkUrl: string
  codeUrl: string
  streamingAssetsUrl?: string
  companyName?: string
  productName?: string
  productVersion?: string
}

export interface UnityInstance {
  SendMessage(objectName: string, methodName: string, value?: string | number): void
  Quit(): Promise<void>
  SetFullscreen(fullscreen: number): void
}
