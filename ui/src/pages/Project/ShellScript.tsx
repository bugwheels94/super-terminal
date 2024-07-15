import { Button, Collapse } from 'antd';
import { useEffect } from 'react';
import { useQueryClient } from 'react-query';
import {
	getProjectScriptQueryKey,
	ShellScript,
	useGetProjectScripts,
	usePostProjectScript,
} from '../../services/shellScript';
import { ws } from '../../utils/socket';
import { Shell } from './Shell';
import Drawer from '../components/Drawer';
const { Panel } = Collapse;

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
	const { mutateAsync: postProject } = usePostProjectScript(projectId);
	const queryClient = useQueryClient();

	useEffect(() => {
		function listener(e: any) {
			const message = e.detail;

			if (!message.name || !message.name.startsWith('response|')) return;
			const prefix = 'response|';

			// Use replace method with a regular expression
			const name = message.name.replace(new RegExp(`^${prefix}`), '');

			switch (name) {
				case 'post:script': {
					const projectId = Number(message.data.projectId);

					const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
					queryClient.setQueryData(getProjectScriptQueryKey(projectId), [...oldData, message.data.data]);

					break;
				}
				case 'clone:script': {
					const projectId = Number(message.data.projectId);
					const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
					queryClient.setQueryData(getProjectScriptQueryKey(projectId), [...oldData, message.data.data]);

					break;
				}
				case 'patch:script': {
					const projectId = Number(message.data.projectId);

					const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
					queryClient.setQueryData(
						getProjectScriptQueryKey(projectId),
						oldData.map((shellScript) => {
							if (shellScript.id === Number(message.data.scriptId)) {
								return message.data;
							}
							return shellScript;
						})
					);

					break;
				}
				case 'delete:script': {
					const projectId = Number(message.data.projectId);

					const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
					queryClient.setQueryData(
						getProjectScriptQueryKey(projectId),
						oldData.filter((script) => {
							if (Number(message.data.scriptId) === script.id) {
								return false;
							}
							return true;
						})
					);

					break;
				}
			}
		}
		ws.addEventListener('message', listener);
		return () => {
			ws.removeEventListener('message', listener);
		};
	}, [queryClient]);

	return (
		<>
			<Drawer
				title="Executable Scripts"
				onClose={() => {
					onVisibleChange(false);
				}}
				open={visible}
			>
				<Button
					style={{ margin: '0 0 2rem 0' }}
					onClick={() =>
						postProject({
							name: 'Untitled Script',
						})
					}
				>
					+ New Script
				</Button>
				<Collapse accordion destroyInactivePanel={true}>
					{data?.map((shellScript) => {
						return (
							<Panel header={shellScript.name} key={shellScript.id}>
								<Shell shellScript={shellScript} projectId={projectId}></Shell>
							</Panel>
						);
					})}
				</Collapse>
			</Drawer>
		</>
	);
};
export default ShellScriptComponent;
