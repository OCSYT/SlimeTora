export abstract class ConnectionMode {
    public name: string = "Unknown";

    public isActive: boolean = false;

    public isAvailable: boolean = false;

    public supportedTrackers: string[] = [];

    public async startConnection(): Promise<void> {
        console.error("startConnection not implemented");
        return Promise.reject(new Error("startConnection not implemented"));
    }

    public async stopConnection(): Promise<void> {
        console.error("stopConnection not implemented");
        return Promise.reject(new Error("stopConnection not implemented"));
    }

    public getDevices(): string[] {
        console.error("getDevices not implemented");
        return [];
    }
}
