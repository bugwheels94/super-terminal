import { debounce } from "lodash-es";
import {
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { ws } from "../../utils/socket";
import { Addons, createTerminal } from "../../utils/Terminal";
import { Input, AutoComplete } from "antd";
import "./MyTerminal.css";

import {
  Terminal,
  usePatchTerminal,
  useDeleteTerminal,
  useGetTerminalCommands,
  useCloneTerminal,
} from "../../services/terminals";
import { ITheme, Terminal as XTerm } from "xterm";
import { useState } from "react";
import { Project } from "../../services/project";
import { createPortal } from "react-dom";
import { BsArrowRepeat, BsGear, BsTerminal, BsArrowUp, BsArrowDown } from "react-icons/bs";
import { FiCopy } from "react-icons/fi";
import { ShellScript, useGetProjectScripts } from "../../services/shellScript";
import { ShellScriptExecution } from "./ShellScriptExecution";
import { ContextMenuContextProvider, ItemType } from "../Project/Project";
import { hasSomeParentTheClass } from "../../utils/dom";
import { Drawer } from "../components/Drawer";
import { fetchSocket } from "../../utils/fetch";

function copyText(text: string) {
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
  } else if (document.execCommand) {
    document.execCommand("copy");
  }
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

const settingsFormStyle = { display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' } as React.CSSProperties;
const settingsRowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: '1rem' } as React.CSSProperties;
const settingsLabelStyle = { fontSize: '13px', color: '#333' } as React.CSSProperties;
const settingsInputStyle = { padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none', background: '#fff' } as React.CSSProperties;
const settingsTextareaStyle = { ...settingsInputStyle, fontFamily: 'Menlo, Consolas, monospace', minHeight: '80px', resize: 'vertical' as const } as React.CSSProperties;

function TerminalSettingsForm({ terminal, patchTerminal, error }: { terminal: Terminal; patchTerminal: (v: any) => void; error: any }) {
  const [values, setValues] = useState({ ...terminal });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next as any);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => patchTerminal({ [key]: value }), 1000);
  };

  return (
    <div style={settingsFormStyle}>
      <div style={settingsRowStyle}>
        <label style={settingsLabelStyle}>Terminal Title</label>
        <input style={settingsInputStyle} placeholder="Terminal Title" value={(values as any).title || ''} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div style={settingsRowStyle}>
        <label style={settingsLabelStyle}>Current Working Directory</label>
        <input style={settingsInputStyle} placeholder="Current Working Directory" value={(values as any).cwd || ''} onChange={(e) => set('cwd', e.target.value)} />
      </div>
      <div style={settingsRowStyle}>
        <label style={settingsLabelStyle}>Shell Location</label>
        <input style={settingsInputStyle} placeholder="/usr/bin/bash" value={(values as any).shell || ''} onChange={(e) => set('shell', e.target.value)} />
      </div>
      <div style={settingsRowStyle}>
        <label style={settingsLabelStyle}>Main Command</label>
        <input style={settingsInputStyle} placeholder="like 'npm run start'" value={(values as any).mainCommand || ''} onChange={(e) => set('mainCommand', e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={settingsLabelStyle}>Startup Command</label>
        <textarea style={settingsTextareaStyle} placeholder="command that you run always at start" value={(values as any).startupCommands || ''} onChange={(e) => set('startupCommands', e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={settingsLabelStyle}>Startup Environment Variables</label>
        <textarea style={settingsTextareaStyle} placeholder="Yaml syntax (KEY: VALUE)" value={(values as any).startupEnvironmentVariables || ''} onChange={(e) => set('startupEnvironmentVariables', e.target.value)} />
      </div>
      {error && <div style={{ color: '#e00', fontSize: '12px', padding: '6px 10px', background: '#fff0f0', border: '1px solid #fcc', borderRadius: '4px' }}>{error?.message}</div>}
    </div>
  );
}

type Props = {
  project: Project;
  terminal: Terminal;
  projectId: number;
  mainCommandCounter: number;
  commandToExecute: string;
  setCommandToExecute: (_: string) => void;
};

export type MyTerminalHandle = {
  fit: () => void;
};

export const MyTerminal = memo(
  forwardRef<MyTerminalHandle, Props>(
    (
      { terminal, projectId, mainCommandCounter, project, commandToExecute, setCommandToExecute },
      ref,
    ) => {
      console.log("MyTerminal render", terminal.id);
      const [isPatching, setIsPatching] = useState(false);
      const { mutate: patchTerminal, error } = usePatchTerminal(projectId, terminal.id);

      const [editorCommand, setEditorCommand] = useState("");
      const [isCommandSuggestionOpen, setIsCommandSuggestionOpen] = useState(false);
      const [searchValue, setSearchValue] = useState("");
      const [commandQuery, setCommandQuery] = useState("");
      const [isCommandEditorVisible, setIsCommandEditorVisible] = useState(false);
      const { data } = useGetTerminalCommands(terminal.id, commandQuery, {
        initialData: [],
      });
      const { mutate: cloneTerminal } = useCloneTerminal(project.id);
      const { data: projectScripts } = useGetProjectScripts(project.id);
      const [executionScript, setExecutionScript] = useState<ShellScript | null>(null);
      const { mutate: deleteTerminal } = useDeleteTerminal(projectId, terminal.id);
      const containerRef = useRef<HTMLDivElement>(null);
      const xtermContainerRef = useRef<HTMLDivElement>(null);

      const executeCommand = useCallback(
        (command: string) => {
          switch (command) {
            case "restart":
              patchTerminal({ restart: true });
              break;
            case "clone":
              cloneTerminal({ id: terminal.id, terminal: {} });
              break;
            case "settings":
              setIsPatching(true);
              break;
            case "delete":
              deleteTerminal();
              break;
            case "editor":
              setIsCommandEditorVisible(true);
              break;
          }
        },
        [
          cloneTerminal,
          setIsPatching,
          deleteTerminal,
          patchTerminal,
          setIsCommandEditorVisible,
          terminal.id,
        ],
      );

      // Stable ref so useEffects don't re-run when executeCommand changes
      const executeCommandRef = useRef(executeCommand);
      executeCommandRef.current = executeCommand;

      useEffect(() => {
        if (commandToExecute) {
          executeCommand(commandToExecute);
          setCommandToExecute("");
        }
      }, [commandToExecute, executeCommand, setCommandToExecute]);

      const data2 = useMemo(
        () =>
          [
            {
              heading: "Terminal Actions",
              title: "Reload Terminal",
              icon: <BsArrowRepeat style={{ verticalAlign: "middle" }} />,
              onClick: () => executeCommandRef.current("restart"),
            },
            {
              title: "Clone Terminal",
              icon: <FiCopy style={{ verticalAlign: "middle" }} />,
              onClick: () => executeCommandRef.current("clone"),
            },
            {
              title: "Terminal Settings",
              icon: <BsGear style={{ verticalAlign: "middle" }} />,
              onClick: () => executeCommandRef.current("settings"),
            },
            {
              title: "Execute Shell Script",
              icon: <BsTerminal style={{ verticalAlign: "middle" }} />,
              children: projectScripts?.map((script) => {
                return {
                  key: script.id,
                  title: script.name,
                  icon: <BsTerminal style={{ verticalAlign: "middle" }} />,
                  onClick: () => {
                    setExecutionScript(script);
                  },
                };
              }),
              placeholder: "Please create a shell script first.",
            },
          ] as ItemType[],
        [projectScripts],
      );

      type Action = { type: "set"; payload: State } | { type: "reset" };
      type State = {
        xterm: XTerm;
        addons: Addons;
      } | null;

      const contextMenuContextProvider = useContext(ContextMenuContextProvider);

      function reducer(state: State, action: Action): State {
        switch (action.type) {
          case "set":
            return action.payload;
          case "reset":
            return null;
          default:
            return state;
        }
      }
      const [state, dispatch] = useReducer(reducer, null);

      // Context menu on right-click
      useEffect(() => {
        if (!state || !containerRef.current) return;
        const el = containerRef.current;
        const temp = () => {
          contextMenuContextProvider.addItems(data2, "child");
        };
        el.addEventListener("contextmenu", temp, true);
        return () => {
          el.removeEventListener("contextmenu", temp, true);
        };
      }, [data2, state]);

      // Theme changes
      useEffect(() => {
        if (!state) return;
        state.xterm.options.theme = convertToITheme(project.terminalTheme);
      }, [project.terminalTheme, state]);

      // Main command execution
      useEffect(() => {
        if (mainCommandCounter === 0 || terminal.mainCommand == null) return;
        fetchSocket("post:terminal-command", {
          data: {
            command: terminal.mainCommand + "\r\n",
            terminalId: terminal.id,
          },
          forget: true,
        });
      }, [mainCommandCounter, terminal.id, terminal.mainCommand]);

      // Listen for terminal data from WebSocket
      useEffect(() => {
        if (!state) return;
        function listener(e: any) {
          if (!state) return;
          const { detail } = e;
          try {
            const message = JSON.parse(detail);
            switch (message.name) {
              case "terminal-data": {
                const terminalId = Number(message.data.id);
                const data = message.data.data;
                if (terminalId !== terminal.id) return;
                state.xterm.write(data);
              }
            }
          } catch (e) {}
        }
        ws.addEventListener("message", listener);
        return () => {
          ws.removeEventListener("message", listener);
        };
      }, [terminal.id, state]);

      // Expose fit method to parent
      useImperativeHandle(
        ref,
        () => ({
          fit() {
            if (!state) return;
            state.addons.fit.fit();
          },
        }),
        [state],
      );

      const [searchBar, setSearchBar] = useState(false);

      const showSearchBarOnKeyboard = useCallback(
        (event: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.code === "KeyF" &&
            event.type === "keydown"
          ) {
            setSearchBar(true);
            event.preventDefault();
            return true;
          }
        },
        [],
      );

      const searchNextOrPrevious = useCallback(
        (event: KeyboardEvent | React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape") {
            state?.xterm.focus();
            return;
          }
          if (event.key !== "Enter" || !searchValue || !state?.addons) return;
          if (event.shiftKey) {
            state.addons.search.findPrevious(searchValue);
          } else state.addons.search.findNext(searchValue);
        },
        [searchValue, state?.addons, state?.xterm],
      );

      // Track drawer state in refs so the key handler doesn't need to re-attach
      const drawerOpenRef = useRef(false);
      drawerOpenRef.current = isPatching || isCommandEditorVisible || !!executionScript;

      // Keyboard handler for copy and search
      useEffect(() => {
        const xterm = state?.xterm;
        if (!xterm) return;
        xterm.attachCustomKeyEventHandler((event) => {
          // Block all input when a drawer is open
          if (drawerOpenRef.current) return false;
          if (event.ctrlKey && event.code === "KeyC" && event.type === "keydown") {
            const selection = xterm.getSelection();
            if (selection) {
              copyText(selection);
              event.preventDefault();
              return false;
            }
          }
          if (showSearchBarOnKeyboard(event) === true) return false;
          if (event.key === "Escape" && searchBar) {
            setSearchBar(false);
            return false;
          }
          return true;
        });
      }, [showSearchBarOnKeyboard, state?.xterm, searchBar]);

      // Initialize xterm in our container div
      useEffect(() => {
        if (!project || !xtermContainerRef.current) return;

        const container = xtermContainerRef.current;
        const { xterm, addons } = createTerminal(container, {
          fontSize: project.fontSize,
          scrollback: project.scrollback || 1000,
          theme: convertToITheme(project.terminalTheme),
        });

        // Click handler for command editor
        container.addEventListener("click", (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;
          if (!e.metaKey) return;
          if (hasSomeParentTheClass(target, "searchBar")) return;
          executeCommandRef.current("editor");
        });

        // Write restored logs
        terminal.logs?.forEach(({ log }) => {
          xterm.write(log);
        });

        // Send resize events to server
        xterm.onResize(
          debounce(({ cols, rows }: { cols: number; rows: number }) => {
            fetchSocket(`patch:terminal`, {
              data: {
                id: terminal.id,
                projectId,
                terminal: {
                  meta: { cols, rows },
                },
              },
              forget: true,
              namespace: "terminal",
            });
          }, 200),
        );

        // Send input to server
        xterm.onData((message: string) => {
          fetchSocket("post:terminal-command", {
            data: {
              command: message,
              terminalId: terminal.id,
            },
            forget: true,
            namespace: "terminal",
          });
        });

        dispatch({
          type: "set",
          payload: { xterm, addons },
        });

        addons.fit.fit();

        // ResizeObserver to re-fit when container size changes
        let rafId: number | null = null;
        const resizeObserver = new ResizeObserver(() => {
          if (rafId != null) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            addons.fit.fit();
          });
        });
        resizeObserver.observe(container);

        return () => {
          dispatch({ type: "reset" });
          resizeObserver.disconnect();
          xterm.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [projectId, terminal.id]);

      // Font size changes
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
          },
          namespace: "terminal",
          forget: true,
        });
      }, [project.fontSize, terminal.id, state, projectId]);

      // Search
      useEffect(() => {
        if (!state) return;
        state.addons.search.findNext(searchValue, { incremental: true });
      }, [searchValue, state]);

      const handleSearch = (value: string) => {
        setCommandQuery(value);
        setEditorCommand(value);
      };

      const onSelect = (value: string) => {
        setEditorCommand(value);
      };

      return (
        <div ref={containerRef} className="terminal-panel">
          <div className="terminal-title-bar">
            <span className="terminal-title">{terminal.title || "Terminal"}</span>
            <div className="terminal-actions">
              <button title="Reload" onClick={() => executeCommand("restart")}>
                <BsArrowRepeat />
              </button>
              <button title="Clone" onClick={() => executeCommand("clone")}>
                <FiCopy />
              </button>
              <button title="Settings" onClick={() => executeCommand("settings")}>
                <BsGear />
              </button>
              <button title="Close" onClick={() => executeCommand("delete")}>
                &#x2715;
              </button>
            </div>
          </div>
          <div ref={xtermContainerRef} className="terminal-body" />

          {searchBar &&
            xtermContainerRef.current &&
            createPortal(
              <div className="searchBar">
                <input
                  autoFocus
                  onChange={(e) => setSearchValue(e.target.value.trim())}
                  placeholder="Type to search"
                  onKeyDown={searchNextOrPrevious}
                />
                <button onClick={() => state?.addons.search.findPrevious(searchValue, {})}>
                  <BsArrowUp />
                </button>
                <button onClick={() => state?.addons.search.findNext(searchValue, {})}>
                  <BsArrowDown />
                </button>
                <button onClick={() => setSearchBar(false)}>&#x2715;</button>
              </div>,
              xtermContainerRef.current,
              terminal.title || undefined,
            )}

          <Drawer
            title="Execute Shell Script"
            open={!!executionScript}
            onClose={() => setExecutionScript(null)}
          >
            {executionScript && (
              <ShellScriptExecution
                script={executionScript}
                terminalId={terminal.id}
                onClose={() => setExecutionScript(null)}
              />
            )}
          </Drawer>
          <Drawer
            open={isCommandEditorVisible}
            onClose={() => setIsCommandEditorVisible(false)}
            title="Type Command Here"
          >
            <AutoComplete
              onDropdownVisibleChange={setIsCommandSuggestionOpen}
              options={(data || []).map((command) => ({ value: command.command }))}
              open={isCommandSuggestionOpen}
              value={editorCommand}
              style={{ width: "100%" }}
              onSelect={onSelect}
              onSearch={handleSearch}
              autoFocus={true}
            >
              <Input.TextArea
                autoSize={{ minRows: 4, maxRows: 25 }}
                placeholder="Easily enter multiline commands here"
                className="custom"
                style={{ height: 50 }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || (isCommandSuggestionOpen && data?.length))
                    return;
                  fetchSocket("post:terminal-command", {
                    data: {
                      command: editorCommand + "\r\n",
                      terminalId: terminal.id,
                    },
                    forget: true,
                    namespace: "terminal",
                  });
                  setEditorCommand("");
                  setIsCommandEditorVisible(false);
                  e.preventDefault();
                }}
              />
            </AutoComplete>
          </Drawer>
          <Drawer title="Terminal Settings" onClose={() => setIsPatching(false)} open={isPatching}>
            <TerminalSettingsForm terminal={terminal} patchTerminal={patchTerminal} error={error} />
          </Drawer>
        </div>
      );
    },
  ),
);
