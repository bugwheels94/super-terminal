import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import type { Terminal } from './Terminal';
@Entity()
export class TerminalLog {
	@PrimaryGeneratedColumn()
	id: number;

	@Index()
	@Column()
	terminalId: number;

	@ManyToOne('Terminal', 'logs', {
		onDelete: 'CASCADE',
	})
	terminal: Terminal;

	@Index()
	@CreateDateColumn({})
	createdAt: Date;

	// row,cols are not used because winbox decides xterm size and the end effect will be same
	@Column()
	log: string;
}
