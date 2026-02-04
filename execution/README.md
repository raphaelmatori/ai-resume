# Execution

This directory contains the "Execution" layer of the agent architecture.
It consists of deterministic Python scripts.

## Rules for Scripts:
- **Deterministic**: Given the same input, they should produce the same output.
- **Reliable**: Handle errors gracefully.
- **Documented**: Clear usage instructions and comments.
- **Environment**: Use `.env` for secrets and configuration.

## Usage
Scripts are called by the Orchestration layer based on Directives.
