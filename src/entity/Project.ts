import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ShellScript } from './ShellScript';

import { Terminal } from './Terminal';
@Entity()
export class Project {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	slug: string;

	@Column({
		default: 'automatic',
	})
	terminalLayout: 'automatic' | 'manual';

	@OneToMany(() => Terminal, (terminal) => terminal.project, { cascade: true })
	terminals: Terminal[];

	@OneToMany(() => ShellScript, (ShellScript) => ShellScript.project, { cascade: true })
	scripts: ShellScript[];

	@Column({ nullable: true })
	fontSize?: number;

	@Column({ nullable: true, type: 'simple-json' })
	terminalTheme?: any;
}
