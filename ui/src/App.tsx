import React from 'react';
import './App.css';
import 'xterm/css/xterm.css';
import { Routes, Route } from 'react-router-dom';
const Project = React.lazy(() => import('./pages/Project/Project'));
// import Project from './pages/Project/Project';
function App() {
	return (
		<Routes>
			<Route
				path="/:projectSlug?"
				element={
					<React.Suspense fallback={<>...</>}>
						<Project />
					</React.Suspense>
				}
			/>
		</Routes>
	);
}

export default App;
