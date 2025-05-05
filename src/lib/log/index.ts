import {
	warn as warnTauri,
	debug as debugTauri,
	trace as traceTauri,
	info as infoTauri,
	error as errorTauri,
} from "@tauri-apps/plugin-log";

export function info(...args: any[]) {
	infoTauri(args.join(" "));
}

export function warn(...args: any[]) {
	warnTauri(args.join(" "));
}

export function debug(...args: any[]) {
	debugTauri(args.join(" "));
}

export function trace(...args: any[]) {
	traceTauri(args.join(" "));
}

export function error(...args: any[]) {
	errorTauri(args.join(" "));
}
