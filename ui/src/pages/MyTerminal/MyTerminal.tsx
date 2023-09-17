import { debounce } from 'lodash';
import { useRef, useEffect, useMemo } from 'react';
import { client } from '../../utils/socket';
import { Addons, createTerminal } from '../../utils/Terminal';
import { Drawer, Input, Modal, AutoComplete, Form } from 'antd';
import './MyTerminal.css';

// @ts-ignore
import WinBox from 'winbox/src/js/winbox';
import {
	Terminal,
	usePatchTerminal,
	useDeleteTerminal,
	useGetTerminalCommands,
	PatchTerminalRequest,
} from '../../services/terminals';
import { ITheme, Terminal as XTerm } from 'xterm';
import { useState } from 'react';
import { Project } from '../../services/project';
function copyText(text: string) {
	if (navigator?.clipboard?.writeText) {
		navigator.clipboard.writeText(text);
	}
}
function getTerminalPosition(
	terminal: Terminal,
	{ parent, shouldCenter }: { shouldCenter?: boolean; parent: HTMLDivElement }
) {
	const position = {
		height: terminal.height ? terminal.height : undefined,
		width: terminal.width ? terminal.width : undefined,
		x: terminal.x ? terminal.x : undefined,
		y: terminal.y ? terminal.y : undefined,
	};

	return position;
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
const getTerminalCoordinates = (terminalOrder: number, terminalCount: number) => {
	let columns: number[];
	if (terminalCount === 1) columns = [1];
	else if (terminalCount === 2) columns = [1, 1];
	else if (terminalCount === 3) columns = [2, 1];
	else if (terminalCount <= 8) {
		columns = new Array(Math.ceil(terminalCount / 2) - 1).fill(2);
		columns.push(terminalCount % 2 === 0 ? 2 : terminalCount % 2);
	} else {
		columns = new Array(Math.ceil(terminalCount / 3) - 1).fill(3);
		columns.push(terminalCount % 3 === 0 ? 3 : terminalCount % 3);
	}
	const viewport = getViewport();
	const width = Math.floor(viewport[0] / columns.length);
	let acc = 0,
		effectiveColumnIndex = 0,
		effectiveRowIndex = 0;
	for (let i = 0; i < columns.length; i++) {
		if (acc + columns[i] > terminalOrder) {
			effectiveColumnIndex = i;
			effectiveRowIndex = terminalOrder - acc;
			break;
		} else {
			acc += columns[i];
		}
	}
	const height = Math.floor(viewport[1] / columns[effectiveColumnIndex]);
	return {
		height,
		y: effectiveRowIndex * height,
		width,
		x: width * effectiveColumnIndex,
	};
};

export const MyTerminal = ({
	terminal,
	element,
	projectId,
	mainCommandCounter,
	project,
	terminalPatcher,
	setTerminalPatcher,
	terminalOrder,
	terminalsCount,
	triggerArrangeTerminals,
	patchTerminalId,
	setPatchTerminalId,
}: {
	patchTerminalId: number | null;
	setPatchTerminalId: (_: number | null) => void;
	triggerArrangeTerminals: number;
	terminalsCount: number;
	terminalOrder: number;
	project: Project;
	terminal: Terminal;
	element: HTMLDivElement;
	projectId: number;
	mainCommandCounter: number;
	terminalPatcher: PatchTerminalRequest | null;
	setTerminalPatcher: (terminalId: number, terminalPatcher: PatchTerminalRequest | null) => void;
}) => {
	const visible = useMemo(() => patchTerminalId === terminal.id, [patchTerminalId, terminal.id]);
	const [editorCommand, setEditorCommand] = useState('');
	const [commandQuery, setCommandQuery] = useState('');
	const [isCommandEditorVisible, setIsCommandEditorVisible] = useState(false);
	const { data } = useGetTerminalCommands(terminal.id, commandQuery, {
		initialData: [],
	});

	const ref2 = useRef<{
		xterm: XTerm;
		winbox: any;
		addons: Addons;
	}>();
	const { mutateAsync: patchTerminal } = usePatchTerminal(projectId, terminal.id);
	useEffect(() => {
		return () => {
			if (!ref2.current) return;
			ref2.current?.xterm.dispose();
			ref2.current?.winbox.close(true);
		};
	}, []);
	useEffect(() => {
		if (!terminalPatcher || !ref2.current) return;
		patchTerminal({
			...terminalPatcher,
			meta: {
				cols: ref2.current.xterm.cols,
				rows: ref2.current.xterm.rows,
			},
		});
		setTerminalPatcher(terminal.id, null);
	}, [terminalPatcher, patchTerminal, setTerminalPatcher, terminal.id]);
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
		const listeners = client.addServerResponseListenerFor.post<{ terminalId: string }>(
			'/terminals/:terminalId/terminal-data',
			async (req, res) => {
				const terminalId = Number(req.params.terminalId);
				const data = res.data;
				if (terminalId !== terminal.id) return;
				const instance = ref2.current;
				if (!instance) return;
				// @ts-ignore
				instance.xterm.write(data);
			}
		);
		return () => {
			listeners.stopListening();
		};
	}, [terminal.id]);
	const [arrangement, setArrangement] = useState<{ x: number; y: number; height: number; width: number } | null>(null);
	useEffect(() => {
		if (triggerArrangeTerminals === 0 && project.terminalLayout !== 'automatic') return;
		const arrangement = getTerminalCoordinates(terminalOrder, terminalsCount);
		setArrangement({
			x: arrangement.x,
			y: arrangement.y,
			width: arrangement.width,
			height: arrangement.height,
		});
	}, [terminalsCount, terminalOrder, project.terminalLayout, triggerArrangeTerminals]);
	useEffect(() => {
		if (arrangement && ref2.current) {
			ref2.current.winbox.move(arrangement.x, arrangement.y);
			ref2.current.winbox.resize(arrangement.width, arrangement.height);
		}
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
			...getTerminalPosition(terminal, {
				parent: element,
				shouldCenter: project.terminalLayout !== 'automatic',
			}),
		});
		const $title = winbox.dom.querySelector('.wb-title') as HTMLDivElement;
		$title.contentEditable = 'true';
		winbox.window.dataset.terminalId = terminal.id.toString();
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
					x,
					y,
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
					height,
					width,
				},
				forget: true,
			});
		}, 100);

		winbox.fullscreen = () => {
			setPatchTerminalId(terminal.id);
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
		return () => {
			// xterm.dispose();
		};
	}, [deleteTerminal, element, project, projectId, terminal, setPatchTerminalId]);
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
				open={isCommandEditorVisible}
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
				onClose={() => {
					setPatchTerminalId(null);
				}}
				open={visible}
				destroyOnClose={true}
			>
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
			</Drawer>
		</>
	);
};
