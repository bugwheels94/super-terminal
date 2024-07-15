import { SoxtendClient } from 'soxtend/client';
const url = import.meta.env.VITE_WS_URL;
// @ts-ignore
const isElectron = window.location.host === '';
const calculatedUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
export const ws = new SoxtendClient((url || calculatedUrl) + (isElectron ? '' : window.location.pathname), {
	maxReconnectDelay: 1000,
});
