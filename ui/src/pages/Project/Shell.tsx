import { Button, Col, Divider, Form, Input, Row, Select } from 'antd';
import React, { useMemo } from 'react';
import { FaTimes } from 'react-icons/fa';
import { useGetProjects } from '../../services/project';
import {
	ShellScript,
	useCloneProjectScript,
	useDeleteProjectScript,
	usePatchProjectScript,
} from '../../services/shellScript';
const rules = [
	{
		message: 'Name can only contain alphabets, numbers, -, _ and .',
		required: true,
		whitespace: false,
		pattern: /^[A-Za-z0-9-_.]+$/g,
	},
];
const parameterRules = [
	{
		message: 'Parameter Name can only contain alphabets, numbers, -, _',
		required: true,
		whitespace: false,
		pattern: /^[A-Za-z0-9-_]+$/g,
	},
];

export const Shell = ({ shellScript, projectId }: { shellScript: ShellScript; projectId: number }) => {
	const { mutateAsync: patchProjectScript } = usePatchProjectScript(projectId, shellScript.id);
	const { mutateAsync: deleteProjectScript } = useDeleteProjectScript(projectId, shellScript.id);
	const { mutateAsync: cloneProjectScript } = useCloneProjectScript(projectId, shellScript.id);
	const { data: projects } = useGetProjects();
	const initialValues = useMemo(() => {
		return {
			...shellScript,
			projectId: shellScript.projectId || 0,
		};
	}, [shellScript]);
	const projectOptions = useMemo(() => {
		if (!projects) return [];
		const options: {
			value: number | null;
			label: string;
		}[] = projects.map((project) => ({
			value: project.id,
			label: project.slug,
		}));
		options.unshift({
			value: 0,
			label: 'Shared among All Projects',
		});
		return options;
	}, [projects]);
	return (
		<Form
			initialValues={initialValues}
			onFinish={(v) => {
				patchProjectScript({
					...v,
					projectId: v.projectId || null,
				});
			}}
		>
			<Form.Item name="name" label="Name" rules={rules} labelCol={{ span: 6 }}>
				<Input />
			</Form.Item>
			<Form.Item name="script" label="Script" rules={[{ required: true }]} labelCol={{ span: 6 }}>
				<Input.TextArea
					placeholder={`any script in your default shell
echo _parameter_name_
					`}
				/>
			</Form.Item>
			<Form.Item name="projectId" label="Belongs to Project" labelCol={{ span: 6 }}>
				<Select options={projectOptions} />
			</Form.Item>
			<Form.List name="parameters">
				{(fields, { add, remove }) => (
					<>
						<Row>
							<Col span="6" style={{ textAlign: 'right', paddingRight: '1rem' }}>
								Parameters:
							</Col>
							<Col span="18">
								<Button
									type="dashed"
									onClick={() =>
										add({
											type: 'manual',
										})
									}
									block
								>
									+ New Parameter
								</Button>

								{fields.map((field) => (
									<React.Fragment key={field.key}>
										<Divider />

										<Form.Item
											{...field}
											name={[field.name, 'name']}
											key="one"
											label="Name"
											labelCol={{ span: 6 }}
											rules={parameterRules}
										>
											<Input
												suffix={
													<Button onClick={() => remove(field.name)} block danger>
														Remove Parameter
													</Button>
												}
											/>
										</Form.Item>
										<Form.Item {...field} name={[field.name, 'type']} key="two" label="Type" labelCol={{ span: 6 }}>
											<Select
												options={[
													{
														label: 'Enter Manually when executing Script',
														value: 'manual',
													},
													{
														label: 'Choose from Pre-defined list when executing Script',
														value: 'pre-defined',
													},
												]}
											/>
										</Form.Item>
										<Row>
											<Col span="6" style={{ textAlign: 'right', paddingRight: '1rem' }}>
												Allowed Values:
											</Col>
											<Col span="18">
												<Form.List name={[field.name, 'possibleValues']}>
													{(fields2, { add, remove }) => (
														<>
															{fields2.map((field) => {
																return (
																	<Form.Item {...field}>
																		<Input
																			placeholder="Possible Value for the parameter"
																			suffix={
																				<Button
																					onClick={() => remove(field.name)}
																					danger
																					style={{ display: 'inline-flex', alignItems: 'center' }}
																				>
																					<FaTimes />
																				</Button>
																			}
																		/>
																	</Form.Item>
																);
															})}
															<Button type="dashed" onClick={() => add()}>
																+ Add to Allowed Values
															</Button>
														</>
													)}
												</Form.List>
											</Col>
										</Row>
									</React.Fragment>
								))}
							</Col>
						</Row>
					</>
				)}
			</Form.List>
			<Divider />
			<Button htmlType="submit" type="primary">
				Save
			</Button>
			<Button style={{ margin: '0 1rem' }} onClick={() => deleteProjectScript()} danger type="primary">
				Delete
			</Button>
			<Button onClick={() => cloneProjectScript(shellScript)}>Clone</Button>
		</Form>
	);
};
