export interface IMUData {
    trackerName: string;
    rotation: {
        x: number;
        y: number;
        z: number;
        w: number;
    };
    acceleration: {
        x: number;
        y: number;
        z: number;
    };
    ankle?: number;
    magStatus?: MagStatus;
}

export enum TrackerModel {
    X2 = "wireless2",
    Wireless = "wireless",
    Wired = "wired",
}

// For serial trackers (wired, or wireless/2 with GX dongle)
export enum Tracker {
    Chest = "chest",
    LeftKnee = "left_knee",
    LeftAnkle = "left_ankle",
    RightKnee = "right_knee",
    RightAnkle = "right_ankle",
    Hip = "hip",
    LeftElbow = "left_elbow",
    RightElbow = "right_elbow",
    LeftWrist = "left_wrist",
    RightWrist = "right_wrist",
    Head = "head",
    LeftFoot = "left_foot",
    RightFoot = "right_foot",
}

export enum SensorMode {
    MagEnabled = 1,
    MagDisabled = 2,
}

export enum FPSMode {
    Mode50 = 50,
    Mode100 = 100,
}

export enum SensorAutoCorrection {
    Accel = "accel",
    Gyro = "gyro",
    Mag = "mag",
}

export enum MagStatus {
    GREAT = "great",
    OKAY = "okay",
    BAD = "bad",
    VERY_BAD = "very bad",
    Unknown = "unknown",
}