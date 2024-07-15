import { lazy, ReactNode, Suspense, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import 'winbox/dist/css/winbox.min.css';
import 'xterm/css/xterm.css';
import { createContext } from 'react';

import { getTerminalQueryKey, Terminal, useGetTerminals } from '../../services/terminals';
import {
	usePutProject,
	usePatchProject,
	getProjectQueryKey,
	Project,
	PatchProjectRequest,
	PostProjectRequest,
	useGetProject,
	getProjectsQueryKey,
} from '../../services/project';
import { MyTerminal, MyTerminalHandle } from '../MyTerminal/MyTerminal';
import './Project.css';
import { useQueryClient } from 'react-query';
import { ws } from '../../utils/socket';
import { useNavigate, useParams } from 'react-router-dom';

import ProjectForm from './Form';
import Drawer from '../components/Drawer';
import { AutoComplete } from 'antd';
const ContextMenu = lazy(() => import('./ContextMenu'));

// const Draggable = (({ children }: { children: ReactNode }) => {}) as any
export type ItemType = {
	icon: ReactNode;
	onClick: () => void;
	title: string;
	children?: ItemType[];
	child?: ReactNode;
	heading?: string;
	placeholder?: string;
	key?: string;
};
export type Coordinates = { x: number; y: number };

export const ContextMenuContextConsumer = createContext({
	items: new Map() as Map<string, ItemType[]>,
	id: 0,
	coordinates: undefined as Coordinates | undefined,
});
export const ContextMenuContextProvider = createContext({
	addItems: (_: ItemType[], _key: string) => {},
	setCoordinates: (_: Coordinates | undefined) => {},
	removeAllItems: () => {},
});
function Project2() {
	const { projectSlug = '' } = useParams<'projectSlug'>() as { projectSlug: string; projectId?: number };
	const { data: projectId } = usePutProject(projectSlug);
	const { data: project } = useGetProject(projectId);
	type State = { items: Map<string, ItemType[]>; id: number; coordinates: Coordinates | undefined };

	type Action =
		| {
				type: 'set-coordinates';
				value: Coordinates | undefined;
		  }
		| {
				type: 'add';
				value: ItemType[];
				key: string;
		  }
		| { type: 'removeAll' };

	function reducer(state: State, action: Action): State {
		switch (action.type) {
			case 'removeAll':
				let items = new Map();
				state.items.forEach((_, key) => items.set(key, []));
				return {
					...state,
					id: state.id + 1,
					items,
				};
			case 'set-coordinates':
				return {
					...state,

					coordinates: action.value,
				};
			case 'add':
				let items2 = new Map();
				state.items.forEach((value, key) => {
					if (key === action.key) items2.set(key, action.value);
					else items2.set(key, value);
				});

				return {
					...state,
					items: items2,
					id: state.id + 1,
				};

			default: {
				return state;
			}
		}
	}
	const [contextMenuItems, setContextMenuItems] = useReducer(reducer, {
		items: new Map([
			['child', []],

			['parent', []],
		]),
		id: 0,
		coordinates: undefined,
	});
	if (!project) return null;
	return (
		<ContextMenuContextProvider.Provider
			value={{
				setCoordinates: (coordinates: Coordinates | undefined) => {
					setContextMenuItems({
						type: 'set-coordinates',
						value: coordinates,
					});
				},
				addItems: (newItems: ItemType[], key: string) => {
					setContextMenuItems({ value: newItems, type: 'add', key });
				},
				removeAllItems: () => {
					setContextMenuItems({
						type: 'removeAll',
					});
				},
			}}
		>
			<ContextMenuContextConsumer.Provider
				value={{
					...contextMenuItems,
				}}
			>
				<ProjectPage project={project} projectId={project.id} />
			</ContextMenuContextConsumer.Provider>
		</ContextMenuContextProvider.Provider>
	);
}
function ProjectPage({ project, projectId }: { project: Project; projectId: number }) {
	const [projectFormOpen, setProjectFormOpen] = useState(false);
	const [mainCommandCounter, setMainCommandCounter] = useState(0);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { mutate: patchProject, error } = usePatchProject(project.id, {
		onSuccess: () => {
			setProjectFormOpen(false);
		},
	});

	const { data: terminals } = useGetTerminals(project.id, {});
	const [trueAfterOneSecond, setTrueAfterOneSecond] = useState(false);
	useEffect(() => {
		setTimeout(() => {
			setTrueAfterOneSecond(true);
		}, 1000);
	}, []);
	useEffect(() => {
		navigate(`/${project.slug}`, {
			replace: true,
		});
		// eslint-disable-next-line
	}, [project.slug]);

	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		document.title = (project.slug || 'Untitled Project') + ' | Super Terminal';
	}, [project.slug]);

	useEffect(() => {
		function listener({ detail }: { detail: any }) {
			let message: any = {};
			try {
				message = JSON.parse(detail);
			} catch (e) {}
			if (!message.name || !message.name.startsWith('response|')) return;

			// Use replace method with a regular expression
			const name = message.name.replace(/^response\|/, '');

			switch (name) {
				case `close:running-projects`: {
					const projectId = Number(message.data);
					const oldData = queryClient.getQueryData('/running-projects') as number[];
					queryClient.setQueryData(
						'/running-projects',
						oldData.filter((d) => d !== projectId)
					);
					break;
				}
				case `post:running-projects`: {
					const projectId = Number(message.data);
					const oldData = (queryClient.getQueryData('/running-projects') as number[]) || [];
					queryClient.setQueryData(
						'/running-projects',
						oldData.includes(projectId) ? oldData : oldData.concat([projectId])
					);
					break;
				}
				case 'patch:project': {
					queryClient.setQueryData(getProjectQueryKey(project.id), message.data);
					const oldData = queryClient.getQueryData(getProjectsQueryKey()) as Project[];
					queryClient.setQueryData(
						getProjectsQueryKey(),
						oldData.map((p) => (p.id !== message.data.id ? p : message.data))
					);
					break;
				}
				case 'delete:project': {
					queryClient.setQueryData(
						getProjectsQueryKey(),
						(queryClient.getQueryData(getProjectsQueryKey()) as Project[]).filter((p) => p.id !== message.data)
					);
					break;
				}
				case 'post:terminal': {
					const projectId = Number(message.data.projectId);
					const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
					queryClient.setQueryData(getTerminalQueryKey(projectId), [...oldData, message.data.terminal]);
					break;
				}
				case 'patch:terminal': {
					const projectId = Number(message.data.projectId);

					const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
					queryClient.setQueryData(
						getTerminalQueryKey(projectId),
						oldData.map((terminal) => {
							if (terminal.id === Number(message.data.terminalId)) {
								return { ...terminal, ...message.data.terminal };
							}
							return terminal;
						})
					);
					break;
				}
				case 'delete:terminal': {
					const projectId = Number(message.data.projectId);
					const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
					queryClient.setQueryData(
						getTerminalQueryKey(projectId),
						oldData.filter((terminal) => {
							if (Number(message.data.terminalId) === terminal.id) {
								return false;
							}
							return true;
						})
					);
					break;
				}
			}
		}
		ws.addEventListener('message', listener);
		return () => {
			ws.removeEventListener('message', listener);
		};
	}, [queryClient, project.id]);
	const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
	useEffect(() => {
		window.addEventListener('keydown', (event) => {
			// disable ctrol + F
			if ((event.ctrlKey || event.metaKey) && event.code === 'KeyF') return event.preventDefault();
			// disable browser command pallete
			if ((event.ctrlKey || event.metaKey) && event.code === 'KeyP' && event.shiftKey) {
				event.preventDefault();
				// setCommandPaletteOpen(true);
			}
			// console.log(e);
		});
	}, []);
	const maxZIndex = useMemo(
		() =>
			(terminals || []).reduce((max, item) => {
				const z = item.z || -Infinity;
				return z > max ? z || -Infinity : max;
			}, -Infinity),
		[terminals]
	);
	const childRefs = useRef<(MyTerminalHandle | null)[]>(Array(0).fill(null));

	const rearrangeTerminals = () => {
		childRefs.current.forEach((comp) => {
			comp?.rearrange();
		});
		// if (childRefs.current[index]) {
		// 	childRefs.current[index]?.rearrange();
		// }
	};
	if (!projectId) return null;
	let terminalPrecedingCount = 0;
	return (
		<>
			<Drawer title={'Run Commands'} open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)}>
				<AutoComplete
					className="autocomplete"
					popupClassName="certain-category-search-dropdown"
					popupMatchSelectWidth={500}
					options={[
						{ value: 'Burns Bay Road', label: 'hehe' },
						{ value: 'Downing Street', label: 'hehe' },
						{ value: 'Wall Street', label: 'hehe' },
					]}
					size="large"
				>
					<input></input>
				</AutoComplete>
			</Drawer>
			<ProjectForm
				onOpenChange={setProjectFormOpen}
				open={projectFormOpen}
				onProjectChange={(value: PostProjectRequest | PatchProjectRequest) => {
					patchProject(value);
				}}
				error={error}
				project={project}
			></ProjectForm>
			{trueAfterOneSecond && (
				<Suspense>
					<ContextMenu
						project={project}
						rearrangeTerminals={rearrangeTerminals}
						setMainCommandCounter={setMainCommandCounter}
						setProjectFormOpen={setProjectFormOpen}
						maxZIndex={maxZIndex}
					/>
				</Suspense>
			)}

			<div ref={ref} className="App"></div>
			{ref.current &&
				terminals?.map((terminal, index) => {
					if (!terminal.minimized) {
						terminalPrecedingCount++;
					}
					return (
						<MyTerminal
							commandToExecute=""
							maxZIndex={maxZIndex}
							setCommandToExecute={() => {}}
							key={terminal.id}
							mainCommandCounter={mainCommandCounter}
							projectId={project.id}
							project={project}
							element={ref.current as HTMLDivElement}
							terminal={terminal}
							ref={(el) => (childRefs.current[index] = el)}
							terminalsCount={terminals.filter((t) => !t.minimized).length}
							terminalOrder={terminalPrecedingCount}
						/>
					);
				})}
		</>
	);
}

export default Project2;
