const { app, BrowserWindow, Menu, shell } = require('electron');
const { main, getConfig } = require('./dist/index');
const createWindow = (url) => {
	const { finalConfig } = getConfig();

	// Create the browser window.
	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			// preload: path.join(__dirname, 'preload.js'),
		},
	});
	const finalUrl = url || 'http://' + finalConfig.HOST + ':' + finalConfig.PORT;
	// and load the index.html of the app.
	console.log(finalConfig);
	mainWindow.loadURL(finalUrl);
	// mainWindow.loadFile('node_modules/super-terminal-ui/dist/index.html');
	mainWindow.once('ready-to-show', () => {
		mainWindow.maximize();
	});
	// Open the DevTools.
	mainWindow.webContents.openDevTools();
	mainWindow.webContents.on('new-window', function (e, url) {
		e.preventDefault();
		shell.openExternal(url);
	});
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
const isMac = process.platform === 'darwin';
const dockMenu = Menu.buildFromTemplate([
	{
		label: 'New Window',
		click() {
			createWindow();
		},
	},
]);
main(0, '');
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
