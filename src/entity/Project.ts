import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Terminal } from './Terminal';
@Entity()
export class Project {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	slug: string;

	@OneToMany(() => Terminal, (terminal) => terminal.project, { cascade: true })
	terminals: Terminal[];

	@Column({ nullable: true })
	fontSize: number;
}
