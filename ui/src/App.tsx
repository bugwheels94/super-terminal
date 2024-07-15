import './App.css';
import 'xterm/css/xterm.css';
import { Routes, Route } from 'react-router-dom';
// const Project = React.lazy(() => import('./pages/Project/Project'));
import Project from './pages/Project/Project';
import { useEffect, useState } from 'react';
import { ws } from './utils/socket';
function App() {
	const [key, setKey] = useState(0);
	useEffect(() => {
		let firstOpen = true;
		ws.addEventListener('open', () => {
			if (!firstOpen) setKey((k) => k + 1);
			firstOpen = false;
			// window.location.reload();
		});
	}, []);
	return (
		<Routes>
			<Route path="/:projectSlug?" element={<Project key={key} />} />
		</Routes>
	);
}

export default App;
