import { Input, Button, Form, Select } from 'antd';
import { ShellScript, usePostProjectScriptExecution } from '../../services/shellScript';
import { FaPlay } from 'react-icons/fa';
import { useMemo, useState } from 'react';

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
	const [currentValues, setCurrentValues] = useState<Record<string, string>>({});
	const finalScript = useMemo(() => {
		let finalScript = script.script;
		Object.keys(currentValues).forEach((key) => {
			finalScript = finalScript.replace(`{{${key}}}`, currentValues[key]);
		});
		return finalScript;
	}, [currentValues, script.script]);
	return (
		<Form
			initialValues={initialValue}
			onValuesChange={(v) => {
				setCurrentValues(v);
			}}
			onFinish={(v) => {
				mutateAsync(v);
				onClose(false);
			}}
		>
			{script.parameters.map((parameter) => {
				return (
					<Form.Item name={parameter.name} key={parameter.name} label={parameter.name}>
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
			<strong>Preview Script:</strong>
			<div style={{ whiteSpace: 'pre', border: 'solid 1px #CCC', padding: '2rem', marginBottom: '2rem' }}>
				{finalScript}
			</div>
			<Button htmlType="submit" style={{ display: 'inline-flex', alignItems: 'center' }}>
				<FaPlay style={{ marginRight: '1rem' }} />
				Execute
			</Button>
		</Form>
	);
};
