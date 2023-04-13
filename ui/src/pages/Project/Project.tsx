import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'winbox/dist/css/winbox.min.css';
import 'xterm/css/xterm.css';
import { getTerminalQueryKey, Terminal, useGetTerminals, usePostTerminal } from '../../services/terminals';
import { BsPlusLg, BsGear, BsGrid1X2, BsHouseDoor, BsPlay, BsTerminal } from 'react-icons/bs';
import { Button, Drawer, Form, Input, Select, Slider } from 'antd';
import { usePutProject, usePatchProject, getProjectQueryKey, Project } from '../../services/project';
import { usePutSocketGroup } from '../../services/group';
import { MyTerminal } from '../MyTerminal/MyTerminal';
import './Project.css';
import { useQueryClient } from 'react-query';
import { receiver } from '../../utils/socket';
import { useNavigate, useParams } from 'react-router-dom';
import { ShellScriptComp } from './ShellScript';
// const Draggable = (({ children }: { children: ReactNode }) => {}) as any
type Arrangement = { x: number; y: number; height: number; width: number };
const getTerminalCoordinates = (n: number) => {
	let columns: number[];
	if (n === 1) columns = [1];
	else if (n === 2) columns = [1, 1];
	else if (n === 3) columns = [2, 1];
	else if (n <= 8) {
		columns = new Array(Math.ceil(n / 2) - 1).fill(2);
		columns.push(n % 2 === 0 ? 2 : n % 2);
	} else {
		columns = new Array(Math.ceil(n / 3) - 1).fill(3);
		columns.push(n % 3 === 0 ? 3 : n % 3);
	}
	const arrangements: Arrangement[] = [];
	const viewport = getViewport();
	columns.forEach((row, columnIndex) => {
		new Array(row).fill(0).forEach((_, rowIndex) => {
			const width = 100 / columns.length;
			const height = 100 / row;
			arrangements.push({
				height: (height / 100) * viewport[1],
				y: rowIndex * height,
				width: (width / 100) * viewport[0],
				x: width * columnIndex,
			});
		});
	});
	return arrangements;
};
const rules = [
	{
		message: 'Parameter Name can only contain alphabets, numbers, -, _',
		required: true,
		whitespace: false,
		pattern: /^[A-Za-z0-9-_]+$/g,
	},
];
function getViewport() {
	var viewPortWidth;
	var viewPortHeight;

	// the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
	if (typeof window.innerWidth !== 'undefined') {
		viewPortWidth = window.innerWidth;
		viewPortHeight = window.innerHeight;
	}

	// IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
	else if (
		typeof document.documentElement !== 'undefined' &&
		typeof document.documentElement.clientWidth !== 'undefined' &&
		document.documentElement.clientWidth !== 0
	) {
		viewPortWidth = document.documentElement.clientWidth;
		viewPortHeight = document.documentElement.clientHeight;
	}

	// older versions of IE
	else {
		viewPortWidth = document.getElementsByTagName('body')[0].clientWidth;
		viewPortHeight = document.getElementsByTagName('body')[0].clientHeight;
	}
	return [viewPortWidth, viewPortHeight];
}
function Project2() {
	const { projectSlug, projectId } = useParams<'projectSlug'>() as { projectSlug: string; projectId?: number };
	const { data: project } = usePutProject(projectSlug, projectId);
	if (!project) return null;
	return <ProjectPage project={project} projectId={projectId} />;
}
function ProjectPage({ project, projectId }: { project: Project; projectId?: number }) {
	const [visible, setVisible] = useState(false);
	const [scriptvisible, setScriptVisible] = useState(false);
	const navigate = useNavigate();
	useEffect(() => {
		if (projectId) return;
		navigate(`/${project.slug}/${project.id}`, {
			replace: true,
		});
	}, [navigate, project.id, project.slug, projectId]);
	const onClose = () => {
		setVisible(false);
	};
	const { mutateAsync: postTerminal } = usePostTerminal(project.id);
	const [mainCommandCounter, setMainCommandCounter] = useState(0);

	const { mutateAsync: putSocketGroup } = usePutSocketGroup(project.id);
	useEffect(() => {
		putSocketGroup();
	}, [putSocketGroup]);
	const ref = useRef<HTMLDivElement>(null);
	const { data: terminals } = useGetTerminals(project.id);

	useEffect(() => {
		document.title = (project.slug || '') + ' | Super Terminal';
	}, [project.slug]);
	const { mutateAsync: patchProject } = usePatchProject(project.id);

	const queryClient = useQueryClient();
	const [arrangement, setArrangement] = useState<Arrangement[]>([]);
	const terminalsCount = useMemo(() => terminals?.length, [terminals]);

	const arrangeTerminals = useCallback(() => {
		if (!terminalsCount) return;
		setArrangement(getTerminalCoordinates(terminalsCount));
		setTimeout(() => {
			setArrangement([]);
		}, 0);
	}, [terminalsCount]);

	// path is in expressjs type format
	useEffect(() => {
		if (!terminalsCount || project?.terminalLayout !== 'automatic') return;
		arrangeTerminals();
	}, [arrangeTerminals, project?.terminalLayout, queryClient, terminalsCount]);
	useEffect(() => {
		const slug = project.slug;
		receiver.patch('/projects/:projectId', (request, response) => {
			if (response.data) queryClient.setQueryData(getProjectQueryKey(slug), response.data);
		});
		receiver.post('/projects/:projectId/terminals', (request, response) => {
			if (!response.data) return;
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
			console.log('Deleted!');
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [queryClient]);
	const data = useMemo(
		() => [
			{
				title: 'New Terminal',
				icon: <BsPlusLg style={{ verticalAlign: 'middle' }} />,
				onClick: () => postTerminal({}),
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
				title: 'Arrange All Terminals Properly',
				icon: <BsGrid1X2 style={{ verticalAlign: 'middle' }} />,
				onClick: arrangeTerminals,
			},
			{
				title: 'Edit Project',
				icon: <BsGear style={{ verticalAlign: 'middle' }} />,
				onClick: () => {
					setVisible(true);
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
				title: 'Home',
				icon: <BsHouseDoor style={{ verticalAlign: 'middle' }} />,
				onClick: () => {
					window.location.href = '/';
				},
			},
		],
		[arrangeTerminals, setMainCommandCounter, postTerminal]
	);
	const reff = useRef<HTMLDivElement>(null);
	const [rightClickPosition, setRightClickPosition] = useState<null | { left: number; top: number }>(null);
	useEffect(() => {
		window.addEventListener(
			'contextmenu',
			(e) => {
				e.preventDefault();
				const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
				const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
				if (!reff.current) return;
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
	if (!projectId) return null;
	return (
		<>
			{scriptvisible && (
				<ShellScriptComp projectId={projectId} visible={scriptvisible} onVisibleChange={setScriptVisible} />
			)}
			<div ref={reff} className="list-items" style={rightClickPosition ? rightClickPosition : { left: '-500px' }}>
				{data.map((item, index) => {
					return (
						<div className="list-item" onClick={item.onClick}>
							{item.icon}
							<span style={{ fontSize: '1.3rem', paddingLeft: '1rem' }}>{item.title}</span>
						</div>
					);
				})}
			</div>

			<Drawer title="Edit Project Settings" placement="right" onClose={onClose} open={visible} size="large">
				<Form
					requiredMark={false}
					onFinish={(v) =>
						patchProject({ ...v, ...(v.terminalTheme ? { terminalTheme: JSON.parse(v.terminalTheme) } : {}) })
					}
					initialValues={{ ...project, terminalTheme: JSON.stringify(project.terminalTheme, null, 2) }}
				>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Project Name"
						name="slug"
						rules={rules}
					>
						<Input placeholder="Unique name for this project" />
					</Form.Item>

					<Form.Item colon={false} labelAlign="left" labelCol={{ span: 12 }} label="Font Size" name="fontSize">
						<Slider min={6} max={25} />
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Terminal Theme"
						name="terminalTheme"
					>
						<Input.TextArea placeholder="Theme" rows={30} />
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Terminals Positioning"
						name="terminalLayout"
					>
						<Select
							options={[
								{
									label: "Let Super Terminal manage my terminal's positions",
									value: 'automatic',
								},
								{
									label: "I will manage my terminal's positions",
									value: 'manual',
								},
							]}
						/>
					</Form.Item>
					<Button htmlType="submit" type="primary">
						Save
					</Button>
				</Form>
			</Drawer>

			<div ref={ref} className="App"></div>
			{ref.current &&
				terminals?.map((terminal, index) => {
					return (
						<MyTerminal
							arrangement={arrangement[index]}
							key={terminal.id}
							mainCommandCounter={mainCommandCounter}
							projectId={project.id}
							project={project}
							element={ref.current as HTMLDivElement}
							terminal={terminal}
						/>
					);
				})}
		</>
	);
}

export default Project2;
