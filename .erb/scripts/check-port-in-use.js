import chalk from 'chalk';
import net from 'net';

const port = Number(process.env.PORT || 1212);
const server = net.createServer();

server.once('error', () => {
  throw new Error(
    chalk.whiteBright.bgRed.bold(
      `Port "${port}" on "localhost" is already in use. Please use another port. ex: PORT=4343 pnpm dev`
    )
  );
});

server.once('listening', () => {
  server.close(() => {
    process.exit(0);
  });
});

server.listen(port, '127.0.0.1');
