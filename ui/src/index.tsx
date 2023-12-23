import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ReactQueryPlusProvider } from './utils/reactQueryPlus/provider';
import { HashRouter } from 'react-router-dom';

// @ts-ignore
import { ReactQueryDevtools } from 'react-query/devtools';
ReactDOM.render(
	<ReactQueryPlusProvider>
		<HashRouter>
			<App />
		</HashRouter>
		<ReactQueryDevtools initialIsOpen={false} />
	</ReactQueryPlusProvider>,
	document.getElementById('root') as HTMLElement
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
