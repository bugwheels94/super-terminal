import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ReactQueryPlusProvider } from './utils/reactQueryPlus/provider';
import { HashRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ReactQueryPlusProvider>
			<HashRouter>
				<App />
			</HashRouter>
		</ReactQueryPlusProvider>
	</React.StrictMode>
);
