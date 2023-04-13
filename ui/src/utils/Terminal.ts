/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file is the entry point for browserify.
 */

// Use webpacked version (yarn package)
import { Terminal } from 'xterm';
// import { AttachAddon } from 'xterm-addon-attach'
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { SerializeAddon } from 'xterm-addon-serialize';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { WebglAddon } from 'xterm-addon-webgl';
import { Unicode11Addon } from 'xterm-addon-unicode11';

// import { LigaturesAddon } from 'xterm-addon-ligatures'

// Pulling in the module's types relies on the <reference> above, it's looks a
// little weird here as we're importing "this" module
import { Terminal as TerminalType, ITerminalOptions } from 'xterm';

export interface IWindowWithTerminal extends Window {
	term: TerminalType;
	Terminal?: typeof TerminalType;
	// AttachAddon?: typeof AttachAddon
	FitAddon?: typeof FitAddon;
	SearchAddon?: typeof SearchAddon;
	SerializeAddon?: typeof SerializeAddon;
	WebLinksAddon?: typeof WebLinksAddon;
	WebglAddon?: typeof WebglAddon;
	Unicode11Addon?: typeof Unicode11Addon;
	// LigaturesAddon?: typeof LigaturesAddon
}

export function createTerminal(terminalContainer: HTMLElement, options: ITerminalOptions) {
	// Clean terminal
	// while (terminalContainer.children.length) {
	// 	terminalContainer.removeChild(terminalContainer.children[0])
	// }

	const isWindows = ['Windows', 'Win16', 'Win32', 'WinCE'].indexOf(navigator.platform) >= 0;
	const term = new Terminal({
		fontSize: 13,
		theme: {
			name: 'Breeze',
			black: '#31363b',
			red: '#ed1515',
			green: '#11d116',
			yellow: '#f67400',
			blue: '#1d99f3',
			magenta: '#9b59b6',
			cyan: '#1abc9c',
			white: '#eff0f1',
			brightBlack: '#7f8c8d',
			brightRed: '#c0392b',
			brightGreen: '#1cdc9a',
			brightYellow: '#fdbc4b',
			brightBlue: '#3daee9',
			brightMagenta: '#8e44ad',
			brightCyan: '#16a085',
			brightWhite: '#fcfcfc',
			background: '#31363b',
			foreground: '#eff0f1',
			selectionBackground: '#eff0f1',
			cursor: '#eff0f1',
		},
		windowsMode: isWindows,
		// fontFamily: 'Fira Code, courier-new, courier, monospace',
		cursorBlink: true,
		cursorStyle: 'underline',
		overviewRulerWidth: 15,
		...options,
	} as ITerminalOptions);

	const typedTerm = term as TerminalType;

	const addons = getAddons();
	typedTerm.loadAddon(new WebLinksAddon());
	typedTerm.loadAddon(addons.fit);
	typedTerm.loadAddon(addons.search);
	typedTerm.loadAddon(addons.serialize);
	typedTerm.loadAddon(addons.unicode11);
	term.open(terminalContainer);
	term.focus();
	addons.fit.fit();

	setTimeout(() => {
		initAddons(term, addons);
	}, 0);

	return { xterm: term, addons };
}
function getAddons() {
	return {
		fit: new FitAddon(),
		webgl: new WebglAddon(),
		search: new SearchAddon(),
		serialize: new SerializeAddon(),
		unicode11: new Unicode11Addon(),
	};
}
export type Addons = ReturnType<typeof getAddons>;
function initAddons(term: TerminalType, addons: ReturnType<typeof getAddons>): void {
	const disposeWebglRenderer = () => {
		try {
			addons.webgl?.dispose();
		} catch {
			// ignore
		}
		// @ts-ignore

		addons.webgl = undefined;
	};
	term.unicode.activeVersion = '11';
	if (window.WebGL2RenderingContext && document.createElement('canvas').getContext('webgl2')) {
		addons.webgl = new WebglAddon();
		addons.webgl.onContextLoss(() => {
			disposeWebglRenderer();
		});
		term.loadAddon(addons.webgl);
	} else {
		disposeWebglRenderer();
	}
}
