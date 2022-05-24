import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Terminal } from './Terminal';
@Entity()
export class TerminalSetting {
	@PrimaryGeneratedColumn()
	id: number;

	@ManyToOne(() => Terminal, (terminal) => terminal.settings)
	terminal: Terminal;

	// row,cols are not used because winbox decides xterm size and the end effect will be same
	@Column({ nullable: true })
	height: number;

	@Column({ nullable: true })
	width: number;

	@Column({ nullable: true })
	x: number;

	@Column({ nullable: true })
	y: number;

	@Column({})
	deviceId: string;
}
