import { Input, Button, Form, Select } from 'antd';
import { ShellScript, usePostProjectScriptExecution } from '../../services/shellScript';
import { FaPlay } from 'react-icons/fa';

export const ShellScriptExecution = ({
	terminalId,
	script,
	onClose,
}: {
	script: ShellScript;
	terminalId: number;
	onClose: (v: boolean) => void;
}) => {
	const initialValue: Record<string, unknown> = {};
	const { mutateAsync } = usePostProjectScriptExecution(terminalId, script.id);
	script.parameters.forEach((parameter) => {
		if (parameter.type === 'pre-defined') {
			initialValue[parameter.name] = parameter.possibleValues[0];
		}
	});

	return (
		<Form
			initialValues={initialValue}
			onFinish={(v) => {
				mutateAsync(v);
				onClose(false);
			}}
		>
			{script.parameters.map((parameter) => {
				return (
					<Form.Item name={parameter.name} key={parameter.name} label={parameter.name} labelCol={{ span: 10 }}>
						{parameter.type === 'manual' ? (
							<Input />
						) : (
							<Select
								options={parameter.possibleValues.map((value) => ({
									value,
								}))}
							/>
						)}
					</Form.Item>
				);
			})}
			<Button htmlType="submit" style={{ display: 'inline-flex', alignItems: 'center' }}>
				<FaPlay style={{ marginRight: '1rem' }} />
				Execute
			</Button>
		</Form>
	);
};
