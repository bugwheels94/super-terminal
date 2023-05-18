import { Entity } from 'typeorm';

import { TerminalLog } from './TerminalLog';
@Entity()
export class TerminalLogArchive extends TerminalLog {}
