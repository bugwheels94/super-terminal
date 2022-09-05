import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Terminal } from './Terminal';
@Entity()
export class TerminalCommand {
	@PrimaryGeneratedColumn()
	id: number;

	@Index()
	@Column()
	terminalId: number;

	@ManyToOne(() => Terminal, (terminal) => terminal.commands, {
		onDelete: 'CASCADE',
	})
	terminal: Terminal;

	@Index()
	@CreateDateColumn({})
	createdAt: Date;

	// row,cols are not used because winbox decides xterm size and the end effect will be same
	@Column()
	command: string;
}
