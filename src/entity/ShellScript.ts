import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Project } from './Project';

@Entity()
export class ShellScript {
	@CreateDateColumn({})
	createdAt: Date;

	// row,cols are not used because winbox decides xterm size and the end effect will be same

	@PrimaryGeneratedColumn()
	id: number;

	@Column({ nullable: true })
	script: string;

	@Column()
	name: string;

	@Column({ nullable: true })
	projectId?: number;
	@ManyToOne('Project', 'scripts', {
		onDelete: 'CASCADE',
		nullable: true,
	})
	project?: Project;

	@Column({
		type: 'simple-json',
		default: () => "('[]')",
	})
	parameters: {
		name: string;
		type: 'manual' | 'pre-defined';
		possibleValues: string[];
	}[];
}
