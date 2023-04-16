import { Input, Popconfirm, Popover, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getProjectQueryKey, Project, useDeleteProject, useGetProjects } from '../../services/project';
import { receiver } from '../../utils/socket';
import { BsPlusCircle } from 'react-icons/bs';
import './Home.css';
function Home() {
	const { mutateAsync } = useDeleteProject();
	const [visible, setVisible] = useState(false);
	const [value, setValue] = useState('');
	const navigate = useNavigate();
	const { data: projects } = useGetProjects();
	const queryClient = useQueryClient();
	useEffect(() => {
		document.title = 'Super Terminal';
	}, []);

	useEffect(() => {
		receiver.delete('/projects/:id', (request, response) => {
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
	return (
		<>
			<div style={{ height: '15rem', textAlign: 'center', fontSize: '5rem', padding: '4rem' }}>Super Terminal</div>
			<div style={{ textAlign: 'center', padding: '4rem' }}>
				<Popover
					content={
						<Input
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onPressEnter={(e) => {
								if (value)
									navigate({
										pathname: value,
									});
							}}
						/>
					}
					title="Title"
					trigger="click"
					open={visible}
					onOpenChange={setVisible}
				>
					<button className="custom-btn" type="button">
						<BsPlusCircle style={{ paddingRight: '0.5rem' }} size={20} />
						Create New Project
					</button>
				</Popover>
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
