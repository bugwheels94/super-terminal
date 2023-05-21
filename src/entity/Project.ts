import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { ShellScript } from './ShellScript';

import type { Terminal } from './Terminal';
@Entity()
export class Project {
	@PrimaryGeneratedColumn()
	id: number;

	@Column('text', { unique: true })
	slug: string;

	@Column('text', {
		default: 'automatic',
	})
	terminalLayout: 'automatic' | 'manual';

	@OneToMany('Terminal', 'project', { cascade: true })
	terminals: Terminal[];

	@OneToMany('ShellScript', 'project', { cascade: true })
	scripts: ShellScript[];

	@Column('int', { nullable: true })
	fontSize?: number;

	@Column('int', { nullable: true, default: 100 })
	numberOfLogsToRestore?: number;

	@Column({ nullable: true, type: 'simple-json' })
	terminalTheme?: any;
}
