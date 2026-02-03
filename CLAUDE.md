# CLAUDE.md - AI Assistant Guidelines for Hello

This file provides guidance for AI assistants working with this repository.

## Repository Overview

- **Repository**: Hello
- **Owner**: katonichika-code
- **Status**: New project (initialized)

## Project Structure

```
Hello/
├── CLAUDE.md          # AI assistant guidelines (this file)
└── .git/              # Git repository
```

## Getting Started

### Prerequisites

- Git installed and configured
- Node.js (if adding JavaScript/TypeScript code)
- Any other dependencies as the project evolves

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd Hello

# Install dependencies (when applicable)
npm install  # or yarn, pnpm as configured
```

## Development Workflow

### Branch Naming Conventions

- Feature branches: `feature/<description>`
- Bug fixes: `fix/<description>`
- Claude Code branches: `claude/<description>-<session-id>`

### Commit Message Guidelines

- Use clear, descriptive commit messages
- Start with a verb in present tense (Add, Fix, Update, Remove, Refactor)
- Keep the first line under 72 characters
- Add detailed description in the body when necessary

Example:
```
Add user authentication module

- Implement JWT token generation
- Add login/logout endpoints
- Include password hashing with bcrypt
```

### Code Review Process

1. Create a feature branch from main
2. Make changes and commit
3. Push branch and create pull request
4. Request review from team members
5. Address feedback and merge when approved

## Coding Conventions

### General Guidelines

- Write clean, readable, and maintainable code
- Follow the principle of least surprise
- Keep functions small and focused
- Use meaningful variable and function names
- Add comments only when the code isn't self-explanatory

### File Organization

- Group related files together
- Use consistent naming conventions
- Keep configuration files in the root directory
- Place source code in `src/` directory (when applicable)

## AI Assistant Instructions

### When Working on This Repository

1. **Read First**: Always read existing files before making modifications
2. **Understand Context**: Review related files and understand the broader context
3. **Minimal Changes**: Make only the changes necessary to accomplish the task
4. **Test**: Verify changes work as expected before committing
5. **Document**: Update documentation when adding new features

### Do's

- Follow existing code style and conventions
- Write clear commit messages
- Keep changes focused and atomic
- Ask for clarification when requirements are unclear

### Don'ts

- Don't introduce unnecessary dependencies
- Don't over-engineer simple solutions
- Don't make changes outside the scope of the request
- Don't commit sensitive information (API keys, passwords, etc.)

### Error Handling

- When encountering errors, provide the full error message
- Suggest potential solutions based on the error context
- If blocked, explain what's needed to proceed

## Testing

### Running Tests

```bash
# Run all tests (when test framework is configured)
npm test

# Run specific test file
npm test -- <filename>
```

### Writing Tests

- Write tests for new functionality
- Ensure tests are deterministic and isolated
- Use descriptive test names that explain what is being tested

## Build and Deployment

### Building the Project

```bash
# Build for production (when applicable)
npm run build
```

### Environment Variables

- Store environment-specific configuration in `.env` files
- Never commit `.env` files with sensitive data
- Document required environment variables in `.env.example`

## Troubleshooting

### Common Issues

1. **Dependencies not installing**: Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

2. **Git conflicts**: Pull latest changes, resolve conflicts locally, then push

3. **Build failures**: Check for TypeScript/linting errors, ensure all dependencies are installed

## Resources

- [Git Documentation](https://git-scm.com/doc)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

*This file should be updated as the project evolves to reflect current practices and structure.*
