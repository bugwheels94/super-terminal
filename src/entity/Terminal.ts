import { Column, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import type { Project } from './Project';
import type { TerminalLog } from './TerminalLog';
import type { TerminalSetting } from './TerminalSetting';
@Entity()
export class Terminal {
	@PrimaryGeneratedColumn()
	id: number;

	@Index()
	@Column({ nullable: true })
	projectId: number;

	@ManyToOne('Project', 'terminals', {
		onDelete: 'CASCADE',
	})
	project: Project;

	@Column({ nullable: true })
	title: string;

	// row,cols are not used because winbox decides xterm size and the end effect will be same
	@Column({ nullable: true })
	height: number;

	@Column({ nullable: true })
	shell: string;

	@Column({ nullable: true })
	width: number;

	@Column({ nullable: true })
	minimized: number;
	@Column({ nullable: true })
	maximized: boolean;

	@Column({ nullable: true })
	x: number;

	@Column({ nullable: true })
	y: number;

	@Column({ nullable: true })
	z: number;

	@OneToMany('TerminalSetting', 'terminal', {
		cascade: true,
	})
	settings: TerminalSetting[];

	@OneToMany('TerminalLog', 'terminal', { cascade: true })
	logs: TerminalLog[];

	@Column({ nullable: true })
	mainCommand: string;

	@Column({ nullable: true })
	startupCommands: string;

	@Column({ nullable: true })
	startupEnvironmentVariables: string;

	@Column({ nullable: true })
	cwd: string;
}
