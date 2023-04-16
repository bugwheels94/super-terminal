import React, { ReactNode, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'winbox/dist/css/winbox.min.css';
import 'xterm/css/xterm.css';
import {
	getTerminalQueryKey,
	PatchTerminalRequest,
	Terminal,
	useCloneTerminal,
	useGetTerminals,
	usePostTerminal,
} from '../../services/terminals';
import {
	BsPlusLg,
	BsGear,
	BsGrid1X2,
	BsHouseDoor,
	BsPlay,
	BsTerminal,
	BsTrash,
	BsArrowRepeat,
	BsFolder,
} from 'react-icons/bs';
import {
	usePutProject,
	usePatchProject,
	getProjectQueryKey,
	Project,
	usePostProject,
	PatchProjectRequest,
	PostProjectRequest,
	useGetProjects,
} from '../../services/project';
import { useDeleteLogsArchive, usePutSocketGroup } from '../../services/group';
import { MyTerminal } from '../MyTerminal/MyTerminal';
import './Project.css';
import { useQueryClient } from 'react-query';
import { receiver } from '../../utils/socket';
import { useNavigate, useParams } from 'react-router-dom';
import { ShellScriptComp } from './ShellScript';
import { FiCopy } from 'react-icons/fi';
import { ProjectForm } from './Form';
import { ShellScript, useGetProjectScripts } from '../../services/shellScript';
import { Drawer } from 'antd';
import { ShellScriptExecution } from '../MyTerminal/ShellScriptExecution';
// const Draggable = (({ children }: { children: ReactNode }) => {}) as any
const memory = new Map<string, any[]>();
const getWindowDimensions = () => {
	const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	return { width, height };
};
const ankit = (s: string, v?: any) => {
	const item = memory.get(s);
	if (item) {
		item.push(v || 1);
	} else {
		memory.set(s, [v || 1]);
	}
};
// @ts-ignore
window.ankit2 = memory;
function Project2() {
	const { projectSlug, projectId } = useParams<'projectSlug'>() as { projectSlug: string; projectId?: number };
	const { data: project } = usePutProject(projectSlug, projectId);
	if (!project) return null;
	return <ProjectPage project={project} projectId={projectId} />;
}
function ProjectPage({ project, projectId }: { project: Project; projectId?: number }) {
	const [scriptvisible, setScriptVisible] = useState(false);
	const [projectFormOpen, setProjectFormOpen] = useState(false);
	const [currentProject, setCurrentProject] = useState<null | Project>(null);
	const [mainCommandCounter, setMainCommandCounter] = useState(0);
	const [activeTerminal, setActiveTerminal] = useState<number | null>(null);
	const [terminalPatchers, setTerminalPatchers] = useState<Record<number, PatchTerminalRequest | null>>({});
	const [rightClickPosition, setRightClickPosition] = useState<null | { left: number; top: number }>(null);
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
	const { mutateAsync: postProject } = usePostProject({
		onSuccess: () => {
			setProjectFormOpen(false);
		},
	});
	const { mutateAsync: cloneTerminal } = useCloneTerminal(project.id);
	const { mutateAsync: postTerminal } = usePostTerminal(project.id);

	const { mutateAsync: putSocketGroup } = usePutSocketGroup(project.id);
	const { data: projectScripts } = useGetProjectScripts(project.id);
	const [executionScript, setExecutionScript] = useState<ShellScript | null>(null);

	const { data: terminals } = useGetTerminals(project.id);

	const setTerminalPatcher = useCallback(
		(terminalId: number, terminal: PatchTerminalRequest | null) => {
			setTerminalPatchers((s) => ({ ...s, [terminalId]: terminal }));
		},
		[setTerminalPatchers]
	);
	const terminalsCount = useMemo(() => terminals?.length, [terminals]);

	useEffect(() => {
		ankit('scriptvisible change', scriptvisible);
	}, [scriptvisible]);
	useEffect(() => {
		ankit('projectFormOpen changed');
	}, [projectFormOpen]);
	useEffect(() => {
		ankit('currentProject changed');
	}, [currentProject]);
	useEffect(() => {
		ankit('mainCommandCounter changed');
	}, [mainCommandCounter]);
	useEffect(() => {
		ankit('activeTerminal changed');
	}, [activeTerminal]);
	useEffect(() => {
		ankit('terminalPatchers changed');
	}, [terminalPatchers]);
	useEffect(() => {
		ankit('rightClickPosition changed');
	}, [rightClickPosition]);
	useEffect(() => {
		ankit('project changed');
	}, [project]);
	useEffect(() => {
		ankit('projectId changed');
	}, [projectId]);
	useEffect(() => {
		ankit('navigate changed');
	}, [navigate]);
	useEffect(() => {
		ankit('deleteLogsArchive changed');
	}, [deleteLogsArchive]);
	useEffect(() => {
		ankit('projects changed', projects);
	}, [projects]);
	useEffect(() => {
		ankit('patchProject changed');
	}, [patchProject]);
	useEffect(() => {
		ankit('postProject changed');
	}, [postProject]);
	useEffect(() => {
		ankit('cloneTerminal changed');
	}, [cloneTerminal]);
	useEffect(() => {
		ankit('postTerminal changed');
	}, [postTerminal]);
	useEffect(() => {
		ankit('putSocketGroup changed');
	}, [putSocketGroup]);
	useEffect(() => {
		ankit('setTerminalPatcher changed');
	}, [setTerminalPatcher]);
	useEffect(() => {
		ankit('terminalsCount changed');
	}, [terminalsCount]);
	useEffect(() => {
		ankit('terminals changed', terminals);
	}, [terminals]);
	useEffect(() => {
		ankit('queryClient changed');
	}, [queryClient]);

	useEffect(() => {
		if (projectId) return;
		navigate(`/${project.slug}/${project.id}`, {
			replace: true,
		});
	}, [navigate, project.id, project.slug, projectId]);

	useEffect(() => {
		putSocketGroup();
	}, [putSocketGroup]);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		document.title = (project.slug || '') + ' | Super Terminal';
	}, [project.slug]);

	useEffect(() => {
		const slug = project.slug;
		receiver.startChainedRoutes('project-page');
		receiver.patch('/projects/:projectId', (request, response) => {
			if (response.data) queryClient.setQueryData(getProjectQueryKey(slug), response.data);
		});
		receiver.post('/projects/:projectId/terminals', (request, response) => {
			if (!response.data) return;
			console.log('NEW terminal created', response.data, request.params);
			const projectId = Number(request.params.projectId);
			const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
			queryClient.setQueryData(getTerminalQueryKey(projectId), [...oldData, response.data]);
		});
		receiver.post('/projects/:projectId/terminals/:terminalId/copies', (request, response) => {
			if (!response.data) return;
			const projectId = Number(request.params.projectId);
			const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
			queryClient.setQueryData(getTerminalQueryKey(projectId), [...oldData, response.data]);
		});
		receiver.patch('/projects/:projectId/terminals/:terminalId', (request, response) => {
			if (!response.data) return;
			const projectId = Number(request.params.projectId);

			const oldData = queryClient.getQueryData(getTerminalQueryKey(projectId)) as Terminal[];
			queryClient.setQueryData(
				getTerminalQueryKey(projectId),
				oldData.map((terminal) => {
					if (terminal.id === Number(request.params.terminalId)) {
						return response.data;
					}
					return terminal;
				})
			);
		});
		receiver.delete('/projects/:projectId/terminals/:terminalId', (request, response) => {
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
		receiver.endChainedRoutes();

		return () => {
			receiver.clearChain('project-page');
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [queryClient]);

	const data = useMemo(
		() =>
			[
				...(activeTerminal
					? [
							{
								heading: 'Terminal Actions',
								title: 'Reload Terminal',
								icon: <BsArrowRepeat style={{ verticalAlign: 'middle' }} />,
								onClick: () => setTerminalPatcher(activeTerminal, { restart: true }),
							},
							{
								title: 'Clone Terminal',
								icon: <FiCopy style={{ verticalAlign: 'middle' }} />,
								onClick: () => cloneTerminal({ id: activeTerminal }),
							},
							{
								title: 'Execute Shell Script',
								icon: <BsTerminal style={{ verticalAlign: 'middle' }} />,
								children: projectScripts?.map((script) => {
									return {
										title: script.name,
										icon: <BsTerminal style={{ verticalAlign: 'middle' }} />,
										onClick: () => {
											setExecutionScript(script);
										},
									};
								}),
							},
					  ]
					: []),
				{
					heading: 'Project Actions',
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
					title: 'Edit Project',
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
				{
					heading: 'Global Actions',
					title: 'Home',
					icon: <BsHouseDoor style={{ verticalAlign: 'middle' }} />,
					onClick: () => {
						window.location.href = '/';
					},
				},
				{
					title: 'Create New Project',
					icon: <BsPlusLg style={{ verticalAlign: 'middle' }} />,
					onClick: () => {
						setCurrentProject(null);
						setProjectFormOpen(true);
					},
				},
				{
					title: 'Switch Project',
					icon: <BsFolder style={{ verticalAlign: 'middle' }} />,
					children: (projects || []).map((project) => {
						return {
							title: project.slug,
							icon: <BsFolder style={{ verticalAlign: 'middle' }} />,
							onClick: () => {
								navigate(`/${project.slug}/${project.id}`);
							},
						};
					}),
					onClick: () => {
						console.log('wow');
					},
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
			setMainCommandCounter,
			postTerminal,
			activeTerminal,
			deleteLogsArchive,
			setTerminalPatcher,
			projects,
			cloneTerminal,
			navigate,
			project,
			projectScripts,
		]
	);
	useEffect(() => {
		const temp: Record<number, PatchTerminalRequest | null> = {};
		terminals?.forEach((terminal) => {
			temp[terminal.id] = {};
		});
	}, [terminals]);
	useEffect(() => {
		window.addEventListener(
			'contextmenu',
			(e) => {
				e.preventDefault();
				if (e.target instanceof HTMLElement) {
					const box = e.target?.closest('.winbox');
					if (box instanceof HTMLElement) {
						setActiveTerminal(Number(box.dataset.terminalId));
					} else {
						setActiveTerminal(null);
					}
				} else {
					setActiveTerminal(null);
				}

				if (!reff.current) return;
				const { width, height } = getWindowDimensions();
				if (width - e.x > reff.current.offsetWidth) {
					if (height - e.y > reff.current.offsetHeight) {
						setRightClickPosition({ left: e.x, top: e.y });
						return;
					} else {
						setRightClickPosition({ left: e.x, top: e.y - reff.current.offsetHeight });
						return;
					}
				} else {
					if (height - e.y > reff.current.offsetHeight) {
						setRightClickPosition({ left: e.x - reff.current.offsetWidth, top: e.y });
						return;
					} else {
						setRightClickPosition({ left: e.x - reff.current.offsetWidth, top: e.y - reff.current.offsetHeight });
						return;
					}
				}
			},
			false
		);
		document.addEventListener('click', (e) => {
			if (reff.current?.contains(e.target as Node) || reff.current === e.target) return;
			setRightClickPosition(null);
		});
	}, []);
	console.log('rendering');
	useEffect(() => {
		console.log('item changed');
	}, [data]);

	if (!projects || !projectId) return null;

	return (
		<>
			{
				<Drawer open={!!activeTerminal && !!executionScript} onClose={() => setExecutionScript(null)}>
					{executionScript && activeTerminal && (
						<ShellScriptExecution
							script={executionScript}
							terminalId={activeTerminal}
							onClose={() => {
								setExecutionScript(null);
							}}
						/>
					)}
				</Drawer>
			}
			<ShellScriptComp projectId={projectId} visible={scriptvisible} onVisibleChange={setScriptVisible} />
			<ListItems
				ref={reff}
				items={data}
				rightClickPosition={rightClickPosition}
				setRightClickPosition={setRightClickPosition}
			/>
			<ProjectForm
				onOpenChange={setProjectFormOpen}
				open={projectFormOpen}
				onProjectChange={(value: PostProjectRequest | PatchProjectRequest) => {
					if ('id' in value) {
						patchProject(value);
					} else {
						// @ts-ignore
						postProject(value);
					}
				}}
				project={currentProject}
			></ProjectForm>

			<div ref={ref} className="App"></div>
			{ref.current &&
				terminals?.map((terminal, index) => {
					return (
						<MyTerminal
							terminalPatcher={terminalPatchers[terminal.id]}
							setTerminalPatcher={setTerminalPatcher}
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
type ItemType = {
	icon: ReactNode;
	onClick: () => void;
	title: string;
	children?: ItemType[];
	heading?: string;
};
type Position = { left: number; top: number } | null;
const ListItem = ({
	item,
	isVisible,
	setRightClickPosition,
}: {
	isVisible: boolean;
	item: ItemType;
	setRightClickPosition: (_: null) => void;
}) => {
	const ref = useRef<HTMLDivElement>(null);
	const [childrenPosition, setChildrenPosition] = useState<Position>(null);
	useEffect(() => {
		setChildrenPosition(null);
	}, [isVisible]);
	const ref2 = useRef<HTMLDivElement>(null);
	return (
		<>
			<div
				className="list-item"
				onClick={
					item.children
						? () => {
								if (!ref.current) return;
								const rect = ref.current.getBoundingClientRect();
								if (childrenPosition) {
									setChildrenPosition(null);
								} else {
									const { width } = getWindowDimensions();
									if (!ref2.current) return;
									const newRect = ref2.current.getBoundingClientRect();
									if (width - (rect.left + rect.width) > newRect.width) {
										setChildrenPosition({
											left: rect.width + 6,
											top: 0,
										});
									} else {
										setChildrenPosition({
											left: 0 - newRect.width - 6,
											top: 0,
										});
									}
								}
						  }
						: () => {
								item.onClick();
								setRightClickPosition(null);
						  }
				}
				ref={ref}
			>
				{item.icon}
				<span style={{ fontSize: '1.3rem', paddingLeft: '1rem' }}>{item.title}</span>
				{item.children && isVisible && (
					<ListItems
						ref={ref2}
						items={item.children}
						setRightClickPosition={setRightClickPosition}
						rightClickPosition={childrenPosition}
					/>
				)}
			</div>
		</>
	);
};
const ListItems = forwardRef<
	HTMLDivElement,
	{ setRightClickPosition: (_: null) => void; rightClickPosition: Position | null; items: ItemType[] }
>(({ items, rightClickPosition, setRightClickPosition }, ref) => {
	return (
		<div ref={ref} className="list-items" style={rightClickPosition ? rightClickPosition : { left: '-5000px' }}>
			{items.map((item, index) => {
				return (
					<React.Fragment key={item.title}>
						{item.heading && (
							<div className="list-item-heading">
								<strong>{item.heading}</strong>
							</div>
						)}
						<ListItem
							item={item}
							isVisible={rightClickPosition !== null}
							setRightClickPosition={setRightClickPosition}
						/>
					</React.Fragment>
				);
			})}
		</div>
	);
});
export default Project2;
