import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getProjectScriptQueryKey,
  ShellScript,
  useGetProjectScripts,
  usePostProjectScript,
} from "../../services/shellScript";
import { ws } from "../../utils/socket";
import { Shell } from "./Shell";
import Drawer from "../components/Drawer";

const ShellScriptComponent = ({
  projectId,
  visible,
  onVisibleChange,
}: {
  projectId: number;
  visible: boolean;
  onVisibleChange: (_: boolean) => void;
}) => {
  const { data } = useGetProjectScripts(projectId);
  const { mutateAsync: postScript } = usePostProjectScript(projectId);
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    function listener(e: any) {
      if (typeof e.detail !== "string") return;
      let message: any;
      try {
        message = JSON.parse(e.detail);
      } catch {
        return;
      }

      if (!message.name || !message.name.startsWith("response|")) return;
      const name = message.name.replace(/^response\|/, "");

      switch (name) {
        case "post:script": {
          const pid = Number(message.data.projectId);
          const key = [getProjectScriptQueryKey(pid), "query"];
          const oldData = queryClient.getQueryData(key) as ShellScript[];
          queryClient.setQueryData(key, [...(oldData || []), message.data.data]);
          break;
        }
        case "clone:script": {
          const pid = Number(message.data.projectId);
          const key = [getProjectScriptQueryKey(pid), "query"];
          const oldData = queryClient.getQueryData(key) as ShellScript[];
          queryClient.setQueryData(key, [...(oldData || []), message.data.data]);
          break;
        }
        case "patch:script": {
          const pid = Number(message.data.projectId);
          const key = [getProjectScriptQueryKey(pid), "query"];
          const oldData = queryClient.getQueryData(key) as ShellScript[];
          queryClient.setQueryData(
            key,
            (oldData || []).map((shellScript) => {
              if (shellScript.id === Number(message.data.scriptId)) {
                return message.data.data;
              }
              return shellScript;
            }),
          );
          break;
        }
        case "delete:script": {
          const pid = Number(message.data.projectId);
          const key = [getProjectScriptQueryKey(pid), "query"];
          const oldData = queryClient.getQueryData(key) as ShellScript[];
          queryClient.setQueryData(
            key,
            (oldData || []).filter((script) => Number(message.data.scriptId) !== script.id),
          );
          break;
        }
      }
    }
    ws.addEventListener("message", listener);
    return () => {
      ws.removeEventListener("message", listener);
    };
  }, [queryClient]);

  return (
    <Drawer
      title="Executable Scripts"
      onClose={() => {
        onVisibleChange(false);
      }}
      open={visible}
    >
      <div style={{ padding: "1rem" }}>
        <button
          style={{
            padding: "7px 16px",
            fontSize: "13px",
            cursor: "pointer",
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
          onClick={() => postScript({ name: "Untitled Script" })}
        >
          + New Script
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {data?.map((shellScript) => (
            <div key={shellScript.id} style={{ border: "1px solid #ddd", borderRadius: "4px" }}>
              <div
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  background: expandedId === shellScript.id ? "#f0f0f0" : "#fafafa",
                  borderRadius: "4px",
                  fontSize: "13px",
                  userSelect: "none",
                }}
                onClick={() => setExpandedId(expandedId === shellScript.id ? null : shellScript.id)}
              >
                {expandedId === shellScript.id ? "▾" : "▸"} {shellScript.name}
              </div>
              {expandedId === shellScript.id && (
                <div style={{ padding: "8px 12px", borderTop: "1px solid #eee" }}>
                  <Shell shellScript={shellScript} projectId={projectId} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
};
export default ShellScriptComponent;
