import { lazy, ReactNode, Suspense, useCallback, useEffect, useReducer, useState } from "react";
import "xterm/css/xterm.css";
import { createContext } from "react";
import WebSocket from "isomorphic-ws";
import { getTerminalQueryKey, Terminal, useGetTerminals } from "../../services/terminals";
import {
  usePutProject,
  usePatchProject,
  getProjectQueryKey,
  Project,
  PatchProjectRequest,
  PostProjectRequest,
  useGetProject,
  getProjectsQueryKey,
} from "../../services/project";
import { MyTerminal } from "../MyTerminal/MyTerminal";
import "./Project.css";
import { useQueryClient } from "@tanstack/react-query";
import { ws } from "../../utils/socket";
import { useNavigate, useParams } from "react-router-dom";

import ProjectForm from "./Form";
import Drawer from "../components/Drawer";
import ShellScriptComponent from "./ShellScript";
import { AutoComplete } from "antd";
const ContextMenu = lazy(() => import("./ContextMenu"));

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
  console.log("Project2 render");
  const { projectSlug = "" } = useParams<"projectSlug">() as {
    projectSlug: string;
    projectId?: number;
  };
  const { data: projectId } = usePutProject(projectSlug);
  const { data: project } = useGetProject(projectId);
  type State = { items: Map<string, ItemType[]>; id: number; coordinates: Coordinates | undefined };

  type Action =
    | {
        type: "set-coordinates";
        value: Coordinates | undefined;
      }
    | {
        type: "add";
        value: ItemType[];
        key: string;
      }
    | { type: "removeAll" };

  function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "removeAll":
        let items = new Map();
        state.items.forEach((_, key) => items.set(key, []));
        return {
          ...state,
          id: state.id + 1,
          items,
        };
      case "set-coordinates":
        return {
          ...state,

          coordinates: action.value,
        };
      case "add":
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
      ["child", []],

      ["parent", []],
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
            type: "set-coordinates",
            value: coordinates,
          });
        },
        addItems: (newItems: ItemType[], key: string) => {
          setContextMenuItems({ value: newItems, type: "add", key });
        },
        removeAllItems: () => {
          setContextMenuItems({
            type: "removeAll",
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
function getGridLayout(total: number) {
  const COLS = 12;
  const ROWS = 12;
  const positions: { col: string; row: string }[] = [];

  if (total === 0) {
    return {
      templateColumns: `repeat(${COLS}, 1fr)`,
      templateRows: `repeat(${ROWS}, 1fr)`,
      positions,
    };
  }

  if (total === 1) {
    positions.push({ col: `1 / span ${COLS}`, row: `1 / span ${ROWS}` });
  } else if (total === 2) {
    const half = COLS / 2; // 6
    positions.push({ col: `1 / span ${half}`, row: `1 / span ${ROWS}` });
    positions.push({ col: `${half + 1} / span ${half}`, row: `1 / span ${ROWS}` });
  } else if (total === 3) {
    const third = COLS / 3; // 4
    for (let i = 0; i < 3; i++) {
      positions.push({ col: `${i * third + 1} / span ${third}`, row: `1 / span ${ROWS}` });
    }
  } else if (total === 4) {
    const half = COLS / 2; // 6
    const halfR = ROWS / 2; // 6
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        positions.push({
          col: `${c * half + 1} / span ${half}`,
          row: `${r * halfR + 1} / span ${halfR}`,
        });
      }
    }
  } else if (total === 5) {
    // Top row: 3, bottom row: 2
    const third = COLS / 3; // 4
    const half = COLS / 2; // 6
    const halfR = ROWS / 2; // 6
    for (let i = 0; i < 3; i++) {
      positions.push({ col: `${i * third + 1} / span ${third}`, row: `1 / span ${halfR}` });
    }
    for (let i = 0; i < 2; i++) {
      positions.push({
        col: `${i * half + 1} / span ${half}`,
        row: `${halfR + 1} / span ${halfR}`,
      });
    }
  } else if (total === 6) {
    const third = COLS / 3; // 4
    const halfR = ROWS / 2; // 6
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        positions.push({
          col: `${c * third + 1} / span ${third}`,
          row: `${r * halfR + 1} / span ${halfR}`,
        });
      }
    }
  } else {
    // Generic: up to 3 per row, distribute evenly
    const colsPerRow = Math.min(total, 3);
    const numRows = Math.ceil(total / colsPerRow);
    const rowSpan = Math.floor(ROWS / numRows);

    let idx = 0;
    for (let r = 0; r < numRows; r++) {
      const itemsInRow = r < numRows - 1 ? colsPerRow : total - idx;
      const colSpan = Math.floor(COLS / itemsInRow);
      for (let c = 0; c < itemsInRow; c++) {
        positions.push({
          col: `${c * colSpan + 1} / span ${colSpan}`,
          row: `${r * rowSpan + 1} / span ${rowSpan}`,
        });
        idx++;
      }
    }
  }

  return {
    templateColumns: `repeat(${COLS}, 1fr)`,
    templateRows: `repeat(${ROWS}, 1fr)`,
    positions,
  };
}
function ProjectPage({ project, projectId }: { project: Project; projectId: number }) {
  console.log("ProjectPage render");
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [scriptVisible, setScriptVisible] = useState(false);
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

  useEffect(() => {
    document.title = (project.slug || "Untitled Project") + " | Super Terminal";
  }, [project.slug]);

  useEffect(() => {
    function listener({ detail }: CustomEvent<WebSocket.Data>) {
      let message: any = {};
      try {
        message = JSON.parse(detail as string);
      } catch (e) {}
      if (!message.name || !message.name.startsWith("response|")) return;

      // Use replace method with a regular expression
      const name = message.name.replace(/^response\|/, "");

      switch (name) {
        case `close:running-projects`: {
          const projectId = Number(message.data);
          const oldData = queryClient.getQueryData(["/running-projects", "query"]) as number[];
          queryClient.setQueryData(
            ["/running-projects", "query"],
            oldData.filter((d) => d !== projectId),
          );
          break;
        }
        case `post:running-projects`: {
          const projectId = Number(message.data);
          const oldData = (queryClient.getQueryData(["/running-projects", "query"]) as number[]) || [];
          queryClient.setQueryData(
            ["/running-projects", "query"],
            oldData.includes(projectId) ? oldData : oldData.concat([projectId]),
          );
          break;
        }
        case "patch:project": {
          queryClient.setQueryData([getProjectQueryKey(project.id), "query"], message.data);
          const oldData = queryClient.getQueryData([getProjectsQueryKey(), "query"]) as Project[];
          queryClient.setQueryData(
            [getProjectsQueryKey(), "query"],
            oldData.map((p) => (p.id !== message.data.id ? p : message.data)),
          );
          break;
        }
        case "delete:project": {
          queryClient.setQueryData(
            [getProjectsQueryKey(), "query"],
            (queryClient.getQueryData([getProjectsQueryKey(), "query"]) as Project[]).filter(
              (p) => p.id !== message.data,
            ),
          );
          break;
        }
        case "post:terminal": {
          const projectId = Number(message.data.projectId);
          const oldData = queryClient.getQueryData([getTerminalQueryKey(projectId), "query"]) as Terminal[];
          queryClient.setQueryData([getTerminalQueryKey(projectId), "query"], [
            ...oldData,
            message.data.terminal,
          ]);
          break;
        }
        case "patch:terminal": {
          const projectId = Number(message.data.projectId);

          const oldData = queryClient.getQueryData([getTerminalQueryKey(projectId), "query"]) as Terminal[];
          queryClient.setQueryData(
            [getTerminalQueryKey(projectId), "query"],
            oldData.map((terminal) => {
              if (terminal.id === Number(message.data.terminalId)) {
                return { ...terminal, ...message.data.terminal };
              }
              return terminal;
            }),
          );
          break;
        }
        case "delete:terminal": {
          const projectId = Number(message.data.projectId);
          const oldData = queryClient.getQueryData([getTerminalQueryKey(projectId), "query"]) as Terminal[];
          queryClient.setQueryData(
            [getTerminalQueryKey(projectId), "query"],
            oldData.filter((terminal) => {
              if (Number(message.data.terminalId) === terminal.id) {
                return false;
              }
              return true;
            }),
          );
          break;
        }
      }
    }
    ws.addEventListener("message", listener);
    return () => {
      ws.removeEventListener("message", listener);
    };
  }, [queryClient, project.id]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  useEffect(() => {
    window.addEventListener("keydown", (event) => {
      // disable ctrol + F
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyF") return event.preventDefault();
      // disable browser command pallete
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyP" && event.shiftKey) {
        event.preventDefault();
        // setCommandPaletteOpen(true);
      }
      // console.log(e);
    });
  }, []);
  const noop = useCallback(() => {}, []);

  if (!projectId) return null;
  return (
    <>
      <Drawer
        title={"Run Commands"}
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      >
        <AutoComplete
          className="autocomplete"
          popupClassName="certain-category-search-dropdown"
          popupMatchSelectWidth={500}
          options={[
            { value: "Burns Bay Road", label: "hehe" },
            { value: "Downing Street", label: "hehe" },
            { value: "Wall Street", label: "hehe" },
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
            setMainCommandCounter={setMainCommandCounter}
            setProjectFormOpen={setProjectFormOpen}
            setScriptVisible={setScriptVisible}
          />
        </Suspense>
      )}
      <Suspense>
        <ShellScriptComponent
          projectId={project.id}
          visible={scriptVisible}
          onVisibleChange={setScriptVisible}
        />
      </Suspense>

      {(() => {
        const { templateColumns, templateRows, positions } = getGridLayout(terminals?.length || 0);
        return (
          <div
            className="terminal-grid"
            style={{ gridTemplateColumns: templateColumns, gridTemplateRows: templateRows }}
          >
            {terminals?.map((terminal, index) => (
              <div
                key={terminal.id}
                style={{
                  display: "flex",
                  minHeight: 0,
                  gridColumn: positions[index].col,
                  gridRow: positions[index].row,
                }}
              >
                <MyTerminal
                  commandToExecute=""
                  setCommandToExecute={noop}
                  mainCommandCounter={mainCommandCounter}
                  projectId={project.id}
                  project={project}
                  terminal={terminal}
                />
              </div>
            ))}
          </div>
        );
      })()}
    </>
  );
}

export default Project2;
