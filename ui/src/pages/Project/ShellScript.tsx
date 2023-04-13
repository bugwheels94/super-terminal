import { Button, Collapse, Drawer } from 'antd';
import { useEffect } from 'react';
import { useQueryClient } from 'react-query';
import {
	getProjectScriptQueryKey,
	ShellScript,
	useGetProjectScripts,
	usePostProjectScript,
} from '../../services/shellScript';
import { receiver } from '../../utils/socket';
import { Shell } from './Shell';
const { Panel } = Collapse;

export const ShellScriptComp = ({
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
		// receiver.get('/projects/:projectId/scripts', (request, response) => {
		// 	console.log("Receiver picking")
		// 	const projectId = Number(request.params.projectId);

		// 	if (response.data) queryClient.setQueryData(getProjectScriptQueryKey(projectId), response.data);
		// });
		receiver.post('/projects/:projectId/scripts', (request, response) => {
			if (!response.data) return;
			console.log('hahaha', request);
			const projectId = Number(request.params.projectId);

			const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
			queryClient.setQueryData(getProjectScriptQueryKey(projectId), [...oldData, response.data]);
		});
		receiver.post('/projects/:projectId/scripts/:scriptId/copies', (request, response) => {
			if (!response.data) return;
			const projectId = Number(request.params.projectId);
			const oldData = queryClient.getQueryData(getProjectScriptQueryKey(projectId)) as ShellScript[];
			queryClient.setQueryData(getProjectScriptQueryKey(projectId), [...oldData, response.data]);
		});
		receiver.patch('/projects/:projectId/scripts/:scriptId', (request, response) => {
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
		});
		receiver.delete('/projects/:projectId/scripts/:scriptId', (request, response) => {
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
	}, [queryClient]);

	console.log('data', projectId, data);
	return (
		<>
			<Drawer
				size="large"
				title="Executable Scripts"
				placement="right"
				onClose={() => {
					onVisibleChange(false);
				}}
				destroyOnClose={true}
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
