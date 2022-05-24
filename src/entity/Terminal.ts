import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Project } from './Project';
import { TerminalLog } from './TerminalLog';
import { TerminalSetting } from './TerminalSetting';
@Entity()
export class Terminal {
	@PrimaryGeneratedColumn()
	id: number;

	@ManyToOne(() => Project, (project) => project.terminals, {
		onDelete: 'CASCADE',
	})
	project: Project;

	@Column({ nullable: true })
	title: string;

	// row,cols are not used because winbox decides xterm size and the end effect will be same
	@Column({ nullable: true })
	height: number;

	@Column({ nullable: true })
	width: number;

	@Column({ nullable: true })
	x: number;

	@Column({ nullable: true })
	y: number;

	@OneToMany(() => TerminalSetting, (settings) => settings.terminal, {
		cascade: true,
	})
	settings: TerminalSetting[];
	@OneToMany(() => TerminalLog, (logs) => logs.terminal, { cascade: true })
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
