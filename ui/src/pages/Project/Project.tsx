import React, { ReactNode, forwardRef, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import 'winbox/dist/css/winbox.min.css';
import 'xterm/css/xterm.css';
import { createContext } from 'react';

import { getTerminalQueryKey, Terminal, useGetTerminals, usePostTerminal } from '../../services/terminals';
import { BsPlusLg, BsGear, BsGrid1X2, BsHouseDoor, BsPlay, BsTerminal, BsTrash, BsFolder } from 'react-icons/bs';
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
	useGetProjectRunningStatus,
	useGetProject,
	getProjectsQueryKey,
} from '../../services/project';
import { useDeleteLogsArchive } from '../../services/group';
import { MyTerminal } from '../MyTerminal/MyTerminal';
import './Project.css';
import { useQueryClient } from 'react-query';
import { client } from '../../utils/socket';
import { useNavigate, useParams } from 'react-router-dom';
import { ShellScriptComp } from './ShellScript';
import { ProjectForm } from './Form';
import { Modal } from 'antd';
import { debounce } from 'lodash';

export const ContextMenuContext = createContext({
	addItems: (_: ItemType[]) => {},
	items: [] as ItemType[],
	removeAllItems: () => {},
	id: 0,
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
	type State = { items: ItemType[]; id: number };
	type Action =
		| {
				type: 'add';
				value: ItemType[];
		  }
		| { type: 'removeAll' };

	function reducer(state: State, action: Action): State {
		switch (action.type) {
			case 'removeAll':
				return {
					...state,
					id: state.id + 1,
					items: [],
				};
			case 'add':
				return {
					items: state.items.filter((item) => !action.value.find((i) => i.title === item.title)).concat(action.value),
					id: state.id + 1,
				};
			default: {
				return state;
			}
		}
	}
	const [contextMenuItems, setContextMenuItems] = useReducer(reducer, { items: [], id: 0 });

	if (!project) return null;
	return (
		<ContextMenuContext.Provider
			value={{
				addItems: (newItems: ItemType[]) => {
					setContextMenuItems({ value: newItems, type: 'add' });
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
	const { mutateAsync: deleteLogsArchive } = useDeleteLogsArchive();
	const { data: projects } = useGetProjects();
	const { mutateAsync: patchProject } = usePatchProject(project.id, {
		onSuccess: () => {
			setProjectFormOpen(false);
		},
	});
	const { mutateAsync: postTerminal } = usePostTerminal(project.id);

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
		document.title = (project.slug || '') + ' | Super Terminal';
	}, [project.slug]);

	useEffect(() => {
		const listeners = client.addServerResponseListenerFor

			.patch('/projects/:projectId', (request, response) => {
				if (response.data) queryClient.setQueryData(getProjectQueryKey(project.id), response.data);
			})
			.delete('/projects/:projectId', (request, response) => {
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
			.delete('/projects/:projectId/terminals/:terminalId', (request, response) => {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [queryClient]);
	const data = useMemo(
		() =>
			[
				{
					heading: `Project Actions(${project.slug || 'Unsaved Project'})`,
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
								heading: 'Global Actions',
								title: 'Open Default Project',
								icon: <BsHouseDoor style={{ verticalAlign: 'middle' }} />,
								onClick: () => {
									navigate('/');
								},
							},
					  ]
					: [
							{
								heading: 'Global Actions',

								title: 'Save Project As',
								icon: <BsPlusLg style={{ verticalAlign: 'middle' }} />,
								onClick: () => {
									setCurrentProject(null);
									setProjectFormOpen(true);
								},
							},
					  ]),

				{
					title: 'Manage Saved Projects',
					icon: <BsFolder style={{ verticalAlign: 'middle' }} />,
					children: (projects || [])
						.filter((p) => !!p.slug)
						.map((thisProject) => {
							return {
								title: thisProject.slug,
								icon: <BsFolder style={{ verticalAlign: 'middle' }} />,
								child: (
									<ManageProject
										setContextMenuPosition={setContextMenuPosition}
										project={thisProject}
										currentProjectId={projectId}
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
		[projectId, setMainCommandCounter, postTerminal, deleteLogsArchive, projects, navigate, project]
	);

	useEffect(() => {
		function onContextMenu(e: MouseEvent) {
			e.preventDefault();

			if (!reff.current) return;
			const { width, height } = getWindowDimensions();

			contextMenuContext.addItems(data);
			if (reff.current) {
			}
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
		}
		function onContextMenuOut(e: MouseEvent) {
			if (reff.current?.contains(e.target as Node) || reff.current === e.target) return;
			setContextMenuPosition(null);
			contextMenuContext.removeAllItems();
		}
		window.addEventListener('contextmenu', onContextMenu);
		window.addEventListener('click', onContextMenuOut);

		return () => {
			window.removeEventListener('contextmenu', onContextMenu);
			window.removeEventListener('click', onContextMenuOut);
		};
	}, [data, contextMenuContext]);
	const shouldContextMenuOpenLeftSide = useMemo(() => {
		if (!contextMenuPosition) return false;
		const window = getWindowDimensions();
		const box = reff.current?.getBoundingClientRect();
		if (!box) return false;
		return contextMenuPosition?.left > window.width - contextMenuPosition.left - box.width;
	}, [contextMenuPosition]);

	if (!projects || !projectId) return null;
	return (
		<>
			<ShellScriptComp projectId={projectId} visible={scriptvisible} onVisibleChange={setScriptVisible} />
			<ListItems
				key={contextMenuContext.id}
				ref={reff}
				tabIndex={1}
				items={contextMenuContext.items}
				position={contextMenuPosition}
				setContextMenuPosition={setContextMenuPosition}
				shouldContextMenuOpenLeftSide={shouldContextMenuOpenLeftSide}
			/>
			<ProjectForm
				onOpenChange={setProjectFormOpen}
				open={projectFormOpen}
				onProjectChange={(value: PostProjectRequest | PatchProjectRequest) => {
					patchProject(value);
				}}
				project={currentProject}
			></ProjectForm>

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
};
type Position = { left: number; top: number } | null;
const ListItem = ({
	item,
	childrenPosition,
	setChildrenPosition,
	setContextMenuPosition,
	shouldContextMenuOpenLeftSide,
}: {
	item: ItemType;
	shouldContextMenuOpenLeftSide: boolean;
	childrenPosition: any;
	setChildrenPosition: any;
	setContextMenuPosition: (_: Position | null) => void;
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
										top: 0,
										id: item.title,
									});
								} else {
									setChildrenPosition({
										left: 0 - newRect.width - 6,
										top: 0,
										id: item.title,
									});
								}
						  }
						: () => {
								item.onClick();
								ref.current?.blur();
								setContextMenuPosition(null);
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
						setContextMenuPosition={setContextMenuPosition}
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
		setContextMenuPosition: (_: Position | null) => void;
		items?: ItemType[];
		placeholder?: string;
		child?: ReactNode;
		shouldContextMenuOpenLeftSide: boolean;
	}
>(({ tabIndex, items, placeholder, position, child, setContextMenuPosition, shouldContextMenuOpenLeftSide }, ref) => {
	const [childrenPosition, setChildrenPosition] = useState<Position & { itemId: string }>({
		left: -10000,
		top: 0,
		itemId: '',
	});

	return (
		<div tabIndex={tabIndex} ref={ref} className="list-items" style={position ? position : { left: '-5000px' }}>
			{items?.length ? (
				items.map((item, index) => {
					return (
						<React.Fragment key={item.title}>
							{item.heading && (
								<div className="list-item-heading">
									<strong>{item.heading}</strong>
								</div>
							)}
							<ListItem
								shouldContextMenuOpenLeftSide={shouldContextMenuOpenLeftSide}
								setContextMenuPosition={setContextMenuPosition}
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
	setContextMenuPosition,
}: {
	project: Project;
	currentProjectId: number;
	setContextMenuPosition: (_: Position | null) => void;
}) {
	const { mutateAsync } = useDeleteProject(project.id);
	const { data: isRunning } = useGetProjectRunningStatus(project.id);
	const { mutateAsync: deleteProjectRunningStatus } = useDeleteProjectRunningStatus(project.id);
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
						setContextMenuPosition(null);
					}}
				>
					Open
				</div>
			)}
			{isRunning && (
				<div className="list-item" onClick={() => deleteProjectRunningStatus()}>
					Close all Running Terminals
				</div>
			)}
			<div
				className="list-item"
				onClick={() => {
					setContextMenuPosition(null);

					setIsModalOpen(true);
				}}
			>
				Delete
			</div>

			<Modal
				open={isModalOpen}
				title="Are you sure you want to delete the project？"
				onCancel={() => setIsModalOpen(false)}
				onOk={() => {
					mutateAsync();
					setIsModalOpen(false);
				}}
			></Modal>
		</>
	);
}
export default Project2;
