import { main } from './index';
const PORT = process.env.PORT;
const BIND_ADDRESS = process.env.HOST;
main(Number(PORT || 0), BIND_ADDRESS);
