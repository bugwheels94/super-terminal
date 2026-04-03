import { PatchProjectRequest, PostProjectRequest, Project } from '../../services/project';
import { useMemo, useState } from 'react';
import { ApiError } from '../../utils/error';
import { Drawer } from '../components/Drawer';
import { useDeleteProjectLogs } from '../../services/group';

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

const styles = {
	form: {
		display: 'flex',
		flexDirection: 'column',
		gap: '1.25rem',
		padding: '1.5rem',
	} as React.CSSProperties,
	row: {
		display: 'grid',
		gridTemplateColumns: '1fr 1fr',
		alignItems: 'center',
		gap: '1rem',
	} as React.CSSProperties,
	label: {
		fontSize: '13px',
		color: '#333',
	} as React.CSSProperties,
	input: {
		padding: '6px 10px',
		fontSize: '13px',
		border: '1px solid #ccc',
		borderRadius: '4px',
		outline: 'none',
		background: '#fff',
	} as React.CSSProperties,
	textarea: {
		padding: '8px 10px',
		fontSize: '12px',
		fontFamily: 'Menlo, Consolas, monospace',
		border: '1px solid #ccc',
		borderRadius: '4px',
		outline: 'none',
		resize: 'vertical' as const,
		minHeight: '200px',
		background: '#fff',
	} as React.CSSProperties,
	button: {
		padding: '7px 20px',
		fontSize: '13px',
		cursor: 'pointer',
		background: '#1677ff',
		color: '#fff',
		border: 'none',
		borderRadius: '4px',
		alignSelf: 'flex-start',
	} as React.CSSProperties,
	dangerButton: {
		padding: '7px 20px',
		fontSize: '13px',
		cursor: 'pointer',
		background: '#e00',
		color: '#fff',
		border: 'none',
		borderRadius: '4px',
	} as React.CSSProperties,
	error: {
		color: '#e00',
		fontSize: '12px',
		padding: '6px 10px',
		background: '#fff0f0',
		border: '1px solid #fcc',
		borderRadius: '4px',
	} as React.CSSProperties,
};

const logSizeOptions = [
	{ label: 'No limit', value: '' },
	{ label: '10 MB', value: 10 },
	{ label: '50 MB', value: 50 },
	{ label: '100 MB', value: 100 },
	{ label: '250 MB', value: 250 },
	{ label: '500 MB', value: 500 },
	{ label: '1000 MB', value: 1000 },
];

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
	const { mutate: deleteLogs, isPending: isDeletingLogs } = useDeleteProjectLogs(project?.id || 0);
	const initialValues = useMemo(() => {
		if (project) {
			return { ...project, terminalTheme: JSON.stringify(project?.terminalTheme, null, 2) };
		}
		return {
			slug: '',
			fontSize: 14,
			numberOfLogsToRestore: 100,
			scrollback: 1000,
			terminalTheme: JSON.stringify(defaultTheme, null, 2),
		};
	}, [project]);

	const [values, setValues] = useState(initialValues);
	const set = (key: string, value: any) => setValues((prev: any) => ({ ...prev, [key]: value }));

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const v = values as any;
		onProjectChange({
			...v,
			...(v.terminalTheme ? { terminalTheme: JSON.parse(v.terminalTheme) } : {}),
		});
	};

	return (
		<Drawer title={project ? 'Edit Project' : 'Create New Project'} onClose={() => onOpenChange(false)} open={open}>
			{open && (
				<form onSubmit={handleSubmit} style={styles.form}>
					<div style={styles.row}>
						<label style={styles.label}>Project Name</label>
						<input
							style={styles.input}
							placeholder="Unique name for this project"
							value={(values as any).slug || ''}
							onChange={(e) => set('slug', e.target.value)}
							pattern="^[A-Za-z0-9\-_]+$"
							title="Only alphabets, numbers, - and _"
						/>
					</div>
					<div style={styles.row}>
						<label style={styles.label}>Font Size</label>
						<select style={styles.input} value={(values as any).fontSize || 14} onChange={(e) => set('fontSize', Number(e.target.value))}>
							{Array.from({ length: 48 }, (_, i) => (
								<option key={i + 1} value={i + 1}>{i + 1}</option>
							))}
						</select>
					</div>
					<div style={styles.row}>
						<label style={styles.label}>Logs to Restore</label>
						<select style={styles.input} value={(values as any).numberOfLogsToRestore || 500} onChange={(e) => set('numberOfLogsToRestore', Number(e.target.value))}>
							{Array.from({ length: 96 }, (_, i) => {
								const v = (i + 1) * 100;
								return <option key={v} value={v}>{v}</option>;
							})}
						</select>
					</div>
					<div style={styles.row}>
						<label style={styles.label}>Scrollback Lines</label>
						<select style={styles.input} value={(values as any).scrollback || 1000} onChange={(e) => set('scrollback', Number(e.target.value))}>
							{Array.from({ length: 99 }, (_, i) => {
								const v = (i + 1) * 500;
								return <option key={v} value={v}>{v}</option>;
							})}
						</select>
					</div>
					<div style={styles.row}>
						<label style={styles.label}>Max Log Size</label>
						<select style={styles.input} value={(values as any).maxLogSizeMb ?? ''} onChange={(e) => set('maxLogSizeMb', e.target.value === '' ? null : Number(e.target.value))}>
							{logSizeOptions.map((opt) => (
								<option key={String(opt.value)} value={opt.value}>{opt.label}</option>
							))}
						</select>
					</div>
					{project && (
						<div style={styles.row}>
							<label style={styles.label}>Delete All Logs</label>
							<button
								type="button"
								style={styles.dangerButton}
								disabled={isDeletingLogs}
								onClick={() => { if (confirm('Delete all logs for this project?')) deleteLogs(undefined as any); }}
							>
								{isDeletingLogs ? 'Deleting...' : 'Delete Logs'}
							</button>
						</div>
					)}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
						<label style={styles.label}>Terminal Theme</label>
						<textarea
							style={styles.textarea}
							placeholder="Theme JSON"
							value={(values as any).terminalTheme || ''}
							onChange={(e) => set('terminalTheme', e.target.value)}
							rows={15}
						/>
					</div>
					<button type="submit" style={styles.button}>Save</button>
					{error && <div style={styles.error}>{error?.message}</div>}
				</form>
			)}
		</Drawer>
	);
};
export default ProjectForm;
