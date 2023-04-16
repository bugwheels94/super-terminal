import { RestifyWebSocket } from 'restify-websocket/client';
const url = process.env.REACT_APP_WS_URL;
// @ts-ignore
const isElectron = window.location.host === '';
const calculatedUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
export const ws = new RestifyWebSocket((url || calculatedUrl) + (isElectron ? '' : window.location.pathname), {
	maxReconnectDelay: 5000,
	connectWithDelay: 0,
});
export const { socket, receiver, client } = ws;
