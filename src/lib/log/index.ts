import {
	warn as warnTauri,
	debug as debugTauri,
	trace as traceTauri,
	info as infoTauri,
	error as errorTauri,
} from "@tauri-apps/plugin-log";

export function info(...args: any[]) {
	console.log(...args);
	infoTauri(args.join(" "));
}

export function warn(...args: any[]) {
	console.warn(...args);
	warnTauri(args.join(" "));
}

export function debug(...args: any[]) {
	console.debug(...args);
	debugTauri(args.join(" "));
}

export function trace(...args: any[]) {
	console.trace(...args);
	traceTauri(args.join(" "));
}

export function error(...args: any[]) {
	console.error(...args);
	errorTauri(args.join(" "));
}
