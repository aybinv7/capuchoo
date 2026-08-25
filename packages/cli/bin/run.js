#!/usr/bin/env node

import { execute } from "@oclif/core";

/**
 * A bare `capuchoo` in a terminal opens the menu.
 *
 * oclif's default is to print help and exit, which is a dead end: you read a
 * list of topics, type one, read another list, type a subcommand, and get
 * `command channeml not found` for a typo. `menu` is a loop instead.
 *
 * Done here rather than with a `commands/index.ts`, which is how oclif is
 * usually told about a root command - that file makes it treat the whole CLI as
 * a *single-command* program, and every other command stops resolving with
 * `MODULE_NOT_FOUND ... Symbol(SINGLE_COMMAND_CLI)`. Injecting the argument
 * leaves oclif's multi-command resolution alone.
 *
 * Only with a real terminal on both ends. A script or CI job that runs
 * `capuchoo` with no arguments still gets help and exits, rather than blocking
 * forever on a prompt nothing can answer.
 */
const bare = process.argv.length === 2;
const interactive = process.stdin.isTTY && process.stdout.isTTY;

if (bare && interactive) process.argv.push("menu");

await execute({ dir: import.meta.url });
