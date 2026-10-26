declare module '@isomorphic-git/lightning-fs' {
    export default class LightningFS {
        constructor(name: string, options?: object)
        promises: {
            mkdir(path: string): Promise<void>
            readdir(path: string): Promise<string[]>
            readFile(path: string, encoding: string): Promise<string | Uint8Array>
            writeFile(path: string, data: string | Uint8Array, encoding?: string): Promise<void>
            unlink(path: string): Promise<void>
            rmdir(path: string): Promise<void>
            stat(path: string): Promise<{ isDirectory(): boolean, isFile(): boolean }>
        }
    }
}

declare module 'isomorphic-git/http/web' {
    const http: any
    export default http
}
