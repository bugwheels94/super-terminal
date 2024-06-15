import { debounce } from 'lodash-es';
import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useReducer } from 'react';
import { ws } from '../../utils/socket';
import { Addons, createTerminal } from '../../utils/Terminal';
import { Input, AutoComplete, Form, Alert } from 'antd';
import './MyTerminal.css';

// @ts-ignore
import WinBox from 'winbox/src/js/winbox';
import {
	Terminal,
	usePatchTerminal,
	useDeleteTerminal,
	useGetTerminalCommands,
	useCloneTerminal,
} from '../../services/terminals';
import { ITheme, Terminal as XTerm } from 'xterm';
import { useState } from 'react';
import { Project } from '../../services/project';
import { createPortal } from 'react-dom';
import { BsArrowRepeat, BsGear, BsTerminal, BsArrowUp, BsArrowDown } from 'react-icons/bs';
import { FiCopy } from 'react-icons/fi';
import { ShellScript, useGetProjectScripts } from '../../services/shellScript';
import { ShellScriptExecution } from './ShellScriptExecution';
import { ContextMenuContextProvider, ItemType } from '../Project/Project';
import { hasSomeParentTheClass } from '../../utils/dom';
import { Drawer } from '../components/Drawer';
import { fetchSocket } from '../../utils/fetch';
function copyText(text: string) {
	if (navigator?.clipboard?.writeText) {
		navigator.clipboard.writeText(text);
	} else if (document.execCommand) {
		document.execCommand('copy');
	}
}
function getTerminalPosition(terminal: Terminal, _: { shouldCenter?: boolean; parent: HTMLDivElement }) {
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

type Props = {
	terminalsCount: number;
	terminalOrder: number;
	project: Project;
	terminal: Terminal;
	element: HTMLDivElement;
	projectId: number;
	mainCommandCounter: number;
	commandToExecute: string;
	setCommandToExecute: (_: string) => void;
	maxZIndex: number;
};

export type MyTerminalHandle = {
	rearrange: () => void;
};
export const MyTerminal = forwardRef<MyTerminalHandle, Props>(
	(
		{
			terminal,
			element,
			projectId,
			mainCommandCounter,
			project,
			terminalOrder,
			terminalsCount,
			commandToExecute,
			setCommandToExecute,
			maxZIndex,
		},
		ref
	) => {
		const [isPatching, setIsPatching] = useState(false);
		const { mutate: patchTerminal, error } = usePatchTerminal(projectId, terminal.id);

		const [editorCommand, setEditorCommand] = useState('');
		const [isCommandSuggestionOpen, setIsCommandSuggestionOpen] = useState(false);
		const [searchValue, setSearchValue] = useState('');
		const [commandQuery, setCommandQuery] = useState('');
		const [isCommandEditorVisible, setIsCommandEditorVisible] = useState(false);
		const { data } = useGetTerminalCommands(terminal.id, commandQuery, {
			initialData: [],
		});
		const { mutate: cloneTerminal } = useCloneTerminal(project.id);
		const { data: projectScripts } = useGetProjectScripts(project.id);
		const [executionScript, setExecutionScript] = useState<ShellScript | null>(null);
		const { mutate: deleteTerminal } = useDeleteTerminal(projectId, terminal.id);

		const executeCommand = useCallback(
			(command: string) => {
				switch (command) {
					case 'restart':
						patchTerminal({ restart: true });
						break;
					case 'clone':
						cloneTerminal({ id: terminal.id, terminal: { z: maxZIndex } });
						break;
					case 'settings':
						setIsPatching(true);
						break;
					case 'delete':
						deleteTerminal();
						break;
					case 'editor':
						setIsCommandEditorVisible(true);
						break;
				}
			},
			[cloneTerminal, setIsPatching, deleteTerminal, patchTerminal, setIsCommandEditorVisible, terminal.id]
		);
		useEffect(() => {
			if (commandToExecute) {
				executeCommand(commandToExecute);
				setCommandToExecute('');
			}
		}, [commandToExecute, executeCommand, setCommandToExecute]);

		const data2 = useMemo(
			() =>
				[
					{
						heading: 'Terminal Actions',
						title: 'Reload Terminal',
						icon: <BsArrowRepeat style={{ verticalAlign: 'middle' }} />,
						onClick: () => executeCommand('restart'),
					},
					{
						title: 'Clone Terminal',
						icon: <FiCopy style={{ verticalAlign: 'middle' }} />,
						onClick: () => executeCommand('clone'),
					},
					{
						title: 'Terminal Settings',
						icon: <BsGear style={{ verticalAlign: 'middle' }} />,
						onClick: () => executeCommand('settings'),
					},
					{
						title: 'Execute Shell Script',
						icon: <BsTerminal style={{ verticalAlign: 'middle' }} />,
						children: projectScripts?.map((script) => {
							return {
								key: script.id,
								title: script.name,
								icon: <BsTerminal style={{ verticalAlign: 'middle' }} />,
								onClick: () => {
									setExecutionScript(script);
								},
							};
						}),
						placeholder: 'Please create a shell script first.',
					},
				] as ItemType[],
			[projectScripts, executeCommand]
		);

		type Action = { type: 'set'; payload: State } | { type: 'reset' };

		// Define the state type
		type State = {
			xterm: XTerm;
			winbox: any;
			addons: Addons;
		} | null;
		const contextMenuContextProvider = useContext(ContextMenuContextProvider);
		// Reducer function
		function reducer(state: State, action: Action): State {
			switch (action.type) {
				case 'set':
					return action.payload;
				case 'reset':
					return null;
				default:
					return state;
			}
		}
		const [state, dispatch] = useReducer(reducer, null);
		useEffect(() => {
			if (!state?.winbox) return;
			const temp = () => {
				contextMenuContextProvider.addItems(data2, 'child');
			};
			state.winbox.body?.addEventListener('contextmenu', temp, true);
			return () => {
				state.winbox.body?.removeEventListener('contextmenu', temp, true);
			};
		}, [data2, state?.winbox]);

		useEffect(() => {
			if (!state) return;
			state.xterm.options.theme = convertToITheme(project.terminalTheme);
		}, [project.terminalTheme, state]);
		useEffect(() => {
			if (mainCommandCounter === 0 || terminal.mainCommand == null) return;
			fetchSocket('post:terminal-command', {
				data: {
					command: terminal.mainCommand + '\r\n',
					terminalId: terminal.id,
				},
				forget: true,
			});
		}, [mainCommandCounter, terminal.id, terminal.mainCommand]);

		useEffect(() => {
			if (!state) return;
			function listener(e: any) {
				if (!state) return;
				const { detail } = e;
				try {
					const message = JSON.parse(detail);
					switch (message.name) {
						case 'terminal-data': {
							const terminalId = Number(message.data.id);
							const data = message.data.data;
							if (terminalId !== terminal.id) return;
							state.xterm.write(data);
						}
					}
				} catch (e) {}
			}
			ws.addEventListener('message', listener);
			return () => {
				ws.removeEventListener('message', listener);
			};
		}, [terminal.id, state]);
		useImperativeHandle(
			ref,
			() => ({
				rearrange() {
					if (!state) return;
					if (terminal.minimized || terminal.maximized) return;
					console.log('Arrangin 1');
					const arrangement = getTerminalCoordinates(terminalOrder, terminalsCount);
					const winbox = state.winbox;
					if (winbox.max) {
						winbox.restore();
					}
					winbox.move(arrangement.x, arrangement.y);
					winbox.resize(arrangement.width, arrangement.height);
				},
			}),
			[terminalsCount, terminalOrder, state, terminal.minimized, terminal.maximized]
		);

		const [searchBar, setSearchBar] = useState(false);
		useEffect(() => {
			if (!state) return;
			if (terminal.title) state.winbox.setTitle(terminal.title);
		}, [terminal.title, state]);
		const showSearchBarOnKeyboard = useCallback((event: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>) => {
			if ((event.ctrlKey || event.metaKey) && event.code === 'KeyF' && event.type === 'keydown') {
				setSearchBar(true);
				event.preventDefault();
				return true;
			}
		}, []);
		const searchNextOrPrevious = useCallback(
			(event: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>) => {
				if (event.key === 'Escape') {
					state?.xterm.focus();
					return;
				}
				if (event.key !== 'Enter' || !searchValue || !state?.addons) return;
				if (event.shiftKey) {
					state.addons.search.findPrevious(searchValue);
				} else state.addons.search.findNext(searchValue);
			},
			[searchValue, state?.addons, state?.xterm]
		);
		useEffect(() => {
			const xterm = state?.xterm;
			if (!xterm) return;
			xterm.attachCustomKeyEventHandler((event) => {
				if (event.ctrlKey && event.code === 'KeyC' && event.type === 'keydown') {
					const selection = xterm.getSelection();

					if (selection) {
						copyText(selection);
						event.preventDefault();
						return false;
					}
				}
				if (showSearchBarOnKeyboard(event) === true) return false;

				if (event.key === 'Escape' && searchBar) {
					setSearchBar(false);
					return false;
				}
				return true;
			});
		}, [showSearchBarOnKeyboard, state?.xterm, searchBar]);
		useEffect(() => {
			if (!project) return;
			const winbox = new WinBox(terminal.title || 'Untitled', {
				index: terminal.z,
				root: element,
				minheight: 100,
				min: !!terminal.minimized,
				max: !!terminal.maximized,
				...getTerminalPosition(terminal, {
					parent: element,
					shouldCenter: project.terminalLayout !== 'automatic',
				}),
			});
			const $title = winbox.dom.querySelector('.wb-title') as HTMLDivElement;
			$title.contentEditable = 'true';
			winbox.window.dataset.terminalId = terminal.id.toString();
			// winbox.window.style.zIndex = terminal.z;
			const { xterm, addons } = createTerminal(winbox.body, {
				fontSize: project.fontSize,
				scrollback: project.scrollback || 1000,
				theme: convertToITheme(project.terminalTheme),
			});
			winbox.body.addEventListener('click', (e: MouseEvent) => {
				const target = e.target as HTMLElement | null;
				if (!e.metaKey) return;
				if (hasSomeParentTheClass(target, 'searchBar')) return;
				executeCommand('editor');
			});
			terminal.logs?.forEach(({ log }) => {
				xterm.write(log);
			});

			xterm.onResize(
				debounce(({ cols, rows }: { cols: number; rows: number }) => {
					fetchSocket(`patch:terminal`, {
						data: {
							id: terminal.id,
							projectId,
							terminal: {
								meta: {
									cols: cols,
									rows: rows,
								},
							},

							// multiply by 100 to make default 1% instead of 100
						},
						forget: true,
						namespace: 'terminal',
					});
				}, 200)
			);
			winbox.fullscreen = () => {
				setIsPatching(true);
			};
			winbox.onclose = function (force?: boolean) {
				if (force) return false;
				executeCommand('delete');
				return true;
			};
			xterm.onData((message: string) => {
				fetchSocket('post:terminal-command', {
					data: {
						command: message,
						terminalId: terminal.id,
					},
					forget: true,
					namespace: 'terminal',
				});
			});
			dispatch({
				type: 'set',
				payload: {
					winbox,
					xterm,
					addons,
				},
			});
			return () => {
				dispatch({ type: 'reset' });
				if (winbox.dom !== null) winbox.close(true);
				xterm.dispose();
			};
			//adding project as deps cause the winbox etc to be created again again
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [executeCommand, element, projectId, terminal.id]);

		useEffect(() => {
			if (!state) return;
			const { winbox, addons } = state;
			winbox.onfocus = function () {
				fetchSocket(`patch:terminal`, {
					data: {
						id: terminal.id,
						projectId,
						terminal: {
							z: winbox.window.style.zIndex,
						},
					},
					namespace: 'terminal',
				});
			};
			winbox.onmove = debounce(function resize(x: number, y: number) {
				// window is minimized
				if (winbox.min || winbox.max) return;

				// means moved because window moved in some other tab
				if (terminal.x === x && terminal.y === y) return;
				fetchSocket(`patch:terminal`, {
					data: {
						id: terminal.id,
						projectId,
						terminal: {
							x,
							y,
						},

						// multiply by 100 to make default 1% instead of 100
					},
					namespace: 'terminal',
				});
			}, 200);

			winbox.onminimize = function () {
				if (!terminal.minimized)
					fetchSocket(`patch:terminal`, {
						data: {
							id: terminal.id,
							projectId,
							terminal: {
								minimized: true,
							},
							// multiply by 100 to make default 1% instead of 100
						},
						namespace: 'terminal',
					});
			};

			winbox.onmaximize = function () {
				if (!terminal.maximized)
					fetchSocket(`patch:terminal`, {
						data: {
							id: terminal.id,
							projectId,
							terminal: {
								maximized: true,
							},
							// multiply by 100 to make default 1% instead of 100
						},
						namespace: 'terminal',
					});
			};
			winbox.onrestore = function () {
				if (!terminal.minimized && !terminal.maximized) return;
				fetchSocket(`patch:terminal`, {
					data: {
						id: terminal.id,
						projectId,
						terminal: {
							minimized: false,
							maximized: false,
						},

						// multiply by 100 to make default 1% instead of 100
					},
					namespace: 'terminal',
				});
			};
			winbox.onresize = debounce(function resize(width: number = 1, height: number = 1) {
				// window is minimized
				if (winbox.min || height < 100) return;
				console.log(1);
				if (winbox.max || height === window.innerHeight) return;
				console.log(12);
				if (terminal.height === height && terminal.width === width) return;
				console.log(13);
				console.log('RESIZINE', winbox.max, height, window.innerHeight);

				addons.fit.fit();

				// minimize has triggered resize and no need to do anything
				fetchSocket(`patch:terminal`, {
					data: {
						id: terminal.id,
						projectId,
						terminal: {
							height,
							width,
							minimized: false,
							maximized: false,
						},

						// multiply by 100 to make default 1% instead of 100
					},
					namespace: 'terminal',
				});
			}, 200);
		}, [terminal, state, projectId]);
		// cannot move up since we need onmove to change before moving
		useEffect(() => {
			if (!state) return;
			if (state.winbox.x !== terminal.x || state.winbox.y !== terminal.y) {
				// console.log(state.winbox.move);
				state.winbox.move(terminal.x, terminal.y);
			}
			// console.log(state.winbox.x, state.winbox.y, terminal.x, terminal.y);
			// console.log('TREMINAL MOVED');
		}, [state, terminal.x, terminal.y]);

		useEffect(() => {
			if (!state) return;
			if (terminal.maximized) {
				state.winbox.maximize();
			} else if (terminal.minimized) {
				state.winbox.minimize();
			} else {
				// console.log(state.winbox.move);
				state.winbox.restore();
			}
			// console.log(state.winbox.x, state.winbox.y, terminal.x, terminal.y);
			// console.log('TREMINAL MOVED');
		}, [state, terminal.maximized, terminal.minimized]);

		useEffect(() => {
			if (!state) return;
			if (state.winbox.width !== terminal.width || state.winbox.height !== terminal.height) {
				// console.log(state.winbox.move);
				console.log('resizing to', terminal.width, terminal.height);
				state.winbox.resize(terminal.width, terminal.height);
			}
			// console.log(state.winbox.x, state.winbox.y, terminal.x, terminal.y);
			// console.log('TREMINAL MOVED');
		}, [state, terminal.height, terminal.width]);

		useEffect(() => {
			if (!state) return;
			if (state.winbox.window.style.zIndex !== terminal.z) {
				// console.log(state.winbox.move);
				state.winbox.window.style.zIndex = terminal.z;
			}
			// console.log(state.winbox.x, state.winbox.y, terminal.x, terminal.y);
			// console.log('TREMINAL MOVED');
		}, [state, terminal.z]);

		// runs on fontsize change
		useEffect(() => {
			if (!project.fontSize || !state) return;
			state.xterm.options.fontSize = project.fontSize;
			state.addons.fit.fit();

			fetchSocket(`patch:terminal`, {
				data: {
					id: terminal.id,
					projectId,
					terminal: {
						meta: {
							cols: state.xterm.cols,
							rows: state.xterm.rows,
						},
					},

					// multiply by 100 to make default 1% instead of 100
				},
				forget: true,
			});
		}, [project.fontSize, terminal.id, state, projectId]);

		// keep it last
		useEffect(() => {
			if (project.terminalLayout !== 'automatic') return;
			if (!state) return;
			if (terminal.minimized || terminal.maximized) return;
			const arrangement = getTerminalCoordinates(terminalOrder, terminalsCount);
			console.log('Arrangin 2', terminal.id, arrangement, state.winbox.max);
			const winbox = state.winbox;
			if (winbox.max) {
				winbox.restore();
			}
			winbox.move(arrangement.x, arrangement.y);
			winbox.resize(arrangement.width, arrangement.height);
		}, [
			terminalsCount,
			terminalOrder,
			project.terminalLayout,
			state,
			terminal.minimized,
			terminal.maximized,
			terminal.id,
		]);

		const handleSearch = (value: string) => {
			setCommandQuery(value);
			setEditorCommand(value);
		};

		const onSelect = (value: string) => {
			setEditorCommand(value);
		};

		useEffect(() => {
			if (!state) return;
			state.addons.search.findNext(searchValue, {
				incremental: true,
			});
		}, [searchValue, state]);
		if (!state) return null;
		return (
			<>
				<Drawer title="Execute Shell Script" open={!!executionScript} onClose={() => setExecutionScript(null)}>
					{executionScript && (
						<ShellScriptExecution
							script={executionScript}
							terminalId={terminal.id}
							onClose={() => {
								setExecutionScript(null);
							}}
						/>
					)}
				</Drawer>

				{searchBar &&
					createPortal(
						<div className="searchBar" style={{}}>
							<input
								autoFocus
								onChange={(e) => {
									setSearchValue(e.target.value.trim());
								}}
								placeholder="Type to search"
								onKeyDown={searchNextOrPrevious}
							/>
							<button
								onClick={() => {
									state.addons.search.findPrevious(searchValue, {});
								}}
							>
								<BsArrowUp />
							</button>
							<button
								onClick={() => {
									state.addons.search.findNext(searchValue, {});
								}}
							>
								<BsArrowDown />
							</button>
							<button
								onClick={() => {
									setSearchBar(false);
								}}
							>
								&#x2715;
							</button>
						</div>,
						state.winbox.body,
						terminal.title
					)}
				<Drawer
					open={isCommandEditorVisible}
					onClose={() => {
						setIsCommandEditorVisible(false);
					}}
					title="Type Command Here"
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
								fetchSocket('post:terminal-command', {
									data: {
										command: editorCommand + '\r\n',
										terminalId: terminal.id,
									},
									forget: true,
									namespace: 'terminal',
								});
								setEditorCommand('');
								setIsCommandEditorVisible(false);
								e.preventDefault();
							}}
						/>
					</AutoComplete>
				</Drawer>
				<Drawer
					title="Terminal Settings"
					onClose={() => {
						setIsPatching(false);
					}}
					open={isPatching}
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
						{error && <Alert message={error?.message} type="error" />}
					</Form>
				</Drawer>
			</>
		);
	}
);
