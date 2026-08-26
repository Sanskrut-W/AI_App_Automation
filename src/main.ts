import { runPipelineCommand } from './interfaces/cli/commands/RunPipelineCommand';

runPipelineCommand(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
