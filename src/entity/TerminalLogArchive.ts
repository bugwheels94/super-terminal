import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { TerminalLog } from './TerminalLog';
@Entity()
export class TerminalLogArchive extends TerminalLog {}
