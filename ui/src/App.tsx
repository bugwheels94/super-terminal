import './App.css';
import 'antd/dist/antd.min.css';
import 'xterm/css/xterm.css';
import { Routes, Route } from 'react-router-dom';
import Project from './pages/Project/Project';
import Home from './pages/Home/Home';
function App() {
	return (
		<Routes>
			<Route path="/" element={<Home />} />
			<Route path="/:projectSlug" element={<Project />} />
			<Route path="/:projectSlug/:projectId" element={<Project />} />
		</Routes>
	);
}

export default App;
