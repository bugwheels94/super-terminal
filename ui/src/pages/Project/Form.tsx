import { Input, Slider, Select, Button, Form, Alert } from 'antd';
import { PatchProjectRequest, PostProjectRequest, Project } from '../../services/project';
import { useMemo } from 'react';
import { ApiError } from '../../utils/error';
import { Drawer } from '../components/Drawer';
const rules = [
	{
		message: 'Parameter Name can only contain alphabets, numbers, -, _',
		whitespace: false,
		pattern: /^[A-Za-z0-9-_]+$/g,
	},
];
const defaultTheme = {
	name: 'Breeze',
	black: '#31363b',
	red: '#ed1515',
	green: '#11d116',
	yellow: '#f67400',
	blue: '#1d99f3',
	purple: '#9b59b6',
	cyan: '#1abc9c',
	white: '#eff0f1',
	brightBlack: '#7f8c8d',
	brightRed: '#c0392b',
	brightGreen: '#1cdc9a',
	brightYellow: '#fdbc4b',
	brightBlue: '#3daee9',
	brightPurple: '#8e44ad',
	brightCyan: '#16a085',
	brightWhite: '#fcfcfc',
	background: '#31363b',
	foreground: '#eff0f1',
	selectionBackground: '#eff0f1',
	cursorColor: '#eff0f1',
};

const ProjectForm = ({
	project,
	onOpenChange,
	open,
	onProjectChange,
	error,
}: {
	onProjectChange: (_: PostProjectRequest | PatchProjectRequest) => void;
	project: Project | null;
	open: boolean;
	onOpenChange: (_: boolean) => void;
	error: ApiError | null;
}) => {
	const initialValues = useMemo(() => {
		if (project) {
			return { ...project, terminalTheme: JSON.stringify(project?.terminalTheme, null, 2) };
		} else {
			return {
				slug: '',
				fontSize: 14,
				numberOfLogsToRestore: 100,
				terminalTheme: JSON.stringify(defaultTheme, null, 2),
				terminalLayout: 'automatic',
			};
		}
	}, [project]);
	const linesToRestore = useMemo(() => {
		let options = [];
		for (let i = 500; i < 10000; i += 100) {
			options.push({ value: i, label: i });
		}
		return options;
	}, []);
	const linesToScroll = useMemo(() => {
		let options = [];
		for (let i = 500; i < 50000; i += 500) {
			options.push({ value: i, label: i });
		}
		return options;
	}, []);
	return (
		<Drawer title={project ? 'Edit Project' : 'Create New Project'} onClose={() => onOpenChange(false)} open={open}>
			{open && (
				<Form
					requiredMark={false}
					onFinish={(v: any) =>
						onProjectChange({
							...(project || {}),
							...v,
							...(v.terminalTheme ? { terminalTheme: JSON.parse(v.terminalTheme) } : {}),
						})
					}
					initialValues={initialValues}
				>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Project Name"
						name="slug"
						rules={rules}
					>
						<Input placeholder="Unique name for this project" />
					</Form.Item>

					<Form.Item colon={false} labelAlign="left" labelCol={{ span: 12 }} label="Font Size" name="fontSize">
						<Slider min={6} max={25} />
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Number of Logs to Restore"
						name="numberOfLogsToRestore"
					>
						<Select options={linesToRestore}></Select>
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Number of Lines that can be scrolled"
						name="scrollback"
					>
						<Select options={linesToScroll}></Select>
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Terminal Theme"
						name="terminalTheme"
					>
						<Input.TextArea placeholder="Theme" rows={15} />
					</Form.Item>
					<Form.Item
						colon={false}
						labelAlign="left"
						labelCol={{ span: 12 }}
						label="Terminals Positioning"
						name="terminalLayout"
					>
						<Select
							options={[
								{
									label: "Let Super Terminal manage my terminal's positions",
									value: 'automatic',
								},
								{
									label: "I will manage my terminal's positions",
									value: 'manual',
								},
							]}
						/>
					</Form.Item>
					<Button htmlType="submit" type="primary" style={{ marginBottom: '2rem' }}>
						Save
					</Button>

					{error && <Alert message={error?.message} type="error" />}
				</Form>
			)}
		</Drawer>
	);
};
export default ProjectForm;
