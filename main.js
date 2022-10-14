const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { main } = require('./dist/index');
const createWindow = (url) => {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			// preload: path.join(__dirname, 'preload.js'),
		},
	});

	// and load the index.html of the app.
	mainWindow.loadURL(url || 'http://localhost:3879');
	// mainWindow.loadFile('node_modules/super-terminal-ui/dist/index.html');
	mainWindow.once('ready-to-show', () => {
		mainWindow.maximize();
	});
	// Open the DevTools.
	// mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
const isMac = process.platform === 'darwin';
const dockMenu = Menu.buildFromTemplate([
	{
		label: 'New Window',
		click() {
			createWindow('http://localhost:3879#/new');
		},
	},
]);
main();
app
	.whenReady()
	.then(() => {
		if (process.platform === 'darwin') {
			app.dock.setMenu(dockMenu);
		}
	})
	.then(() => {
		createWindow();

		app.on('activate', () => {
			// On macOS it's common to re-create a window in the app when the
			// dock icon is clicked and there are no other windows open.
			if (BrowserWindow.getAllWindows().length === 0) createWindow();
		});
	});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

// use a fixed path, to ensure log shows outside Electron dist
// const logPath = `/Users/ankit.gautam/chutiya.log`;
// const logFile = fs.createWriteStream(logPath, { flags: 'w' });
// const logStdout = process.stdout;

// console.log = function (...args) {
// 	logFile.write(util.format.apply(null, args) + '\n');
// 	logStdout.write(util.format.apply(null, args) + '\n');
// };
// console.error = console.log;
