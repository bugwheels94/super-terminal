import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class HistoryHash {
	@CreateDateColumn({})
	createdAt: Date;

	// row,cols are not used because winbox decides xterm size and the end effect will be same

	@PrimaryGeneratedColumn()
	id: number;

	@Column('text', { unique: true })
	path: string;

	@Column('text')
	hash: string;
}
