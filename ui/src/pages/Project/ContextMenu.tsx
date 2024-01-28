import { debounce } from 'lodash';
import { useState, useRef, useContext, useEffect, useMemo, Suspense, ReactNode, forwardRef } from 'react';
import { BsPlusLg, BsGrid1X2, BsGear, BsTerminal, BsPlay, BsFolderX, BsFolder, BsTrash } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { useDeleteLogsArchive } from '../../services/group';
import {
	useGetProjects,
	useGetRunningProjects,
	useDeleteProjectRunningStatus,
	Project,
	useDeleteProject,
} from '../../services/project';
import { usePostTerminal } from '../../services/terminals';
import ShellScriptComponent from './ShellScript';
import { Modal } from 'antd';
import React from 'react';
import { ContextMenuContextConsumer, ContextMenuContextProvider, Coordinates, ItemType } from './Project';

type Position = { left: number; top: number } | null;

function ContextMenu({
	project,
	setTriggerArrangeTerminals,
	setMainCommandCounter,
	setProjectFormOpen,
}: {
	project: Project;
	setMainCommandCounter: React.Dispatch<React.SetStateAction<number>>;
	setTriggerArrangeTerminals: React.Dispatch<React.SetStateAction<number>>;
	setProjectFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	const navigate = useNavigate();
	const { data: projects } = useGetProjects();

	const [scriptvisible, setScriptVisible] = useState(false);
	const reff = useRef<HTMLDivElement>(null);

	const contextMenuContextProvider = useContext(ContextMenuContextProvider);
	const contextMenuContextConsumer = useContext(ContextMenuContextConsumer);
	let iitems: ItemType[] = [];
	contextMenuContextConsumer.items.forEach((value) => {
		iitems.push(...value);
	});
	const { mutate: deleteLogsArchive } = useDeleteLogsArchive();

	const { mutate: postTerminal } = usePostTerminal(project.id);
	const { data: runningProjects } = useGetRunningProjects();
	const { mutate: deleteProjectRunningStatus } = useDeleteProjectRunningStatus(project.id, {});
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
	}, [project.terminalLayout, setTriggerArrangeTerminals]);
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
									hideContextMenu={() => contextMenuContextProvider.setCoordinates(undefined)}
									project={thisProject}
									currentProjectId={project.id}
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
			project.id,
			deleteLogsArchive,
		]
	);

	const [contextMenuPosition, setContextMenuPosition] = useState<null | { left: number; top: number }>(null);

	useEffect(() => {
		if (!contextMenuContextConsumer.coordinates) {
			setContextMenuPosition(null);
			return;
		}

		if (contextMenuContextConsumer.items.get('parent')?.length === 0) return;
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
		onContextMenu(contextMenuContextConsumer.coordinates);
		return () => {};
	}, [contextMenuContextConsumer.coordinates, contextMenuContextConsumer.items]);

	useEffect(() => {
		if (!contextMenuContextConsumer.coordinates) return;
		contextMenuContextProvider.addItems(data, 'parent');
	}, [contextMenuContextConsumer.coordinates, data]);

	useEffect(() => {
		const temp = (e: MouseEvent) => {
			e.preventDefault();
			contextMenuContextProvider.setCoordinates({ x: e.clientX, y: e.clientY });
			contextMenuContextProvider.removeAllItems();
		};
		function onContextMenuOut(e: MouseEvent) {
			if (reff.current?.contains(e.target as Node) || reff.current === e.target) return;
			contextMenuContextProvider.setCoordinates(undefined);
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
	if (!projects?.length) return null;
	return (
		<>
			<Suspense fallback={<>...</>}>
				<ShellScriptComponent projectId={project.id} visible={scriptvisible} onVisibleChange={setScriptVisible} />
			</Suspense>
			<ListItems
				key={contextMenuContextConsumer.id}
				ref={reff}
				tabIndex={1}
				items={iitems}
				position={contextMenuPosition}
				hideContextMenu={() => contextMenuContextProvider.setCoordinates(undefined)}
				shouldContextMenuOpenLeftSide={shouldContextMenuOpenLeftSide}
			/>
		</>
	);
}
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
const getWindowDimensions = () => {
	const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	return { width, height };
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
export default ContextMenu;
