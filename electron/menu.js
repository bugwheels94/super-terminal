const { app, Menu } = require('electron');

const isMac = process.platform === 'darwin';
const dockMenu = Menu.buildFromTemplate([
	{
		label: 'New Window',
		click() {
			console.log('New Window');
		},
	},
	{
		label: 'New Window with Settings',
		submenu: [{ label: 'Basic' }, { label: 'Pro' }],
	},
	{ label: 'New Command...' },
]);

app.whenReady().then(() => {
	if (process.platform === 'darwin') {
		app.dock.setMenu(dockMenu);
	}
});
