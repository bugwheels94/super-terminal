import React, {
	ReactNode,
	Suspense,
	forwardRef,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from 'react';
import 'winbox/dist/css/winbox.min.css';
import 'xterm/css/xterm.css';
import { createContext } from 'react';

import { getTerminalQueryKey, Terminal, useGetTerminals, usePostTerminal } from '../../services/terminals';
import { BsPlusLg, BsGear, BsGrid1X2, BsPlay, BsTerminal, BsTrash, BsFolder, BsFolderX } from 'react-icons/bs';
import {
	usePutProject,
	usePatchProject,
	getProjectQueryKey,
	Project,
	PatchProjectRequest,
	PostProjectRequest,
	useGetProjects,
	useDeleteProject,
	useDeleteProjectRunningStatus,
	useGetProject,
	getProjectsQueryKey,
	useGetRunningProjects,
} from '../../services/project';
import { useDeleteLogsArchive } from '../../services/group';
import { MyTerminal } from '../MyTerminal/MyTerminal';
import './Project.css';
import { useQueryClient } from 'react-query';
import { client } from '../../utils/socket';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from 'antd';
import { debounce } from 'lodash-es';
const ShellScriptComponent = React.lazy(() => import('./ShellScript'));
const ProjectForm = React.lazy(() => import('./Form'));
type Coordinates = { x: number; y: number };
export const ContextMenuContext = createContext({
	addItems: (_: ItemType[], _key: string) => {},
	setCoordinates: (_: Coordinates | undefined) => {},
	items: new Map() as Map<string, ItemType[]>,
	removeAllItems: () => {},
	id: 0,
	coordinates: undefined as Coordinates | undefined,
});

// const Draggable = (({ children }: { children: ReactNode }) => {}) as any
const getWindowDimensions = () => {
	const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	return { width, height };
};

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
		<ContextMenuContext.Provider
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

				...contextMenuItems,
			}}
		>
			<ProjectPage project={project} projectId={project.id} />
		</ContextMenuContext.Provider>
	);
}
function ProjectPage({ project, projectId }: { project: Project; projectId: number }) {
	const [scriptvisible, setScriptVisible] = useState(false);
	const [projectFormOpen, setProjectFormOpen] = useState(false);
	const [currentProject, setCurrentProject] = useState<null | Project>(null);
	const [mainCommandCounter, setMainCommandCounter] = useState(0);
	const [contextMenuPosition, setContextMenuPosition] = useState<null | { left: number; top: number }>(null);
	const [triggerArrangeTerminals, setTriggerArrangeTerminals] = useState(0);
	const reff = useRef<HTMLDivElement>(null);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { mutate: deleteLogsArchive } = useDeleteLogsArchive();
	const { data: projects } = useGetProjects();
	const { mutate: patchProject, error } = usePatchProject(project.id, {
		onSuccess: () => {
			setProjectFormOpen(false);
		},
	});
	const { mutate: postTerminal } = usePostTerminal(project.id);

	const contextMenuContext = useContext(ContextMenuContext);

	const { data: terminals } = useGetTerminals(project.id, {});
	useEffect(() => {
		const handler = debounce(() => {
			if (project.terminalLayout === 'automatic') {
				setTriggerArrangeTerminals((t) => t + 1);
			}
		}, 250);
		window.addEventListener('resize', handler);
		return () => {
			window.removeEventListener('resize', handler);
		};
	}, [project.terminalLayout]);

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
		const listeners = client.addServerResponseListenerFor
			.delete(`/projects/:projectId/running-status`, (request) => {
				const projectId = Number(request.params.projectId);
				const oldData = queryClient.getQueryData('/running-projects') as number[];
				queryClient.setQueryData(
					'/running-projects',
					oldData.filter((d) => d !== projectId)
				);
			})
			.post(`/projects/:projectId/running-status`, (request) => {
				const projectId = Number(request.params.projectId);
				const oldData = queryClient.getQueryData('/running-projects') as number[];
				queryClient.setQueryData(
					'/running-projects',
					oldData.includes(projectId) ? oldData : oldData.concat([projectId])
				);
			})
			.patch('/projects/:projectId', (_, response) => {
				if (!response.data) return;
				queryClient.setQueryData(getProjectQueryKey(project.id), response.data);
				const oldData = queryClient.getQueryData(getProjectsQueryKey()) as Project[];
				queryClient.setQueryData(
					getProjectsQueryKey(),
					oldData.map((p) => (p.id !== response.data.id ? p : response.data))
				);
			})
			.delete('/projects/:projectId', (_, response) => {
				if (!response.data) return;
				const oldData = queryClient.getQueryData(getProjectsQueryKey()) as Project[];
				queryClient.setQueryData(
					getProjectsQueryKey(),
					oldData.filter((p) => p.id !== response.data)
				);
			})
			.post('/projects/:projectId/terminals', (request, response) => {
				if (!response.data) return;

				const projectId = Number(request.params.projectId);
				const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
				queryClient.setQueryData(getTerminalQueryKey(projectId), [...oldData, response.data]);
			})
			.post('/projects/:projectId/terminals/:terminalId/copies', (request, response) => {
				if (!response.data) return;
				const projectId = Number(request.params.projectId);
				const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
				queryClient.setQueryData(getTerminalQueryKey(projectId), [...oldData, response.data]);
			})
			.patch('/projects/:projectId/terminals/:terminalId', (request, response) => {
				if (!response.data) return;
				const projectId = Number(request.params.projectId);

				const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
				queryClient.setQueryData(
					getTerminalQueryKey(projectId),
					oldData.map((terminal) => {
						if (terminal.id === Number(request.params.terminalId)) {
							return { ...terminal, ...response.data };
						}
						return terminal;
					})
				);
			})
			.delete('/projects/:projectId/terminals/:terminalId', (request) => {
				const projectId = Number(request.params.projectId);
				const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
				queryClient.setQueryData(
					getTerminalQueryKey(projectId),
					oldData.filter((terminal) => {
						if (Number(request.params.terminalId) === terminal.id) {
							return false;
						}
						return true;
					})
				);
			});

		return () => {
			listeners.stopListening();
		};
	}, [queryClient, project.id]);
	const { data: runningProjects } = useGetRunningProjects();

	const { mutate: deleteProjectRunningStatus } = useDeleteProjectRunningStatus(project.id, {});

	const data = useMemo(
		() =>
			[
				{
					heading: `Project Actions(${project.slug || 'Untitled Project'})`,
					title: 'New Terminal',
					icon: <BsPlusLg style={{ verticalAlign: 'middle' }} />,
					onClick: () => postTerminal({}),
				},
				{
					title: 'Arrange All Terminals Properly',
					icon: <BsGrid1X2 style={{ verticalAlign: 'middle' }} />,
					onClick: () => {
						setTriggerArrangeTerminals((s) => s + 1);
					},
				},
				{
					title: 'Project Settings',
					icon: <BsGear style={{ verticalAlign: 'middle' }} />,
					onClick: () => {
						setCurrentProject(project);
						setProjectFormOpen(true);
					},
				},
				{
					title: 'Create Shell Script',
					icon: <BsTerminal style={{ verticalAlign: 'middle' }} />,
					onClick: () => {
						setScriptVisible(true);
					},
				},
				{
					title: 'Run Main Command in all Terminals',
					icon: <BsPlay style={{ verticalAlign: 'middle' }} />,
					onClick: () => {
						setMainCommandCounter((s) => s + 1);
						setTimeout(() => {
							setMainCommandCounter(0);
						}, 0);
					},
				},

				...(project.slug !== ''
					? [
							{
								title: 'Close Project',
								icon: <BsFolderX style={{ verticalAlign: 'middle' }} />,
								onClick: () => {
									deleteProjectRunningStatus();
									navigate('/');
								},
							},

							{
								heading: 'Global Actions',
								title: <>Switch to Untitled Project</>,
								icon: <BsFolderX style={{ verticalAlign: 'middle' }} />,
								onClick: () => {
									navigate('/');
								},
							},
					  ]
					: [
							{
								heading: 'Global Actions',

								title: 'Save Untitled Project As',
								icon: <BsPlusLg style={{ verticalAlign: 'middle' }} />,
								onClick: () => {
									setCurrentProject(null);
									setProjectFormOpen(true);
								},
							},
					  ]),

				{
					title: `Manage Projects (${(runningProjects || []).length} running)`,
					icon: <BsFolder style={{ verticalAlign: 'middle' }} />,
					children: (projects || []).map((thisProject) => {
						return {
							title: `${thisProject.slug || 'Untitled Project'}${
								(runningProjects || []).includes(thisProject.id) ? ' (Running)' : ''
							}`,
							icon: <BsFolder style={{ verticalAlign: 'middle' }} />,
							child: (
								<ManageProject
									hideContextMenu={() => contextMenuContext.setCoordinates(undefined)}
									project={thisProject}
									currentProjectId={projectId}
									runningProjects={runningProjects || []}
								/>
							),
						};
					}),
					onClick: () => {},
				},
				{
					title: 'Delete Archived Logs Older than 7 days',
					icon: <BsTrash style={{ verticalAlign: 'middle' }} />,
					onClick: () => {
						deleteLogsArchive({
							days: 7,
						});
					},
				},
			] as ItemType[],
		[
			project,
			runningProjects,
			projects,
			postTerminal,
			deleteProjectRunningStatus,
			navigate,
			projectId,
			deleteLogsArchive,
		]
	);
	useEffect(() => {
		if (!contextMenuContext.coordinates) {
			setContextMenuPosition(null);
			return;
		}

		if (contextMenuContext.items.get('parent')?.length === 0) return;
		const onContextMenu = function (e: Coordinates) {
			if (!reff.current) return;
			const { width, height } = getWindowDimensions();

			if (width - e.x > reff.current.offsetWidth) {
				if (height - e.y > reff.current.offsetHeight) {
					setContextMenuPosition({ left: e.x, top: e.y });
					return;
				} else {
					setContextMenuPosition({ left: e.x, top: e.y - reff.current.offsetHeight });
					return;
				}
			} else {
				if (height - e.y > reff.current.offsetHeight) {
					setContextMenuPosition({ left: e.x - reff.current.offsetWidth, top: e.y });
					return;
				} else {
					setContextMenuPosition({ left: e.x - reff.current.offsetWidth, top: e.y - reff.current.offsetHeight });
					return;
				}
			}
		};
		onContextMenu(contextMenuContext.coordinates);
		return () => {};
	}, [contextMenuContext.coordinates, contextMenuContext.items]);

	useEffect(() => {
		if (!contextMenuContext.coordinates) return;
		contextMenuContext.addItems(data, 'parent');
	}, [contextMenuContext.coordinates, data]);

	useEffect(() => {
		const temp = (e: MouseEvent) => {
			e.preventDefault();
			contextMenuContext.setCoordinates({ x: e.clientX, y: e.clientY });
			contextMenuContext.removeAllItems();
		};
		function onContextMenuOut(e: MouseEvent) {
			if (reff.current?.contains(e.target as Node) || reff.current === e.target) return;
			contextMenuContext.setCoordinates(undefined);
		}
		window.addEventListener('contextmenu', temp, true);
		// mousedown does not work cause winbox has probably stopped propagation
		window.addEventListener('click', onContextMenuOut);
		return () => {
			window.removeEventListener('click', onContextMenuOut);

			window.removeEventListener('contextmenu', temp, true);
		};
	}, []);
	const shouldContextMenuOpenLeftSide = useMemo(() => {
		if (!contextMenuPosition) return false;
		const window = getWindowDimensions();
		const box = reff.current?.getBoundingClientRect();
		if (!box) return false;
		return contextMenuPosition?.left > window.width - contextMenuPosition.left - box.width;
	}, [contextMenuPosition]);
	let iitems: ItemType[] = [];
	contextMenuContext.items.forEach((value) => {
		iitems.push(...value);
	});
	if (!projects || !projectId) return null;
	return (
		<>
			<Suspense fallback={<>...</>}>
				<ShellScriptComponent projectId={projectId} visible={scriptvisible} onVisibleChange={setScriptVisible} />
			</Suspense>
			<ListItems
				key={contextMenuContext.id}
				ref={reff}
				tabIndex={1}
				items={iitems}
				position={contextMenuPosition}
				hideContextMenu={() => contextMenuContext.setCoordinates(undefined)}
				shouldContextMenuOpenLeftSide={shouldContextMenuOpenLeftSide}
			/>
			<Suspense fallback={<>...</>}>
				<ProjectForm
					onOpenChange={setProjectFormOpen}
					open={projectFormOpen}
					onProjectChange={(value: PostProjectRequest | PatchProjectRequest) => {
						patchProject(value);
					}}
					error={error}
					project={currentProject}
				></ProjectForm>
			</Suspense>

			<div ref={ref} className="App"></div>
			{ref.current &&
				terminals?.map((terminal, index) => {
					return (
						<MyTerminal
							key={terminal.id}
							mainCommandCounter={mainCommandCounter}
							projectId={project.id}
							project={project}
							element={ref.current as HTMLDivElement}
							terminal={terminal}
							terminalsCount={terminals.length}
							terminalOrder={index}
							triggerArrangeTerminals={triggerArrangeTerminals}
						/>
					);
				})}
		</>
	);
}
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
type Position = { left: number; top: number } | null;
const ListItem = ({
	item,
	childrenPosition,
	setChildrenPosition,
	hideContextMenu,
	shouldContextMenuOpenLeftSide,
}: {
	item: ItemType;
	shouldContextMenuOpenLeftSide: boolean;
	childrenPosition: any;
	setChildrenPosition: any;
	hideContextMenu: () => void;
}) => {
	const ref = useRef<HTMLDivElement>(null);
	const ref2 = useRef<HTMLDivElement>(null);
	return (
		<>
			<div
				className="list-item"
				onBlur={() => {
					setChildrenPosition({ left: -10000, top: 0 });
				}}
				onClick={
					item.children || item.child
						? () => {
								if (!ref.current) return;
								const rect = ref.current.getBoundingClientRect();
								if (!ref2.current) return;
								const newRect = ref2.current.getBoundingClientRect();

								if (!shouldContextMenuOpenLeftSide) {
									setChildrenPosition({
										left: rect.width + 6,
										bottom: 0,
										id: item.title,
									});
								} else {
									setChildrenPosition({
										left: 0 - newRect.width - 6,
										bottom: 0,
										id: item.title,
									});
								}
						  }
						: () => {
								item.onClick();
								ref.current?.blur();
								hideContextMenu();
						  }
				}
				ref={ref}
			>
				{item.icon}
				<span style={{ fontSize: '1.3rem', paddingLeft: '1rem' }}>{item.title}</span>
				{item.children || item.child ? (
					<ListItems
						tabIndex={undefined}
						shouldContextMenuOpenLeftSide={shouldContextMenuOpenLeftSide}
						ref={ref2}
						placeholder={item.placeholder}
						items={item.children}
						child={item.child}
						hideContextMenu={hideContextMenu}
						position={
							childrenPosition.id === item.title
								? childrenPosition
								: {
										left: -10000,
										top: 0,
								  }
						}
					/>
				) : null}
			</div>
		</>
	);
};
const ListItems = forwardRef<
	HTMLDivElement,
	{
		tabIndex?: number;
		position: Position | null;
		hideContextMenu: () => void;
		items?: ItemType[];
		placeholder?: string;
		child?: ReactNode;
		shouldContextMenuOpenLeftSide: boolean;
	}
>(({ tabIndex, items, placeholder, position, child, hideContextMenu, shouldContextMenuOpenLeftSide }, ref) => {
	const [childrenPosition, setChildrenPosition] = useState<Position & { itemId: string }>({
		left: -10000,
		top: 0,
		itemId: '',
	});

	return (
		<div tabIndex={tabIndex} ref={ref} className="list-items" style={position ? position : { left: '-5000px' }}>
			{items?.length ? (
				items.map((item) => {
					return (
						<React.Fragment key={item.key || item.title}>
							{item.heading && (
								<div className="list-item-heading">
									<strong>{item.heading}</strong>
								</div>
							)}
							<ListItem
								shouldContextMenuOpenLeftSide={shouldContextMenuOpenLeftSide}
								hideContextMenu={hideContextMenu}
								item={item}
								childrenPosition={childrenPosition}
								setChildrenPosition={setChildrenPosition}
							/>
						</React.Fragment>
					);
				})
			) : child ? (
				child
			) : (
				<em>{placeholder}</em>
			)}
		</div>
	);
});
function ManageProject({
	project,
	currentProjectId,
	hideContextMenu,
	runningProjects,
}: {
	runningProjects: number[];
	project: Project;
	currentProjectId: number;
	hideContextMenu: () => void;
}) {
	const { mutate } = useDeleteProject(project.id);
	const { mutate: deleteProjectRunningStatus } = useDeleteProjectRunningStatus(project.id, {
		onSuccess: () => {},
	});
	const [isModalOpen, setIsModalOpen] = useState(false);
	const navigate = useNavigate();
	//* reloading cause the context menu is not behaving */
	return (
		<>
			{currentProjectId !== project.id && (
				<div
					className="list-item"
					onClick={() => {
						navigate(`/${project.slug}`);
						hideContextMenu();
					}}
				>
					Open
				</div>
			)}
			{runningProjects.includes(project.id) && (
				<div className="list-item" onClick={() => deleteProjectRunningStatus()}>
					Terminate all Running Terminals
				</div>
			)}
			{project.slug && (
				<div
					className="list-item"
					onClick={() => {
						setIsModalOpen(true);
						hideContextMenu();
					}}
				>
					Delete
				</div>
			)}

			<Modal
				open={isModalOpen}
				title="Are you sure you want to delete the project？"
				onCancel={() => setIsModalOpen(false)}
				onOk={() => {
					mutate();
					setIsModalOpen(false);
				}}
			></Modal>
		</>
	);
}
export default Project2;
