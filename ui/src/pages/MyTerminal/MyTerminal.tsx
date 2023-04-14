import { debounce } from 'lodash';
import { useRef, useEffect } from 'react';
import { client, receiver } from '../../utils/socket';
import { Addons, createTerminal } from '../../utils/Terminal';
import { Drawer, Input, Button, Modal, AutoComplete, Divider, Collapse, Form } from 'antd';
import { AiOutlineReload } from 'react-icons/ai';
import { ShellScriptExecution } from './ShellScriptExecution';
import './MyTerminal.css';

// @ts-ignore
import WinBox from 'winbox/src/js/winbox';
import {
	Terminal,
	usePatchTerminal,
	useDeleteTerminal,
	useCloneTerminal,
	useGetTerminalCommands,
} from '../../services/terminals';
import { ITheme, Terminal as XTerm } from 'xterm';
import { useState } from 'react';
import { Project } from '../../services/project';
import { useGetProjectScripts } from '../../services/shellScript';
import { BsTerminalSplit } from 'react-icons/bs';
function getPercent(numerator: number, denominator: number) {
	return Math.round((numerator / denominator + Number.EPSILON) * 10000) / 100;
}
function copyText(text: string) {
	if (navigator?.clipboard?.writeText) {
		navigator.clipboard.writeText(text);
	}
}
function getTerminalPosition(terminal: Terminal, parent: HTMLDivElement) {
	return {
		height: terminal.height ? (terminal.height * parent?.offsetHeight) / 100 : undefined,
		width: terminal.width ? (terminal.width * parent?.offsetWidth) / 100 : undefined,
		x: terminal.x ? (terminal.x * parent?.offsetWidth) / 100 : undefined,
		y: terminal.y ? (terminal.y * parent?.offsetHeight) / 100 : undefined,
	};
}
function convertToITheme(theme?: ITheme) {
	if (!theme) return {};
	return {
		...theme,
		// @ts-ignore
		magenta: theme.magenta || theme.purple,
		// @ts-ignore
		cursor: theme.cursor || theme.cursorColor,
	};
}
export const MyTerminal = ({
	terminal,
	element,
	projectId,
	mainCommandCounter,
	arrangement,
	project,
}: {
	project: Project;
	terminal: Terminal;
	element: HTMLDivElement;
	projectId: number;
	mainCommandCounter: number;
	arrangement?: { x: number; y: number; width: number; height: number };
}) => {
	const [visible, setVisible] = useState(false);
	const [editorCommand, setEditorCommand] = useState('');
	const [commandQuery, setCommandQuery] = useState('');
	const [isCommandEditorVisible, setIsCommandEditorVisible] = useState(false);
	const { data } = useGetTerminalCommands(terminal.id, commandQuery, {
		initialData: [],
	});
	const onClose = () => {
		setVisible(false);
	};
	const ref2 = useRef<{
		xterm: XTerm;
		winbox: any;
		addons: Addons;
	}>();
	const { mutateAsync: patchTerminal } = usePatchTerminal(projectId, terminal.id);
	const { mutateAsync: cloneTerminal } = useCloneTerminal(projectId, terminal.id);
	const { data: projectScripts } = useGetProjectScripts(projectId);
	useEffect(() => {
		return () => {
			if (!ref2.current) return;
			ref2.current?.xterm.dispose();
			ref2.current?.winbox.close(true);
		};
	}, []);
	const { mutateAsync: deleteTerminal } = useDeleteTerminal(projectId, terminal.id);
	useEffect(() => {
		if (!ref2.current) return;
		ref2.current.xterm.options.theme = convertToITheme(project.terminalTheme);
	}, [project.terminalTheme]);
	useEffect(() => {
		if (mainCommandCounter === 0 || terminal.mainCommand == null) return;
		client.post('/terminal-command', {
			body: {
				command: terminal.mainCommand + '\r\n',
				terminalId: terminal.id,
			},
			forget: true,
		});
	}, [mainCommandCounter, terminal.id, terminal.mainCommand]);

	useEffect(() => {
		receiver.post<{ terminalId: string }>('/terminals/:terminalId/terminal-data', async (req, res) => {
			const terminalId = Number(req.params.terminalId);
			const data = res.data;
			if (terminalId !== terminal.id) return;
			const instance = ref2.current;
			if (!instance) return;
			// @ts-ignore
			instance.xterm.write(data);
		});
	}, [terminal.id]);
	useEffect(() => {
		if (!arrangement || !ref2.current) return;
		ref2.current.winbox.move(arrangement.x + '%', arrangement.y + '%');
		ref2.current.winbox.resize(arrangement.width + 'px', arrangement.height + 'px');
	}, [arrangement]);
	useEffect(() => {
		const temp = ref2.current;
		return () => {
			if (!temp) return;
			// eslint-disable-next-line react-hooks/exhaustive-deps
			temp.xterm.dispose();
			// @ts-ignore
			temp.winbox.close(true);
			// @ts-ignore
			temp.winbox.unmount(tempp);
		};
	}, []);

	useEffect(() => {
		if (!ref2.current) return;
		if (terminal.title) ref2.current.winbox.setTitle(terminal.title);
	}, [terminal.title]);
	useEffect(() => {
		if (ref2.current || !project) return;
		const winbox = new WinBox(terminal.title || 'Untitled', {
			root: element,
			...getTerminalPosition(terminal, element),
		});
		const $title = winbox.dom.querySelector('.wb-title') as HTMLDivElement;

		$title.contentEditable = 'true';
		const { xterm, addons } = createTerminal(winbox.body, {
			fontSize: project.fontSize,
			theme: convertToITheme(project.terminalTheme),
		});
		winbox.body.addEventListener('dblclick', () => {
			setIsCommandEditorVisible(true);
		});
		winbox.onmove = debounce(function resize(x: number, y: number) {
			client.patch(`/projects/${projectId}/terminals/${terminal.id}`, {
				body: {
					// multiply by 100 to make default 1% instead of 100
					x: getPercent(x, element?.offsetWidth || x * 100),
					y: getPercent(y, element?.offsetHeight || x * 100),
				},
				forget: true,
			});
		}, 1000);
		terminal.logs?.reverse().forEach(({ log }) => {
			xterm.write(log);
		});

		xterm.onResize(({ cols, rows }) => {
			client.patch(`/projects/${projectId}/terminals/${terminal.id}`, {
				body: {
					meta: {
						cols: cols,
						rows: rows,
					},
				},
				forget: true,
			});
		});
		winbox.onresize = debounce(function resize(width: number = 1, height: number = 1) {
			addons.fit.fit();
			client.patch(`/projects/${projectId}/terminals/${terminal.id}`, {
				body: {
					height: getPercent(height, element?.offsetHeight || height),
					width: getPercent(width, element?.offsetWidth || width),
				},
				forget: true,
			});
		}, 200);

		winbox.fullscreen = () => {
			showDrawer();
		};
		winbox.onclose = function (force?: boolean) {
			if (force) return false;
			if (window.confirm('Really delete the terminal with all settings?')) deleteTerminal();
			return true;
		};
		xterm.attachCustomKeyEventHandler((arg) => {
			if (arg.ctrlKey && arg.code === 'KeyC' && arg.type === 'keydown') {
				const selection = xterm.getSelection();
				if (selection) {
					copyText(selection);
					return false;
				}
			}
			return true;
		});
		xterm.onData((message: string) => {
			client.post('/terminal-command', {
				body: {
					command: message,
					terminalId: terminal.id,
				},
				forget: true,
			});
		});
		ref2.current = {
			winbox,
			xterm,
			addons,
		};
	}, [deleteTerminal, element, project, projectId, terminal]);
	useEffect(() => {
		if (!project.fontSize || !ref2.current) return;
		ref2.current.xterm.options.fontSize = project.fontSize;
		ref2.current.addons.fit.fit();

		client.patch('/projects/' + project.id + '/terminals/' + terminal.id, {
			body: {
				meta: {
					cols: ref2.current.xterm.cols,
					rows: ref2.current.xterm.rows,
				},
			},
			forget: true,
		});
	}, [project.fontSize, project.id, terminal.id]);

	useEffect(() => {
		const handler = debounce(() => {
			const position = getTerminalPosition(terminal, element);
			ref2.current?.winbox.move(position.x, position.y);
			ref2.current?.winbox.resize(position.width, position.height);
		}, 250);
		window.addEventListener('resize', handler);
		return () => {
			window.removeEventListener('resize', handler);
		};
	}, [element, terminal]);
	const showDrawer = () => {
		setVisible(true);
	};

	const handleSearch = (value: string) => {
		setCommandQuery(value);
		setEditorCommand(value);
	};

	const onSelect = (value: string) => {
		setEditorCommand(value);
	};

	const [isCommandSuggestionOpen, setIsCommandSuggestionOpen] = useState(false);
	return (
		<>
			<Modal
				visible={isCommandEditorVisible}
				onCancel={() => {
					setIsCommandEditorVisible(false);
				}}
				footer={null}
				closable={false}
			>
				<AutoComplete
					onDropdownVisibleChange={setIsCommandSuggestionOpen}
					options={(data || []).map((command) => ({
						value: command.command,
					}))}
					open={isCommandSuggestionOpen}
					value={editorCommand}
					style={{ width: '100%' }}
					onSelect={onSelect}
					onSearch={handleSearch}
					autoFocus={true}
				>
					<Input.TextArea
						autoSize={{
							minRows: 4,
							maxRows: 25,
						}}
						placeholder="Easily enter multiline commands here"
						className="custom"
						style={{ height: 50 }}
						onKeyDown={(e) => {
							if (e.key !== 'Enter' || e.shiftKey || (isCommandSuggestionOpen && data?.length)) return;
							client.post('/terminal-command', {
								body: {
									command: editorCommand + '\r\n',
									terminalId: terminal.id,
								},
								forget: true,
							});
							setEditorCommand('');
							setIsCommandEditorVisible(false);
							e.preventDefault();
						}}
					/>
				</AutoComplete>
			</Modal>
			<Drawer
				size="large"
				title="Terminal Settings"
				placement="right"
				onClose={onClose}
				open={visible}
				destroyOnClose={true}
			>
				<Button
					icon={<AiOutlineReload style={{ marginRight: '1rem' }} />}
					style={{ display: 'inline-flex', alignItems: 'center', marginRight: '20px' }}
					onClick={() => {
						if (!ref2.current) return;
						patchTerminal({
							restart: true,
							meta: {
								cols: ref2.current.xterm.cols,
								rows: ref2.current.xterm.rows,
							},
						});
						onClose();
					}}
				>
					Reload Terminal
				</Button>
				<Button
					style={{ display: 'inline-flex', alignItems: 'center' }}
					icon={<BsTerminalSplit style={{ marginRight: '1rem' }} />}
					onClick={() => {
						cloneTerminal({
							id: terminal.id,
						});
						onClose();
					}}
				>
					Clone Terminal
				</Button>
				<Divider />
				<Form
					requiredMark={false}
					initialValues={terminal}
					onValuesChange={debounce((_, v) => {
						patchTerminal(v);
					}, 1000)}
				>
					<Form.Item colon={false} labelAlign="left" labelCol={{ span: 12 }} label="Terminal Title" name="title">
						<Input placeholder="Terminal Title" />
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Current Working Directory"
						name="cwd"
					>
						<Input placeholder="Current Working Directory" />
					</Form.Item>
					<Form.Item colon={false} labelAlign="left" labelCol={{ span: 12 }} label="Shell Location" name="shell">
						<Input placeholder="/usr/bin/bash" />
					</Form.Item>
					<Form.Item colon={false} labelAlign="left" labelCol={{ span: 12 }} label="Main Command" name="mainCommand">
						<Input placeholder="like 'npm run start'" />
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Startup Command"
						name="startupCommands"
					>
						<Input.TextArea placeholder="command that you run always at start" />
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Startup Environment Variables"
						name="startupEnvironmentVariables"
					>
						<Input.TextArea placeholder="Yaml syntax(KEY: VALUE)" />
					</Form.Item>
				</Form>
				<Divider />
				<Form.Item colon={false} labelAlign="left" labelCol={{ span: 12 }} label="Execute Scripts" name="executeScript">
					{projectScripts ? (
						<Collapse accordion destroyInactivePanel={true}>
							{projectScripts.map((script) => {
								const temp = visible ? (
									<ShellScriptExecution script={script} key={script.id} terminalId={terminal.id} onClose={onClose} />
								) : null;
								const hasParameters = !!script.parameters.length;
								return (
									<Collapse.Panel header={script.name} key={script.id} extra={hasParameters ? null : temp}>
										{temp}
									</Collapse.Panel>
								);
							})}
						</Collapse>
					) : (
						<em style={{ color: '#666' }}>Please create shell script from the main menu.</em>
					)}
				</Form.Item>
			</Drawer>
		</>
	);
};
