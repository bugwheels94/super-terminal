import { Popconfirm, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import {
	getProjectQueryKey,
	PatchProjectRequest,
	PostProjectRequest,
	Project,
	useDeleteProject,
	useGetProjects,
	usePostProject,
} from '../../services/project';
import { client } from '../../utils/socket';
import { BsPlusCircle } from 'react-icons/bs';
import './Home.css';
import { ProjectForm } from '../Project/Form';
function Home() {
	const { mutateAsync } = useDeleteProject();
	const { data: projects } = useGetProjects();
	const queryClient = useQueryClient();
	useEffect(() => {
		document.title = 'Super Terminal';
	}, []);

	useEffect(() => {
		client.addServerResponseListenerFor.delete('/projects/:id', (request, response) => {
			const id = Number(request.params.id);
			const oldData = queryClient.getQueryData(getProjectQueryKey()) as Project[];
			queryClient.setQueryData(
				getProjectQueryKey(),
				oldData.filter((project) => {
					if (id === project.id) {
						return false;
					}
					return true;
				})
			);
		});
	}, [queryClient]);
	const [projectFormOpen, setProjectFormOpen] = useState(false);
	const { mutateAsync: postProject } = usePostProject({
		onSuccess: () => {
			setProjectFormOpen(false);
		},
	});
	return (
		<>
			<div style={{ height: '15rem', textAlign: 'center', fontSize: '5rem', padding: '4rem' }}>Super Terminal</div>
			<div style={{ textAlign: 'center', padding: '4rem' }}>
				<button className="custom-btn" type="button" onClick={() => setProjectFormOpen(true)}>
					<BsPlusCircle style={{ paddingRight: '0.5rem' }} size={20} />
					Create New Project
				</button>
				<ProjectForm
					onOpenChange={setProjectFormOpen}
					open={projectFormOpen}
					onProjectChange={(value: PostProjectRequest | PatchProjectRequest) => {
						//@ts-ignore
						postProject(value);
					}}
					project={null}
				></ProjectForm>
			</div>
			<div style={{ textAlign: 'center', padding: '4rem' }}>
				<div>
					<h2>Existing Projects</h2>
					{projects?.map((project) => {
						return (
							<Link to={`/${project.slug}`} key={project.id}>
								<Tag
									color="magenta"
									closable
									closeIcon={
										<Popconfirm
											title="Are you sure？"
											okText="Yes"
											cancelText="No"
											onConfirm={() => {
												mutateAsync({ id: project.id });
											}}
										>
											x
										</Popconfirm>
									}
									onClose={(e) => {
										e.preventDefault();
									}}
								>
									{project.slug}
								</Tag>
							</Link>
						);
					})}
				</div>
			</div>
			<footer className="footer">
				<strong>Project Maintained Here: </strong>
				<a rel="noreferrer" href="https://github.com/bugwheels94/super-terminal" target="_blank">
					<strong>Github</strong>
				</a>
			</footer>
		</>
	);
}
export default Home;
