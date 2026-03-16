export declare class ExcelBackendService {
    readonly backendRootDir: string;
    private server;
    private port;
    constructor(backendRootDir: string);
    get baseUrl(): string;
    publicationManifestUrl(publicationId: string): string;
    publicationDownloadUrl(publicationId: string): string;
    objectManifestUrl(objectId: string): string;
    healthUrl(): string;
    serviceManifestUrl(): string;
    start(port?: number): Promise<string>;
    stop(): Promise<void>;
    private serveFile;
}
