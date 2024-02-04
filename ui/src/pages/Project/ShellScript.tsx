import { Button, Collapse } from 'antd';
import { useEffect } from 'react';
import { useQueryClient } from 'react-query';
import {
	getProjectScriptQueryKey,
	ShellScript,
	useGetProjectScripts,
	usePostProjectScript,
} from '../../services/shellScript';
import { client } from '../../utils/socket';
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
		const listeners = client.addServerResponseListenerFor
			.post('/projects/:projectId/scripts', (request, response) => {
				if (!response.data) return;
				const projectId = Number(request.params.projectId);

				const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
				queryClient.setQueryData(getProjectScriptQueryKey(projectId), [...oldData, response.data]);
			})
			.post('/projects/:projectId/scripts/:scriptId/copies', (request, response) => {
				if (!response.data) return;
				const projectId = Number(request.params.projectId);
				const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
				queryClient.setQueryData(getProjectScriptQueryKey(projectId), [...oldData, response.data]);
			})
			.patch('/projects/:projectId/scripts/:scriptId', (request, response) => {
				if (!response.data) return;
				const projectId = Number(request.params.projectId);

				const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
				queryClient.setQueryData(
					getProjectScriptQueryKey(projectId),
					oldData.map((shellScript) => {
						if (shellScript.id === Number(request.params.scriptId)) {
							return response.data;
						}
						return shellScript;
					})
				);
			})
			.delete('/projects/:projectId/scripts/:scriptId', (request) => {
				const projectId = Number(request.params.projectId);

				const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
				queryClient.setQueryData(
					getProjectScriptQueryKey(projectId),
					oldData.filter((script) => {
						if (Number(request.params.scriptId) === script.id) {
							return false;
						}
						return true;
					})
				);
			});
		return () => {
			listeners.stopListening();
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
